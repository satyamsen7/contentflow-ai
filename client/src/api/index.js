const BASE = '/api';

async function req(path, opts = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts
    });
  } catch (fetchErr) {
    throw new Error(
      'Cannot reach the backend server. Make sure it is running on port 5000 and your .env is configured.'
    );
  }

  // Read body as text first so we never get "Unexpected end of JSON input"
  const text = await res.text();

  if (!text || !text.trim()) {
    throw new Error(`Server returned an empty response (HTTP ${res.status}). Check backend logs.`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Server returned non-JSON (HTTP ${res.status}): ${text.slice(0, 120)}`
    );
  }

  if (!data.success) throw new Error(data.error || 'Request failed');
  return data.data !== undefined ? data.data : data;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboard = () => req('/dashboard');

// ── Topics ────────────────────────────────────────────────────────────────────
export const getTopics  = (status) => req(`/topics${status ? `?status=${status}` : ''}`);
export const addTopic   = (topic)  => req('/topics', { method: 'POST', body: JSON.stringify({ topic }) });
export const deleteTopic = (id)    => req(`/topics/${id}`, { method: 'DELETE' });
export const resetTopic  = (id)    => req(`/topics/${id}/reset`, { method: 'POST' });

export const uploadTopicsExcel = async (file) => {
  const form = new FormData();
  form.append('file', file);
  let res;
  try {
    res = await fetch(`${BASE}/topics/upload`, { method: 'POST', body: form });
  } catch {
    throw new Error('Cannot reach backend server. Make sure it is running.');
  }
  const text = await res.text();
  if (!text?.trim()) throw new Error(`Empty response from server (HTTP ${res.status})`);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Non-JSON response: ${text.slice(0, 100)}`); }
  if (!data.success) throw new Error(data.error || 'Upload failed');
  return data;
};

// ── Posts ─────────────────────────────────────────────────────────────────────
export const getPosts      = ()                    => req('/posts');
export const instantPost   = (topic)               => req('/posts/instant', { method: 'POST', body: JSON.stringify({ topic }) });
export const schedulePost  = (topic, scheduledAt)  => req('/posts/schedule-one', { method: 'POST', body: JSON.stringify({ topic, scheduledAt }) });

// ── Schedule ──────────────────────────────────────────────────────────────────
export const getSchedule    = ()     => req('/schedule');
export const updateSchedule = (data) => req('/schedule', { method: 'POST', body: JSON.stringify(data) });

// ── Logs ──────────────────────────────────────────────────────────────────────
export const getLogs = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return req(`/logs${qs ? `?${qs}` : ''}`);
};

// ── Credentials ───────────────────────────────────────────────────────────────
export const getCredentials       = ()       => req('/credentials');
export const saveCredentials      = (data)   => req('/credentials', { method: 'POST', body: JSON.stringify(data) });
export const testInstagramLogin   = (u, p)   => req('/credentials/test-instagram', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
