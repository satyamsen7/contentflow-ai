/**
 * sse.js — Server-Sent Events broadcaster
 * Keeps a set of connected SSE response objects and broadcasts log lines to all of them.
 */

const clients = new Set();

/**
 * Register a new SSE client (called from the /api/logs/stream route).
 * Returns a cleanup function to call when the connection closes.
 */
function addClient(res) {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no'  // disable nginx buffering if behind a proxy
  });

  // Send an immediate heartbeat so the browser knows the stream is open
  res.write('event: connected\ndata: ok\n\n');

  clients.add(res);
  console.log(`📡 SSE client connected (total: ${clients.size})`);

  return function cleanup() {
    clients.delete(res);
    console.log(`📡 SSE client disconnected (remaining: ${clients.size})`);
  };
}

/**
 * Broadcast a log entry to all connected SSE clients.
 * @param {Object} logRow  - full log row from the DB { id, post_id, level, message, created_at }
 */
function broadcastLog(logRow) {
  if (clients.size === 0) return;
  const payload = `event: log\ndata: ${JSON.stringify(logRow)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client); // remove dead connections
    }
  }
}

/**
 * Send a periodic heartbeat (every 20s) to keep connections alive through proxies.
 */
setInterval(() => {
  if (clients.size === 0) return;
  const heartbeat = 'event: heartbeat\ndata: ping\n\n';
  for (const client of clients) {
    try { client.write(heartbeat); } catch { clients.delete(client); }
  }
}, 20000);

module.exports = { addClient, broadcastLog };
