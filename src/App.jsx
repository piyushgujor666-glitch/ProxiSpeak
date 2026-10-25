import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import SoundMap from "./SoundMap";
import {
  AudioLines,
  Compass,
  Heart,
  Bookmark,
  MessageCircle,
  Flag,
  MapPin,
  Mic,
  Navigation,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
  Pencil
} from "lucide-react";

const API_BASE_URL = "http://localhost:5000/api";

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  return `${Math.floor(seconds / 60)}:${String(
    Math.floor(seconds % 60)
  ).padStart(2, "0")}`;
}

function haversineKm(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function getCoordinates(post) {
  const lat = post.latitude;
  const lng = post.longitude;

  if (
    lat == null ||
    lng == null ||
    lat === "" ||
    lng === ""
  ) {
    return undefined;
  }

  const latitude = Number(lat);
  const longitude = Number(lng);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return undefined;
  }

  return {
    lat: latitude,
    lng: longitude
  };
}

function mapApiPost(post) {
  return {
    id: String(post.id),
    title: post.title,
    description: post.description || "",
    category: post.category,
    audioUrl: post.audio_url,
    duration: formatTime(
      Number(post.duration_seconds) || 0
    ),
    distance:
      post.distance_km == null
        ? null
        : Number(post.distance_km),
    createdAt: post.created_at
      ? new Date(post.created_at).getTime()
      : Date.now(),
    coords: getCoordinates(post),
    demo: false
  };
}

