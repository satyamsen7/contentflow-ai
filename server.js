// ── Force Google DNS globally (bypass ISP block on openrouter.ai, speech.bing, etc) ─
const dns = require('dns');

const originalLookup = dns.lookup;
const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

// Override dns.lookup globally so ALL libraries (axios, ws, etc) use Google DNS
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  resolver.resolve4(hostname, (err, addrs) => {
    if (err || !addrs || addrs.length === 0) {
      return originalLookup(hostname, options, callback);
    }
    if (options && options.all) {
      callback(null, addrs.map(a => ({ address: a, family: 4 })));
    } else {
      callback(null, addrs[0], 4);
    }
  });
};

require('dotenv').config();



const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDb } = require('./database');
const { initScheduler } = require('./scheduler');

const credentialsRouter = require('./routes/credentials');
const topicsRouter     = require('./routes/topics');
const postsRouter      = require('./routes/posts');
const scheduleRouter   = require('./routes/schedule');
const logsRouter       = require('./routes/logs');
const dashboardRouter  = require('./routes/dashboard');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/credentials', credentialsRouter);
app.use('/api/topics',      topicsRouter);
app.use('/api/posts',       postsRouter);
app.use('/api/schedule',    scheduleRouter);
app.use('/api/logs',        logsRouter);
app.use('/api/dashboard',   dashboardRouter);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── Production: serve React build ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
  app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, 'client/dist/index.html'))
  );
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
async function main() {
  // Try DB connection but don't crash if Supabase isn't configured yet
  try {
    await initDb();
    console.log('✅ Database connection verified');
  } catch (err) {
    console.warn('⚠️  Database not connected:', err.message);
    console.warn('   → Open http://localhost:5000 and fill in your Supabase credentials in .env to fix this.');
  }

  // Try scheduler (silently skip if DB is down)
  try {
    await initScheduler();
    console.log('✅ Scheduler initialized');
  } catch (err) {
    console.warn('⚠️  Scheduler skipped (DB not ready):', err.message);
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 ContentFlow AI server → http://localhost:${PORT}`);
    console.log(`📡 API health         → http://localhost:${PORT}/api/health`);
    console.log(`🖥️  React frontend     → http://localhost:5173\n`);
  });
}

main();
