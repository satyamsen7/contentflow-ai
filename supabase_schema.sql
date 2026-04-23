-- ════════════════════════════════════════════════
-- ContentFlow AI — Supabase Database Schema
-- Run this entire file in the Supabase SQL Editor
-- ════════════════════════════════════════════════

-- ── Credentials ──────────────────────────────────
CREATE TABLE IF NOT EXISTS credentials (
  id         BIGSERIAL PRIMARY KEY,
  key_name   TEXT UNIQUE NOT NULL,
  key_value  TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Topics ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS topics (
  id         BIGSERIAL PRIMARY KEY,
  topic      TEXT NOT NULL,
  source     TEXT DEFAULT 'manual',   -- 'excel' | 'manual'
  status     TEXT DEFAULT 'pending',  -- 'pending' | 'used' | 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at    TIMESTAMPTZ
);

-- ── Schedules ────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id         BIGSERIAL PRIMARY KEY,
  days       JSONB DEFAULT '[]',      -- e.g. ["Mon","Wed","Fri"]
  time       TEXT DEFAULT '09:00',
  active     BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Posts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id                  BIGSERIAL PRIMARY KEY,
  topic_id            BIGINT REFERENCES topics(id) ON DELETE SET NULL,
  topic               TEXT,
  content_points      JSONB    DEFAULT '[]',
  title               TEXT,
  description         TEXT,
  hashtags            TEXT,
  image_url           TEXT,
  instagram_media_id  TEXT,
  status              TEXT DEFAULT 'pending',  -- 'pending' | 'generating' | 'posted' | 'failed'
  scheduled_at        TIMESTAMPTZ,
  posted_at           TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Logs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
  id         BIGSERIAL PRIMARY KEY,
  post_id    BIGINT REFERENCES posts(id) ON DELETE SET NULL,
  level      TEXT DEFAULT 'info',  -- 'info' | 'warn' | 'error'
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Instagram Session Cache ───────────────────────
CREATE TABLE IF NOT EXISTS ig_session (
  id           BIGSERIAL PRIMARY KEY,
  session_data TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Performance Indexes ───────────────────────────
CREATE INDEX IF NOT EXISTS topics_status_idx       ON topics(status);
CREATE INDEX IF NOT EXISTS posts_status_idx        ON posts(status);
CREATE INDEX IF NOT EXISTS posts_scheduled_at_idx  ON posts(scheduled_at);
CREATE INDEX IF NOT EXISTS logs_post_id_idx        ON logs(post_id);
CREATE INDEX IF NOT EXISTS logs_level_idx          ON logs(level);
CREATE INDEX IF NOT EXISTS logs_created_at_idx     ON logs(created_at DESC);

-- ── Disable RLS (backend uses service role key) ───
ALTER TABLE credentials  DISABLE ROW LEVEL SECURITY;
ALTER TABLE topics       DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedules    DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts        DISABLE ROW LEVEL SECURITY;
ALTER TABLE logs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE ig_session   DISABLE ROW LEVEL SECURITY;
