/**
 * migrate.js — ContentFlow AI database migration
 * Runs the full schema on Supabase using the Management API.
 * Usage: node migrate.js
 */
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || SUPABASE_URL.includes('your-project')) {
  console.error('❌  SUPABASE_URL is still a placeholder in .env');
  process.exit(1);
}
if (!SUPABASE_KEY || SUPABASE_KEY.includes('your-supabase')) {
  console.error('❌  SUPABASE_SERVICE_KEY is still a placeholder in .env');
  process.exit(1);
}

// Extract project ref: https://XXXX.supabase.co  →  XXXX
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌  Cannot parse project ref from SUPABASE_URL:', SUPABASE_URL);
  process.exit(1);
}

// ── Full schema as one SQL string ───────────────────────────────────────────
const SCHEMA_SQL = `
-- credentials
CREATE TABLE IF NOT EXISTS credentials (
  id         BIGSERIAL PRIMARY KEY,
  key_name   TEXT UNIQUE NOT NULL,
  key_value  TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- topics
CREATE TABLE IF NOT EXISTS topics (
  id         BIGSERIAL PRIMARY KEY,
  topic      TEXT NOT NULL,
  source     TEXT DEFAULT 'manual',
  status     TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at    TIMESTAMPTZ
);

-- schedules
CREATE TABLE IF NOT EXISTS schedules (
  id         BIGSERIAL PRIMARY KEY,
  days       JSONB DEFAULT '[]',
  time       TEXT DEFAULT '09:00',
  active     BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- posts
CREATE TABLE IF NOT EXISTS posts (
  id                  BIGSERIAL PRIMARY KEY,
  topic_id            BIGINT REFERENCES topics(id) ON DELETE SET NULL,
  topic               TEXT,
  content_points      JSONB DEFAULT '[]',
  title               TEXT,
  description         TEXT,
  hashtags            TEXT,
  image_url           TEXT,
  instagram_media_id  TEXT,
  status              TEXT DEFAULT 'pending',
  scheduled_at        TIMESTAMPTZ,
  posted_at           TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- logs
CREATE TABLE IF NOT EXISTS logs (
  id         BIGSERIAL PRIMARY KEY,
  post_id    BIGINT REFERENCES posts(id) ON DELETE SET NULL,
  level      TEXT DEFAULT 'info',
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ig_session
CREATE TABLE IF NOT EXISTS ig_session (
  id           BIGSERIAL PRIMARY KEY,
  session_data TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- indexes
CREATE INDEX IF NOT EXISTS topics_status_idx      ON topics(status);
CREATE INDEX IF NOT EXISTS posts_status_idx       ON posts(status);
CREATE INDEX IF NOT EXISTS posts_scheduled_at_idx ON posts(scheduled_at);
CREATE INDEX IF NOT EXISTS logs_post_id_idx       ON logs(post_id);
CREATE INDEX IF NOT EXISTS logs_level_idx         ON logs(level);
CREATE INDEX IF NOT EXISTS logs_created_at_idx    ON logs(created_at DESC);

-- disable RLS (backend uses service role key)
ALTER TABLE credentials DISABLE ROW LEVEL SECURITY;
ALTER TABLE topics      DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedules   DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts       DISABLE ROW LEVEL SECURITY;
ALTER TABLE logs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE ig_session  DISABLE ROW LEVEL SECURITY;
`;

async function runQuery(sql) {
  // Supabase Management API: POST /v1/projects/{ref}/database/query
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    }
  );

  const text = await res.text();

  if (res.ok) return { ok: true };

  // Parse error
  let errMsg = text;
  try { errMsg = JSON.parse(text)?.message || text; } catch {}
  return { ok: false, error: errMsg, status: res.status };
}

async function migrate() {
  console.log('\n🚀  ContentFlow AI — Supabase Migration');
  console.log('━'.repeat(50));
  console.log(`📡  Project: ${projectRef}.supabase.co`);
  console.log('━'.repeat(50));

  console.log('\n⏳  Running schema via Management API...\n');

  const result = await runQuery(SCHEMA_SQL);

  if (result.ok) {
    console.log('🎉  Migration complete! All tables created successfully.\n');
    await verifyTables();
    return;
  }

  // Management API failed (requires personal access token, not service key)
  // Try the pg/query endpoint used by Supabase internally
  console.log(`⚠️   Management API returned ${result.status}: ${result.error?.slice(0, 120)}`);
  console.log('    Trying alternative endpoint...\n');

  const res2 = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: SCHEMA_SQL })
  });

  if (res2.ok) {
    console.log('🎉  Migration complete via pg endpoint!\n');
    await verifyTables();
    return;
  }

  // Neither worked — show the SQL Editor URL
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

  console.log('━'.repeat(50));
  console.log('📋  MANUAL MIGRATION — takes ~30 seconds:');
  console.log('━'.repeat(50));
  console.log('\n1️⃣   Open the Supabase SQL Editor:');
  console.log(`     ${sqlEditorUrl}\n`);
  console.log('2️⃣   Copy and paste this file:');
  console.log('     c:\\Users\\HP\\Desktop\\ContentFlow AI\\supabase_schema.sql\n');
  console.log('3️⃣   Click ▶ RUN  (top-right button)\n');
  console.log('4️⃣   Come back here and run:  node migrate.js --verify\n');
  console.log('━'.repeat(50));
}

async function verifyTables() {
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const tables = ['credentials', 'topics', 'schedules', 'posts', 'logs', 'ig_session'];
  console.log('📋  Verifying tables...\n');

  let allOk = true;
  for (const t of tables) {
    const { error } = await sb.from(t).select('id').limit(1);
    if (error && (error.code === '42P01' || error.message.includes('schema cache'))) {
      console.log(`  ❌  ${t}  — NOT FOUND`);
      allOk = false;
    } else {
      console.log(`  ✅  ${t}`);
    }
  }

  console.log('\n' + '━'.repeat(50));
  if (allOk) {
    console.log('✅  All 6 tables ready. Restart the backend server.\n');
  } else {
    console.log('⚠️   Some tables are missing. Run the schema SQL manually.\n');
  }
}

// --verify flag: just check tables without migrating
if (process.argv.includes('--verify')) {
  verifyTables().catch(console.error);
} else {
  migrate().catch(console.error);
}
