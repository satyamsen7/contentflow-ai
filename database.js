const { createClient } = require('@supabase/supabase-js');
const { broadcastLog }  = require('./sse');

let _supabase = null;

function getDb() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env — please copy .env.example to .env and fill in your Supabase credentials.'
      );
    }
    _supabase = createClient(url, key, {
      auth: { persistSession: false }
    });
  }
  return _supabase;
}

async function initDb() {
  const db = getDb();
  // Light connectivity check
  const { error } = await db.from('credentials').select('id').limit(1);
  if (error && !error.message.includes('does not exist') && !error.message.includes('relation')) {
    throw new Error(`Supabase connection failed: ${error.message}`);
  }
}

// ════════════════════════════════════════════════
// CREDENTIALS
// ════════════════════════════════════════════════

async function getCredentials() {
  const { data, error } = await getDb().from('credentials').select('*');
  if (error) throw error;
  return data || [];
}

async function getCredential(keyName) {
  const { data, error } = await getDb()
    .from('credentials').select('key_value').eq('key_name', keyName).single();
  if (error) return null;
  return data?.key_value ?? null;
}

async function upsertCredential(keyName, keyValue) {
  const { error } = await getDb().from('credentials').upsert(
    { key_name: keyName, key_value: keyValue, updated_at: new Date().toISOString() },
    { onConflict: 'key_name' }
  );
  if (error) throw error;
}

// ════════════════════════════════════════════════
// TOPICS
// ════════════════════════════════════════════════

async function getTopics(statusFilter = null) {
  let q = getDb().from('topics').select('*').order('created_at', { ascending: false });
  if (statusFilter) q = q.eq('status', statusFilter);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function insertTopics(topics, source = 'manual') {
  const rows = topics.map(topic => ({ topic, source, status: 'pending' }));
  const { data, error } = await getDb().from('topics').insert(rows).select();
  if (error) throw error;
  return data;
}

async function insertTopic(topic, source = 'manual') {
  const { data, error } = await getDb()
    .from('topics').insert({ topic, source, status: 'pending' }).select().single();
  if (error) throw error;
  return data;
}

async function updateTopicStatus(id, status) {
  const updates = {
    status,
    ...(status === 'used' ? { used_at: new Date().toISOString() } : {})
  };
  const { error } = await getDb().from('topics').update(updates).eq('id', id);
  if (error) throw error;
}

async function getNextPendingTopic() {
  const { data, error } = await getDb()
    .from('topics').select('*').eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(1).single();
  if (error) return null;
  return data;
}

async function deleteTopic(id) {
  const { error } = await getDb().from('topics').delete().eq('id', id);
  if (error) throw error;
}

async function resetTopicStatus(id) {
  const { error } = await getDb()
    .from('topics').update({ status: 'pending', used_at: null }).eq('id', id);
  if (error) throw error;
}

// ════════════════════════════════════════════════
// POSTS
// ════════════════════════════════════════════════

async function createPost(data) {
  const { data: row, error } = await getDb().from('posts').insert(data).select().single();
  if (error) throw error;
  return row;
}

async function updatePost(id, updates) {
  const { error } = await getDb().from('posts').update(updates).eq('id', id);
  if (error) throw error;
}

async function getPosts(limit = 100) {
  const { data, error } = await getDb()
    .from('posts').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

async function getPendingScheduledPosts() {
  const { data, error } = await getDb()
    .from('posts').select('*').eq('status', 'pending')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', new Date().toISOString());
  if (error) throw error;
  return data || [];
}

// ════════════════════════════════════════════════
// SCHEDULES
// ════════════════════════════════════════════════

async function getSchedule() {
  const { data, error } = await getDb()
    .from('schedules').select('*').order('id', { ascending: true }).limit(1).single();
  if (error) return null;
  return data;
}

async function upsertSchedule(days, time, active) {
  const existing = await getSchedule();
  if (existing) {
    const { error } = await getDb()
      .from('schedules').update({ days, time, active }).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await getDb().from('schedules').insert({ days, time, active });
    if (error) throw error;
  }
}

// ════════════════════════════════════════════════
// LOGS
// ════════════════════════════════════════════════

async function createLog(postId, level, message) {
  const row = {
    post_id:    postId ?? null,
    level,
    message,
    created_at: new Date().toISOString()
  };
  const { data, error } = await getDb().from('logs').insert(row).select().single();
  if (error) {
    console.error('Log write error:', error.message);
    // Still broadcast even if DB insert failed (best-effort)
    broadcastLog({ ...row, id: null });
    return;
  }
  // Push to all connected SSE clients immediately
  broadcastLog(data);
}

async function getLogs(filters = {}) {
  let q = getDb().from('logs').select('*').order('created_at', { ascending: false });
  if (filters.level)   q = q.eq('level', filters.level);
  if (filters.post_id) q = q.eq('post_id', filters.post_id);
  q = q.limit(filters.limit ?? 300);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ════════════════════════════════════════════════
// INSTAGRAM SESSION
// ════════════════════════════════════════════════

async function saveIgSession(sessionData) {
  const { data: existing } = await getDb().from('ig_session').select('id').limit(1).single();
  if (existing) {
    const { error } = await getDb().from('ig_session')
      .update({ session_data: sessionData, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await getDb().from('ig_session').insert({ session_data: sessionData });
    if (error) throw error;
  }
}

async function getIgSession() {
  const { data, error } = await getDb()
    .from('ig_session').select('session_data').limit(1).single();
  if (error) return null;
  return data?.session_data ?? null;
}

// ════════════════════════════════════════════════
// DASHBOARD STATS
// ════════════════════════════════════════════════

async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [topicsRes, postsRes, todayRes] = await Promise.all([
    getDb().from('topics').select('status'),
    getDb().from('posts').select('id, status, topic, image_url, created_at, posted_at')
      .order('created_at', { ascending: false }).limit(20),
    getDb().from('posts').select('id').gte('created_at', today.toISOString())
  ]);

  const topics    = topicsRes.data  || [];
  const posts     = postsRes.data   || [];
  const todayRows = todayRes.data   || [];

  const totalTopics   = topics.length;
  const pendingTopics = topics.filter(t => t.status === 'pending').length;
  const usedTopics    = topics.filter(t => t.status === 'used').length;
  const postedToday   = todayRows.length;
  const successPosts  = posts.filter(p => p.status === 'posted').length;
  const failedPosts   = posts.filter(p => p.status === 'failed').length;
  const successRate   = posts.length > 0
    ? Math.round((successPosts / posts.length) * 100) : 0;

  return {
    totalTopics, pendingTopics, usedTopics,
    postedToday, successRate, failedPosts,
    recentPosts: posts
  };
}

module.exports = {
  getDb, initDb,
  getCredentials, getCredential, upsertCredential,
  getTopics, insertTopics, insertTopic, updateTopicStatus,
  getNextPendingTopic, deleteTopic, resetTopicStatus,
  createPost, updatePost, getPosts, getPendingScheduledPosts,
  getSchedule, upsertSchedule,
  createLog, getLogs,
  saveIgSession, getIgSession,
  getDashboardStats
};
