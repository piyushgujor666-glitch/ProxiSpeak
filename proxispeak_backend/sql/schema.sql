CREATE TABLE IF NOT EXISTS audio_posts (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  category VARCHAR(40) NOT NULL CHECK (category IN ('Story', 'Ambience', 'Hidden gem', 'Guide')),
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds BETWEEN 0 AND 3600),
  latitude DOUBLE PRECISION NULL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NULL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS audio_posts_created_at_idx ON audio_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS audio_posts_category_idx ON audio_posts (category);
