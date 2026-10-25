import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { Readable } from "node:stream";
import { pool } from "./db.js";
import cloudinary from "./cloudinary.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);

const allowedOrigin =
  process.env.CLIENT_ORIGIN || "http://localhost:5173";

const allowedCategories = new Set([
  "Story",
  "Ambience",
  "Hidden gem",
  "Guide",
]);

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "100kb" }));

// Create comment and report tables automatically.
let communityTablesReady;

function ensureCommunityTables() {
  if (!communityTablesReady) {
    communityTablesReady = pool.query(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id BIGSERIAL PRIMARY KEY,
        post_id BIGINT NOT NULL
          REFERENCES audio_posts(id) ON DELETE CASCADE,
        name VARCHAR(60) NOT NULL DEFAULT 'Guest',
        body VARCHAR(1000) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS post_comments_post_id_created_at_idx
        ON post_comments(post_id, created_at ASC);

      CREATE TABLE IF NOT EXISTS post_reports (
        id BIGSERIAL PRIMARY KEY,
        post_id BIGINT NOT NULL
          REFERENCES audio_posts(id) ON DELETE CASCADE,
        reason VARCHAR(40) NOT NULL,
        details VARCHAR(1000) NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS post_reports_post_id_created_at_idx
        ON post_reports(post_id, created_at DESC);
    `).catch(error => {
      communityTablesReady = null;
      throw error;
    });
  }

  return communityTablesReady;
}

// Audio uploads: maximum 15 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("audio/")) {
      return callback(
        new Error("Only audio files are allowed.")
      );
    }

    callback(null, true);
  },
});

// Validate optional coordinates.
function parseCoordinates(latitude, longitude) {
  const hasLat =
    latitude !== undefined &&
    latitude !== null &&
    latitude !== "";

  const hasLng =
    longitude !== undefined &&
    longitude !== null &&
    longitude !== "";

  if (hasLat !== hasLng) {
    return {
      error:
        "Provide both latitude and longitude, or neither.",
    };
  }

  if (!hasLat && !hasLng) {
    return { lat: null, lng: null };
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return {
      error: "Invalid latitude or longitude.",
    };
  }

  return { lat, lng };
}

// Upload an audio file to Cloudinary.
function uploadAudioToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "proxispeak/audio",
      },
      (error, result) => {
        if (error) return reject(error);

        if (!result) {
          return reject(
            new Error(
              "Cloudinary returned no upload result."
            )
          );
        }

        resolve(result);
      }
    );

    Readable.from([file.buffer]).pipe(stream);
  });
}

// Health check.
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected",
      service: "ProxiSpeak API",
    });
  } catch (error) {
    console.error(
      "Health check failed:",
      error.message
    );

    res.status(503).json({
      status: "degraded",
      database: "unavailable",
      message:
        "Check DATABASE_URL and PostgreSQL.",
    });
  }
});

// Get published posts with search, category and distance filters.
app.get("/api/posts", async (req, res) => {
  const {
    q = "",
    category = "",
    lat,
    lng,
    radiusKm = "10",
  } = req.query;

  const hasLat = lat !== undefined && lat !== "";
  const hasLng = lng !== undefined && lng !== "";
  const radius = Number(radiusKm);

  if (hasLat !== hasLng) {
    return res.status(400).json({
      error: "Provide both lat and lng, or neither.",
    });
  }

  if (
    hasLat &&
    (!Number.isFinite(Number(lat)) ||
      Number(lat) < -90 ||
      Number(lat) > 90)
  ) {
    return res.status(400).json({
      error: "lat must be between -90 and 90.",
    });
  }

  if (
    hasLng &&
    (!Number.isFinite(Number(lng)) ||
      Number(lng) < -180 ||
      Number(lng) > 180)
  ) {
    return res.status(400).json({
      error: "lng must be between -180 and 180.",
    });
  }

  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    radius > 100
  ) {
    return res.status(400).json({
      error:
        "radiusKm must be greater than 0 and at most 100.",
    });
  }

  if (
    String(q).length > 100 ||
    String(category).length > 50
  ) {
    return res.status(400).json({
      error: "Search or category filter is too long.",
    });
  }

  if (
    String(category).trim() &&
    !allowedCategories.has(String(category).trim())
  ) {
    return res.status(400).json({
      error: "Category is not supported.",
    });
  }

  try {
    const params = [];
    const conditions = ["is_published = TRUE"];

    if (String(q).trim()) {
      params.push(`%${String(q).trim()}%`);

      conditions.push(
        `(title ILIKE $${params.length}
          OR description ILIKE $${params.length})`
      );
    }

    if (String(category).trim()) {
      params.push(String(category).trim());

      conditions.push(
        `category = $${params.length}`
      );
    }

    let distanceSelect =
      "NULL::double precision AS distance_km";

    if (hasLat && hasLng) {
      params.push(Number(lat), Number(lng), radius);

      const latIndex = params.length - 2;
      const lngIndex = params.length - 1;
      const radiusIndex = params.length;

      const distanceExpression = `
        (
          6371 * 2 * ASIN(SQRT(LEAST(1, GREATEST(0,
            POWER(
              SIN(RADIANS(latitude - $${latIndex}) / 2),
              2
            ) +
            COS(RADIANS($${latIndex})) *
            COS(RADIANS(latitude)) *
            POWER(
              SIN(RADIANS(longitude - $${lngIndex}) / 2),
              2
            )
          ))))
        )
      `;

      distanceSelect =
        `${distanceExpression} AS distance_km`;

      conditions.push(
        "latitude IS NOT NULL AND longitude IS NOT NULL"
      );

      conditions.push(
        `${distanceExpression} <= $${radiusIndex}`
      );
    }

    const sql = `
      SELECT
        id,
        title,
        description,
        category,
        audio_url,
        duration_seconds,
        latitude,
        longitude,
        created_at,
        ${distanceSelect}
      FROM audio_posts
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${
        hasLat && hasLng
          ? "distance_km ASC NULLS LAST, "
          : ""
      }created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(sql, params);

    res.json({
      posts: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error(
      "GET /api/posts failed:",
      error.message
    );

    res.status(500).json({
      error: "Could not fetch audio posts.",
    });
  }
});
// Create a new audio post directly using JSON.
app.post("/api/posts", async (req, res) => {
  const {
    title,
    description = "",
    category,
    audioUrl,
    durationSeconds = 0,
    latitude,
    longitude,
  } = req.body || {};

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 100
  ) {
    return res.status(400).json({
      error: "Title is required and must be under 100 characters.",
    });
  }

  if (
    typeof description !== "string" ||
    description.length > 500
  ) {
    return res.status(400).json({
      error: "Description must be under 500 characters.",
    });
  }

  if (!allowedCategories.has(category)) {
    return res.status(400).json({
      error: "Please choose a valid category.",
    });
  }

  if (
    typeof audioUrl !== "string" ||
    !/^https:\/\/.+/i.test(audioUrl)
  ) {
    return res.status(400).json({
      error: "A valid HTTPS audio URL is required.",
    });
  }

  const duration = Number(durationSeconds);

  if (
    !Number.isFinite(duration) ||
    duration < 0 ||
    duration > 86400
  ) {
    return res.status(400).json({
      error: "Invalid audio duration.",
    });
  }

  const coords = parseCoordinates(latitude, longitude);

  if (coords.error) {
    return res.status(400).json({
      error: coords.error,
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO audio_posts
        (
          title,
          description,
          category,
          audio_url,
          duration_seconds,
          latitude,
          longitude,
          is_published
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING *`,
      [
        title.trim(),
        description.trim(),
        category,
        audioUrl,
        Math.floor(duration),
        coords.lat,
        coords.lng,
      ]
    );

    res.status(201).json({
      post: result.rows[0],
    });
  } catch (error) {
    console.error("Create post error:", error.message);

    res.status(500).json({
      error: "Could not create the audio post.",
    });
  }
});


// Upload an audio file and create a post.
app.post(
  "/api/posts/upload",
  upload.single("audio"),
  async (req, res) => {
    let uploadedAsset;

    try {
      const {
        title,
        description = "",
        category,
        durationSeconds = 0,
        latitude,
        longitude,
      } = req.body || {};

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 100
      ) {
        return res.status(400).json({
          error: "Title is required and must be under 100 characters.",
        });
      }

      if (
        typeof description !== "string" ||
        description.length > 500
      ) {
        return res.status(400).json({
          error: "Description must be under 500 characters.",
        });
      }

      if (!allowedCategories.has(category)) {
        return res.status(400).json({
          error: "Invalid audio category.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Please select an audio file.",
        });
      }

      const duration = Number(durationSeconds);

      if (
        !Number.isFinite(duration) ||
        duration < 0 ||
        duration > 86400
      ) {
        return res.status(400).json({
          error: "Invalid audio duration.",
        });
      }

      const coords = parseCoordinates(latitude, longitude);

      if (coords.error) {
        return res.status(400).json({
          error: coords.error,
        });
      }

      uploadedAsset = await uploadAudioToCloudinary(req.file);

      const result = await pool.query(
        `INSERT INTO audio_posts
          (
            title,
            description,
            category,
            audio_url,
            duration_seconds,
            latitude,
            longitude,
            is_published
          )
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         RETURNING *`,
        [
          title.trim(),
          description.trim(),
          category,
          uploadedAsset.secure_url,
          Math.floor(duration),
          coords.lat,
          coords.lng,
        ]
      );

      return res.status(201).json({
        message: "Audio uploaded successfully.",
        post: result.rows[0],
      });
    } catch (error) {
      console.error("Audio upload error:", error.message);

      // Remove the Cloudinary upload if database insertion failed.
      if (uploadedAsset?.public_id) {
        try {
          await cloudinary.uploader.destroy(
            uploadedAsset.public_id,
            { resource_type: "video" }
          );
        } catch (cleanupError) {
          console.error(
            "Cloudinary cleanup error:",
            cleanupError.message
          );
        }
      }

      return res.status(500).json({
        error: "Could not upload and save the audio.",
      });
    }
  }
);


// Edit an existing post.
app.patch("/api/posts/:id", async (req, res) => {
  const id = req.params.id;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: "Invalid post ID.",
    });
  }

  const {
    title,
    description,
    category,
  } = req.body || {};

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 100
  ) {
    return res.status(400).json({
      error: "Title is required and must be under 100 characters.",
    });
  }

  if (
    typeof description !== "string" ||
    description.length > 500
  ) {
    return res.status(400).json({
      error: "Description must be under 500 characters.",
    });
  }

  if (!allowedCategories.has(category)) {
    return res.status(400).json({
      error: "Invalid category.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE audio_posts
       SET title = $1,
           description = $2,
           category = $3
       WHERE id = $4
       RETURNING *`,
      [
        title.trim(),
        description.trim(),
        category,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Audio post not found.",
      });
    }

    res.json({
      message: "Post updated successfully.",
      post: result.rows[0],
    });
  } catch (error) {
    console.error("Edit post error:", error.message);

    res.status(500).json({
      error: "Could not update the audio post.",
    });
  }
});
// ============================================
// DELETE AUDIO POST
// ============================================

app.delete("/api/posts/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: "Invalid post ID.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM audio_posts
       WHERE id = $1
       RETURNING id, audio_url`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Audio post not found.",
      });
    }

    const post = result.rows[0];

    // Delete the Cloudinary asset when its public ID
    // can be determined safely from the URL.
    let warning;

    try {
      const url = new URL(post.audio_url);
      const match = url.pathname.match(
        /\/upload\/(?:v\d+\/)?(.+)$/
      );

      if (
        url.hostname === "res.cloudinary.com" &&
        match
      ) {
        const publicId = match[1].replace(/\.[^.]+$/, "");

        await cloudinary.uploader.destroy(publicId, {
          resource_type: "video",
        });
      }
    } catch (cleanupError) {
      console.error(
        "Cloudinary deletion error:",
        cleanupError.message
      );

      warning =
        "Post deleted, but the audio file may remain in Cloudinary.";
    }

    return res.json({
      message: "Audio post deleted successfully.",
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    console.error("Delete post error:", error.message);

    return res.status(500).json({
      error: "Could not delete the audio post.",
    });
  }
});


// ============================================
// GET COMMENTS FOR A POST
// ============================================

app.get("/api/posts/:id/comments", async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: "Invalid post ID.",
    });
  }

  try {
    await ensureCommunityTables();

    const postResult = await pool.query(
      `SELECT id
       FROM audio_posts
       WHERE id = $1 AND is_published = TRUE`,
      [id]
    );

    if (postResult.rowCount === 0) {
      return res.status(404).json({
        error: "Audio post not found.",
      });
    }

    const result = await pool.query(
      `SELECT id, post_id, name, body, created_at
       FROM post_comments
       WHERE post_id = $1
       ORDER BY created_at ASC
       LIMIT 200`,
      [id]
    );

    return res.json({
      comments: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Fetch comments error:", error.message);

    return res.status(500).json({
      error: "Could not load comments.",
    });
  }
});


// ============================================
// ADD A COMMENT
// ============================================

app.post("/api/posts/:id/comments", async (req, res) => {
  const { id } = req.params;

  const {
    name = "Guest",
    body,
  } = req.body || {};

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: "Invalid post ID.",
    });
  }

  if (
    typeof name !== "string" ||
    name.trim().length > 60
  ) {
    return res.status(400).json({
      error: "Name must be 60 characters or fewer.",
    });
  }

  if (
    typeof body !== "string" ||
    !body.trim() ||
    body.trim().length > 1000
  ) {
    return res.status(400).json({
      error: "Comment is required and must be under 1000 characters.",
    });
  }

  try {
    await ensureCommunityTables();

    const postResult = await pool.query(
      `SELECT id
       FROM audio_posts
       WHERE id = $1 AND is_published = TRUE`,
      [id]
    );

    if (postResult.rowCount === 0) {
      return res.status(404).json({
        error: "Audio post not found.",
      });
    }

    const result = await pool.query(
      `INSERT INTO post_comments (post_id, name, body)
       VALUES ($1, $2, $3)
       RETURNING id, post_id, name, body, created_at`,
      [
        id,
        name.trim() || "Guest",
        body.trim(),
      ]
    );

    return res.status(201).json({
      message: "Comment added successfully.",
      comment: result.rows[0],
    });
  } catch (error) {
    console.error("Add comment error:", error.message);

    return res.status(500).json({
      error: "Could not add your comment.",
    });
  }
});


// ============================================
// REPORT INAPPROPRIATE AUDIO
// ============================================

app.post("/api/posts/:id/reports", async (req, res) => {
  const { id } = req.params;

  const {
    reason,
    details = "",
  } = req.body || {};

  const validReasons = new Set([
    "Spam",
    "Harassment",
    "Inappropriate content",
    "Copyright",
    "Other",
  ]);

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: "Invalid post ID.",
    });
  }

  if (!validReasons.has(reason)) {
    return res.status(400).json({
      error: "Please select a valid report reason.",
    });
  }

  if (
    typeof details !== "string" ||
    details.length > 1000
  ) {
    return res.status(400).json({
      error: "Report details must be under 1000 characters.",
    });
  }

  try {
    await ensureCommunityTables();

    const postResult = await pool.query(
      `SELECT id
       FROM audio_posts
       WHERE id = $1 AND is_published = TRUE`,
      [id]
    );

    if (postResult.rowCount === 0) {
      return res.status(404).json({
        error: "Audio post not found.",
      });
    }

    const result = await pool.query(
      `INSERT INTO post_reports (post_id, reason, details)
       VALUES ($1, $2, $3)
       RETURNING id, post_id, reason, created_at`,
      [
        id,
        reason,
        details.trim(),
      ]
    );

    return res.status(201).json({
      message: "Report submitted successfully.",
      report: result.rows[0],
    });
  } catch (error) {
    console.error("Submit report error:", error.message);

    return res.status(500).json({
      error: "Could not submit the report.",
    });
  }
});


// ============================================
// ERROR HANDLERS
// ============================================

app.use((req, res) => {
  res.status(404).json({
    error: "API endpoint not found.",
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error("API error:", error.message);

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Audio file must be 15 MB or smaller."
        : "Audio upload request is invalid.";

    return res.status(400).json({
      error: message,
    });
  }

  if (
    error.message === "Only audio files are allowed."
  ) {
    return res.status(400).json({
      error: error.message,
    });
  }

  return res.status(500).json({
    error: "An unexpected server error occurred.",
  });
});


// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(
    `ProxiSpeak API running at http://localhost:${PORT}`
  );
});