export default function App() {
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const [location, setLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState(
    "Enable location to find nearby audio"
  );

  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("Story");

  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const [playingId, setPlayingId] = useState(null);
  const [notice, setNotice] = useState("");
  const [likedIds, setLikedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("proxispeak:likes") || "[]").map(String);
    } catch {
      return [];
    }
  });
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("proxispeak:bookmarks") || "[]").map(String);
    } catch {
      return [];
    }
  });
  const [openCommentsId, setOpenCommentsId] = useState(null);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentsLoadingId, setCommentsLoadingId] = useState(null);
  const [commentNames, setCommentNames] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentSubmittingId, setCommentSubmittingId] = useState(null);
  const [reportingId, setReportingId] = useState(null);

  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const fileInput = useRef(null);

  // Fetch posts from the Express backend.
  // No location parameters: all matching posts are loaded.
  async function fetchPosts() {
    setLoadingPosts(true);

    try {
      const params = new URLSearchParams();

      if (query.trim()) {
        params.set("q", query.trim());
      }

      if (category !== "All") {
        params.set("category", category);
      }

      const response = await fetch(
        `${API_BASE_URL}/posts?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "Could not load posts."
        );
      }

      setPosts((data.posts || []).map(mapApiPost));
    } catch (error) {
      console.error("Fetch posts error:", error);

      setNotice(
        error.message || "Could not connect to backend."
      );
    } finally {
      setLoadingPosts(false);
    }
  }

  // Initial load.
  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh when the search or category changes.
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchPosts();
    }, 300);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  // Clean up recording resources.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [recordingUrl]);

  // Search, filter and sort posts locally.
  const visiblePosts = useMemo(() => {
    return posts
      .map(post => {
        if (location && post.coords) {
          return {
            ...post,
            distance: haversineKm(location, post.coords)
          };
        }

        return post;
      })
      .filter(post =>
        `${post.title} ${post.description} ${post.category}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      )
      .filter(post =>
        category === "All" ||
        post.category === category
      )
      .sort((a, b) =>
        (a.distance ?? Infinity) -
        (b.distance ?? Infinity)
      );
  }, [posts, query, category, location]);

  // Persist likes and bookmarks locally without requiring accounts.
  useEffect(() => {
    localStorage.setItem("proxispeak:likes", JSON.stringify(likedIds));
  }, [likedIds]);

  useEffect(() => {
    localStorage.setItem("proxispeak:bookmarks", JSON.stringify(bookmarkedIds));
  }, [bookmarkedIds]);

  function toggleLike(postId) {
    const id = String(postId);
    setLikedIds(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id]
    );
  }

  function toggleBookmark(postId) {
    const id = String(postId);
    setBookmarkedIds(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id]
    );
    setNotice(
      bookmarkedIds.includes(id)
        ? "Removed from your bookmarks."
        : "Saved to your bookmarks on this device."
    );
  }

  async function loadComments(postId) {
    const id = String(postId);
    setCommentsLoadingId(id);

    try {
      const response = await fetch(`${API_BASE_URL}/posts/${encodeURIComponent(id)}/comments`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load comments.");
      setCommentsByPost(current => ({ ...current, [id]: data.comments || [] }));
    } catch (error) {
      console.error("Load comments error:", error);
      setNotice(error.message || "Could not load comments.");
    } finally {
      setCommentsLoadingId(null);
    }
  }

  async function toggleComments(postId) {
    const id = String(postId);
    if (openCommentsId === id) {
      setOpenCommentsId(null);
      return;
    }
    setOpenCommentsId(id);
    if (!Object.prototype.hasOwnProperty.call(commentsByPost, id)) {
      await loadComments(id);
    }
  }

  async function submitComment(event, post) {
    event.preventDefault();
    const id = String(post.id);
    const body = (commentDrafts[id] || "").trim();
    const name = (commentNames[id] || "").trim();

    if (!body) {
      setNotice("Write a comment before submitting.");
      return;
    }
    if (body.length > 1000) {
      setNotice("Comments must be 1000 characters or fewer.");
      return;
    }

    setCommentSubmittingId(id);
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${encodeURIComponent(id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || "Guest", body })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit comment.");

      setCommentsByPost(current => ({
        ...current,
        [id]: [...(current[id] || []), data.comment]
      }));
      setCommentDrafts(current => ({ ...current, [id]: "" }));
      setNotice("Comment posted.");
    } catch (error) {
      console.error("Submit comment error:", error);
      setNotice(error.message || "Could not submit comment.");
    } finally {
      setCommentSubmittingId(null);
    }
  }

  async function reportPost(post) {
    const reason = window.prompt(
      `Why are you reporting “${post.title}”?\nEnter one: Spam, Harassment, Copyright, Dangerous, Other`,
      "Other"
    );
    if (reason === null) return;
    const allowedReasons = ["Spam", "Harassment", "Copyright", "Dangerous", "Other"];
    if (!allowedReasons.includes(reason.trim())) {
      setNotice("Choose Spam, Harassment, Copyright, Dangerous, or Other.");
      return;
    }
    const details = window.prompt("Optional details (max 1000 characters):", "");
    if (details === null) return;
    if (details.length > 1000) {
      setNotice("Report details must be 1000 characters or fewer.");
      return;
    }

    setReportingId(String(post.id));
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${encodeURIComponent(post.id)}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), details: details.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit report.");
      setNotice("Report submitted. Thank you for helping keep ProxiSpeak safe.");
    } catch (error) {
      console.error("Report post error:", error);
      setNotice(error.message || "Could not submit report.");
    } finally {
      setReportingId(null);
    }
  }

  // Request the browser's GPS location.
  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationMessage(
        "Geolocation is not supported by this browser."
      );

      setNotice("Your browser does not support location.");
      return;
    }

    setLocationMessage("Requesting your location…");

    navigator.geolocation.getCurrentPosition(
      position => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        setLocation(coords);

        setLocationMessage(
          "Location enabled · nearby audio loaded"
        );

        setNotice("Location permission granted.");
      },
      error => {
        console.error("Location error:", error);

        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage("Location permission denied.");

          setNotice(
            "Allow location access in your browser settings."
          );
        } else if (error.code === error.TIMEOUT) {
          setLocationMessage("Location request timed out.");

          setNotice(
            "Location took too long. Please try again."
          );
        } else {
          setLocationMessage("Unable to get your location.");

          setNotice(
            "Could not get your location. Please try again."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  // Start recording audio.
  async function startRecording() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      !window.MediaRecorder
    ) {
      setNotice(
        "Recording is unavailable. Use a current browser on localhost."
      );

      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true
        });

      chunks.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size) {
          chunks.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks.current, {
          type: recorder.mimeType || "audio/webm"
        });

        setRecordingBlob(blob);
        setRecordingUrl(URL.createObjectURL(blob));

        stream.getTracks().forEach(track => {
          track.stop();
        });
      };

      recorder.start();
      setRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(value => value + 1);
      }, 1000);

      setNotice(
        "Recording started. Speak, then press Stop."
      );
    } catch (error) {
      console.error("Recording error:", error);

      setNotice(
        "Microphone access failed. Check browser permissions."
      );
    }
  }

  // Stop recording.
  function stopRecording() {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = null;
    setRecording(false);
  }

  // Select an audio file from the device.
  function useAudioFile(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      setNotice("Please choose a valid audio file.");
      event.target.value = "";
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setNotice("Audio must be 15 MB or smaller.");
      event.target.value = "";
      return;
    }

    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
    }

    setRecordingBlob(file);
    setRecordingUrl(URL.createObjectURL(file));
    setRecordingTime(0);
    setNotice(`Audio selected: ${file.name}`);
  }

  // Upload audio to Cloudinary through Express.
  async function publishPost(event) {
    event.preventDefault();

    if (!title.trim()) {
      setNotice("Please add a title.");
      return;
    }

    if (!recordingBlob) {
      setNotice(
        "Record audio or select an audio file first."
      );

      return;
    }

    if (recordingBlob.size > 15 * 1024 * 1024) {
      setNotice("Audio must be 15 MB or smaller.");
      return;
    }

    // Location is required so the post has map coordinates.
    if (!location) {
      setNotice(
        "Enable your location before publishing so the post can appear on the map."
      );

      return;
    }

    const formData = new FormData();

    const extension = recordingBlob.type.includes("mp4")
      ? "m4a"
      : recordingBlob.type.includes("mpeg")
        ? "mp3"
        : "webm";

    formData.append(
      "audio",
      recordingBlob,
      `proxispeak-audio.${extension}`
    );

    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("category", selectedCategory);

    formData.append(
      "durationSeconds",
      String(recordingTime || 0)
    );

    formData.append("latitude", String(location.lat));
    formData.append("longitude", String(location.lng));

    setUploading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/posts/upload`,
        {
          method: "POST",
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "Audio upload failed."
        );
      }

      if (!data.post) {
        throw new Error(
          "Upload succeeded, but the server returned no post."
        );
      }

      const post = mapApiPost(data.post);

      setPosts(current => [
        post,
        ...current.filter(p => p.id !== post.id)
      ]);

      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }

      setTitle("");
      setDescription("");
      setSelectedCategory("Story");
      setRecordingBlob(null);
      setRecordingUrl("");
      setRecordingTime(0);

      if (fileInput.current) {
        fileInput.current.value = "";
      }

      setShowComposer(false);
      setNotice("Audio uploaded and saved successfully!");

      // Refresh the list from PostgreSQL.
      await fetchPosts();
    } catch (error) {
      console.error("Upload error:", error);

      setNotice(
        error.message || "Could not upload audio."
      );
    } finally {
      setUploading(false);
    }
  }

  // Remove the selected audio from the upload composer.
  function clearAudio() {
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
    }

    setRecordingUrl("");
    setRecordingBlob(null);
    setRecordingTime(0);

    if (fileInput.current) {
      fileInput.current.value = "";
    }
  }

  // Play or pause an audio post.
  async function playPost(post) {
    const audio = audioRef.current;

    if (!audio) {
      setNotice("Audio player is not ready.");
      return;
    }

    if (!post.audioUrl) {
      setNotice(
        "No audio URL is available for this post."
      );

      return;
    }

    if (
      String(playingId) === String(post.id) &&
      !audio.paused
    ) {
      audio.pause();
      setPlayingId(null);
      return;
    }

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = post.audioUrl;
      audio.load();

      setNotice("Loading audio…");

      await audio.play();

      setPlayingId(String(post.id));
      setNotice("");
    } catch (error) {
      console.error("Audio playback error:", error);
      console.error("Audio URL:", post.audioUrl);

      setPlayingId(null);

      setNotice(
        "Audio could not play. Check the audio URL or try again."
      );
    }
  }

  // Delete a post from PostgreSQL and attempt Cloudinary cleanup.
  async function deletePost(post) {
    const confirmed = window.confirm(
      `Delete "${post.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(String(post.id));

    try {
      // Stop playback if this post is currently playing.
      if (
        String(playingId) === String(post.id) &&
        audioRef.current
      ) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
        setPlayingId(null);
      }

      const response = await fetch(
        `${API_BASE_URL}/posts/${encodeURIComponent(post.id)}`,
        {
          method: "DELETE"
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Could not delete this audio post."
        );
      }

      // Remove the post from frontend state immediately.
      setPosts(current =>
        current.filter(
          item => String(item.id) !== String(post.id)
        )
      );

      setNotice(
        data.warning ||
        data.message ||
        "Audio post deleted successfully."
      );
    } catch (error) {
      console.error("Delete post error:", error);

      setNotice(
        error.message || "Could not delete this audio post."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // Edit the title, description, and category of a saved post.
  async function editPost(post) {
    const nextTitle = window.prompt("Edit audio title:", post.title);
    if (nextTitle === null) return;

    if (!nextTitle.trim()) {
      setNotice("Title cannot be empty.");
      return;
    }

    if (nextTitle.trim().length > 100) {
      setNotice("Title must be 100 characters or fewer.");
      return;
    }

    const nextDescription = window.prompt(
      "Edit description:",
      post.description || ""
    );
    if (nextDescription === null) return;

    if (nextDescription.length > 500) {
      setNotice("Description must be 500 characters or fewer.");
      return;
    }

    const nextCategory = window.prompt(
      "Enter category: Story, Ambience, Hidden gem, or Guide",
      post.category
    );
    if (nextCategory === null) return;

    const validCategories = [
      "Story",
      "Ambience",
      "Hidden gem",
      "Guide"
    ];

    if (!validCategories.includes(nextCategory)) {
      setNotice("Invalid category. Please choose a supported category.");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/posts/${encodeURIComponent(post.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: nextTitle.trim(),
            description: nextDescription.trim(),
            category: nextCategory
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not update audio post.");
      }

      setPosts(current =>
        current.map(item =>
          String(item.id) === String(post.id)
            ? {
                ...item,
                title: data.post.title,
                description: data.post.description || "",
                category: data.post.category
              }
            : item
        )
      );

      setNotice(data.message || "Audio post updated successfully.");
    } catch (error) {
      console.error("Edit post error:", error);
      setNotice(error.message || "Could not update audio post.");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          aria-label="ProxiSpeak home"
        >
          <span className="brand-mark">
            <AudioLines size={23} />
          </span>

          <span>
            proxi<span className="brand-accent">speak</span>
            <small>sound lives here</small>
          </span>
        </a>

        <nav className="top-links">
          <a className="active" href="#explore">
            Explore
          </a>

          <a href="#how">How it works</a>
        </nav>

        <button
          className="button button-primary top-cta"
          onClick={() => setShowComposer(true)}
        >
          <Plus size={17} /> Share audio
        </button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-glow glow-one"></div>
          <div className="hero-glow glow-two"></div>

          <div className="hero-content">
            <div className="eyebrow">
              <span className="live-dot"></span>
              AUDIO, CONNECTED TO PLACE
            </div>

            <h1>
              Every place has
              <br />
              a <span>voice.</span>
            </h1>

            <p className="hero-copy">
              Discover the stories, sounds, and little secrets
              hiding just around the corner.
            </p>

            <div className="hero-actions">
              <button
                className="button button-primary"
                onClick={requestLocation}
              >
                <Navigation size={17} /> Find audio near me
              </button>

              <button
                className="button button-ghost"
                onClick={() => setShowComposer(true)}
              >
                <Mic size={17} /> Record a moment
              </button>
            </div>

            <div className="privacy-note">
              <ShieldCheck size={15} />

              <span>
                Your location is used to find nearby audio.
              </span>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-outer"></div>
            <div className="orbit orbit-inner"></div>

            <div className="map-lines">
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>

            <div className="sound-core">
              <AudioLines size={54} />
            </div>

            <div className="sound-ring ring-a"></div>
            <div className="sound-ring ring-b"></div>

            <div className="map-pin pin-a">
              <MapPin size={19} />
            </div>

            <div className="map-pin pin-b">
              <Radio size={18} />
            </div>

            <div className="map-pin pin-c">
              <Sparkles size={17} />
            </div>

            <div className="floating-tag tag-a">
              <span className="mini-wave">▂▅▃▇▅</span>
              A story nearby
            </div>

            <div className="floating-tag tag-b">
              <span className="tag-dot"></span>
              Discover local sounds
            </div>
          </div>

          <div className="hero-bottom">
            <span>01 / LISTEN LOCAL</span>

            <span>
              FIELD NOTES FOR YOUR EARS{" "}
              <span className="arrow-down">↘</span>
            </span>
          </div>
        </section>

        <section className="explore-section" id="explore">
          <div className="section-heading">
            <div>
              <div className="eyebrow muted">
                YOUR LOCAL SOUND MAP
              </div>

              <h2>
                Listen around you<span>.</span>
              </h2>

              <p className="section-copy">
                Small moments. Real places. Voices worth hearing.
              </p>
            </div>

            <div className="location-status">
              <span className="status-dot"></span>
              <span>{locationMessage}</span>
            </div>
          </div>

          <div className="toolbar">
            <label className="search-box">
              <Search size={18} />

              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search sounds, stories, places…"
              />
            </label>

            <div className="filter-wrap">
              <Compass size={17} />

              <select
                value={category}
                onChange={event =>
                  setCategory(event.target.value)
                }
                aria-label="Filter category"
              >
                <option>All</option>
                <option>Story</option>
                <option>Ambience</option>
                <option>Hidden gem</option>
                <option>Guide</option>
              </select>
            </div>

            <button
              className="button button-outline"
              onClick={requestLocation}
            >
              <MapPin size={16} /> Use my location
            </button>
          </div>

          {bookmarkedIds.length > 0 && (
            <div className="saved-summary" style={{ margin: "0 0 16px", padding: "12px 16px", borderRadius: 12, background: "var(--muted-surface, #f8fafc)", display: "flex", alignItems: "center", gap: 8 }}>
              <Bookmark size={17} />
              <span><strong>{bookmarkedIds.length}</strong> saved bookmark{bookmarkedIds.length === 1 ? "" : "s"} on this device. Your likes and bookmarks stay in this browser and do not require an account.</span>
            </div>
          )}

          <div className="content-grid">
            <div className="audio-list">
              <div className="list-label">
                <span>NEARBY AUDIO</span>
                <span>{visiblePosts.length} MOMENTS</span>
              </div>

              {loadingPosts && (
                <p className="section-copy">
                  Loading audio moments…
                </p>
              )}

              {!loadingPosts && visiblePosts.length === 0 && (
                <div className="empty-state">
                  <AudioLines size={28} />
                  <h3>No audio found</h3>
                  <p>Try another search or category.</p>
                </div>
              )}

              {visiblePosts.map((post, index) => (
                <article
                  className="audio-card"
                  key={post.id}
                >
                  <div className={`card-art art-${index % 3}`}>
                    {index % 3 === 0 ? (
                      <Radio size={29} />
                    ) : index % 3 === 1 ? (
                      <AudioLines size={29} />
                    ) : (
                      <Sparkles size={29} />
                    )}

                    <span className="art-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="audio-info">
                    <div className="card-meta">
                      <span className="category-pill">
                        {post.category}
                      </span>

                      <span>{post.duration}</span>
                    </div>

                    <h3>{post.title}</h3>
                    <p>{post.description}</p>

                    <div className="card-bottom">
                      <span>
                        <MapPin size={13} />

                        {post.distance == null
                          ? "Distance unavailable"
                          : post.distance < 1
                            ? `${Math.round(
                                post.distance * 1000
                              )} m away`
                            : `${post.distance.toFixed(
                                1
                              )} km away`}
                      </span>

                      <span>Database post</span>
                    </div>
                  </div>

                  <div className="card-controls">
                    <button
                      type="button"
                      className="play-button"
                      onClick={() => playPost(post)}
                      aria-label={`Play ${post.title}`}
                    >
                      {String(playingId) === String(post.id) ? (
                        <Pause size={19} fill="currentColor" />
                      ) : (
                        <Play size={19} fill="currentColor" />
                      )}
                    </button>

                    {/* EDIT AUDIO BUTTON */}
                    <button
                      type="button"
                      className="icon-button edit-button"
                      onClick={() => editPost(post)}
                      aria-label={`Edit ${post.title}`}
                      title="Edit audio post"
                    >
                      <Pencil size={17} />
                    </button>

                    {/* DELETE AUDIO BUTTON */}
                    <button
                      type="button"
                      className="icon-button delete-button"
                      onClick={() => deletePost(post)}
                      disabled={deletingId === String(post.id)}
                      aria-label={`Delete ${post.title}`}
                      title={
                        deletingId === String(post.id)
                          ? "Deleting…"
                          : "Delete audio"
                      }
                    >
                      {deletingId === String(post.id)
                        ? "…"
                        : <Trash2 size={17} />}
                    </button>
                  </div>

                  <div className="community-actions" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14, width: "100%" }}>
                    <button type="button" className="button button-outline" onClick={() => toggleLike(post.id)} aria-pressed={likedIds.includes(String(post.id))} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: likedIds.includes(String(post.id)) ? "#e11d48" : undefined }}>
                      <Heart size={16} fill={likedIds.includes(String(post.id)) ? "currentColor" : "none"} />
                      {likedIds.includes(String(post.id)) ? "Liked" : "Like"}
                    </button>
                    <button type="button" className="button button-outline" onClick={() => toggleBookmark(post.id)} aria-pressed={bookmarkedIds.includes(String(post.id))} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Bookmark size={16} fill={bookmarkedIds.includes(String(post.id)) ? "currentColor" : "none"} />
                      {bookmarkedIds.includes(String(post.id)) ? "Bookmarked" : "Bookmark"}
                    </button>
                    <button type="button" className="button button-outline" onClick={() => toggleComments(post.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <MessageCircle size={16} /> Comments ({(commentsByPost[String(post.id)] || []).length})
                    </button>
                    <button type="button" className="button button-outline" onClick={() => reportPost(post)} disabled={reportingId === String(post.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Flag size={16} /> {reportingId === String(post.id) ? "Reporting…" : "Report"}
                    </button>
                  </div>

                  {openCommentsId === String(post.id) && (
                    <section className="comments-panel" aria-label={`Comments for ${post.title}`} style={{ width: "100%", marginTop: 16, padding: 16, border: "1px solid var(--border, #e5e7eb)", borderRadius: 14, background: "var(--surface, #fff)" }}>
                      <h4 style={{ marginTop: 0, marginBottom: 12 }}>Community comments</h4>
                      {commentsLoadingId === String(post.id) ? (
                        <p>Loading comments…</p>
                      ) : (commentsByPost[String(post.id)] || []).length === 0 ? (
                        <p style={{ opacity: 0.7 }}>No comments yet. Be the first to share a thought.</p>
                      ) : (
                        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                          {(commentsByPost[String(post.id)] || []).map(comment => (
                            <div key={comment.id} style={{ padding: 10, borderRadius: 10, background: "var(--muted-surface, #f8fafc)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                <strong>{comment.name || "Guest"}</strong>
                                <small>{comment.created_at ? new Date(comment.created_at).toLocaleString() : "Just now"}</small>
                              </div>
                              <p style={{ marginBottom: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{comment.body}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <form onSubmit={event => submitComment(event, post)} style={{ display: "grid", gap: 8 }}>
                        <input
                          value={commentNames[String(post.id)] || ""}
                          onChange={event => setCommentNames(current => ({ ...current, [String(post.id)]: event.target.value }))}
                          placeholder="Your name (optional)"
                          maxLength={60}
                          aria-label="Your name (optional)"
                        />
                        <textarea
                          value={commentDrafts[String(post.id)] || ""}
                          onChange={event => setCommentDrafts(current => ({ ...current, [String(post.id)]: event.target.value }))}
                          placeholder="Write a respectful comment…"
                          maxLength={1000}
                          rows={3}
                          required
                          aria-label="Write a comment"
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <small>{(commentDrafts[String(post.id)] || "").length}/1000</small>
                          <button type="submit" className="button button-primary" disabled={commentSubmittingId === String(post.id)}>
                            {commentSubmittingId === String(post.id) ? "Posting…" : "Post comment"}
                          </button>
                        </div>
                      </form>
                    </section>
                  )}
                </article>
              ))}

              <button
                className="add-card"
                onClick={() => setShowComposer(true)}
              >
                <span><Plus size={19} /></span>

                <div>
                  <strong>
                    Add your voice to this place
                  </strong>

                  <small>
                    Record or upload a short audio moment
                  </small>
                </div>

                <span className="add-arrow">↗</span>
              </button>
            </div>

            <aside className="side-column">
              <div className="map-card">
                <div className="map-card-head">
                  <div>
                    <span className="eyebrow muted">
                      SPATIAL PREVIEW
                    </span>

                    <h3>Soundscape</h3>
                  </div>

                  <span className="map-live">
                    <span className="live-dot"></span>
                    API CONNECTED
                  </span>
                </div>

                <SoundMap
                  posts={posts}
                  location={location}
                  onPlay={playPost}
                  onLocate={requestLocation}
                />
              </div>

              <div className="tip-card">
                <div className="tip-icon">
                  <Sparkles size={19} />
                </div>

                <div>
                  <strong>A little local magic</strong>

                  <p>
                    Leave a sound that helps someone see a
                    familiar place differently.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="how-section" id="how">
          <div className="eyebrow muted">
            THREE SIMPLE STEPS
          </div>

          <h2>
            Listen. Locate. <span>Connect.</span>
          </h2>

          <div className="steps">
            <div>
              <b>01</b>
              <h3>Find your place</h3>

              <p>
                Allow location access to explore audio associated
                with places.
              </p>
            </div>

            <div>
              <b>02</b>
              <h3>Press play</h3>

              <p>
                Listen to local stories, guides, and ambient moments.
              </p>
            </div>

            <div>
              <b>03</b>
              <h3>Leave a voice</h3>

              <p>
                Record a short clip and share it with the community.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <a className="brand footer-brand" href="#">
          <span className="brand-mark">
            <AudioLines size={20} />
          </span>

          <span>
            proxi<span className="brand-accent">speak</span>
            <small>sound lives here</small>
          </span>
        </a>

        <span>
          Built as a learning prototype · ProxiSpeak
        </span>

        <span>
          Made for the curious{" "}
          <span className="footer-heart">✳</span>
        </span>
      </footer>

      {notice && (
        <div className="toast" role="status">
          {notice}

          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <audio
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        onPause={() => setPlayingId(null)}
        hidden
      />

      {showComposer && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (
              event.target === event.currentTarget &&
              !uploading
            ) {
              setShowComposer(false);
            }
          }}
        >
          <section
            className="composer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="composer-title"
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow muted">
                  SHARE A LOCAL MOMENT
                </div>

                <h2 id="composer-title">
                  Give this place a voice.
                </h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowComposer(false)}
                disabled={uploading}
                aria-label="Close"
              >
                <X />
              </button>
            </div>

            <form onSubmit={publishPost}>
              <label className="field-label">
                Audio title

                <input
                  value={title}
                  onChange={event =>
                    setTitle(event.target.value)
                  }
                  placeholder="e.g. Rain on the campus roof"
                  maxLength={100}
                  required
                />
              </label>

              <label className="field-label">
                Description

                <textarea
                  value={description}
                  onChange={event =>
                    setDescription(event.target.value)
                  }
                  placeholder="What should listeners know?"
                  rows={3}
                  maxLength={500}
                />
              </label>

              <label className="field-label">
                Category

                <select
                  value={selectedCategory}
                  onChange={event =>
                    setSelectedCategory(event.target.value)
                  }
                >
                  <option>Story</option>
                  <option>Ambience</option>
                  <option>Hidden gem</option>
                  <option>Guide</option>
                </select>
              </label>

              <div className="record-panel">
                <div
                  className={`record-symbol ${
                    recording ? "is-recording" : ""
                  }`}
                >
                  <Mic size={22} />
                </div>

                <div className="record-copy">
                  <strong>
                    {recording
                      ? "Recording in progress…"
                      : recordingUrl
                        ? "Audio ready to publish"
                        : "Record your audio"}
                  </strong>

                  <span>
                    {recording
                      ? formatTime(recordingTime)
                      : recordingUrl
                        ? "Your clip is attached."
                        : "Record or upload an audio file."}
                  </span>
                </div>

                {!recording ? (
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={startRecording}
                    disabled={uploading}
                  >
                    <Mic size={16} /> Record
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={stopRecording}
                  >
                    <Pause size={16} /> Stop
                  </button>
                )}
              </div>

              <div className="upload-row">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={16} /> Upload audio instead
                </button>

                {recordingUrl && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={clearAudio}
                    disabled={uploading}
                  >
                    <Trash2 size={15} /> Remove audio
                  </button>
                )}

                <input
                  ref={fileInput}
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={useAudioFile}
                />
              </div>

              {recordingUrl && (
                <audio
                  className="audio-preview"
                  src={recordingUrl}
                  controls
                />
              )}

              <div className="location-note">
                <MapPin size={15} />

                {location
                  ? "Your current browser location will be attached."
                  : "Enable location on the main page to attach coordinates."}
              </div>

              <button
                className="button button-primary publish-button"
                type="submit"
                disabled={uploading || recording}
              >
                <Plus size={17} />

                {uploading
                  ? "Uploading audio..."
                  : "Publish audio moment"}
              </button>

              <p className="prototype-note">
                Audio uploads to Cloudinary and post metadata
                is stored in PostgreSQL. Maximum audio size: 15 MB.
              </p>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}