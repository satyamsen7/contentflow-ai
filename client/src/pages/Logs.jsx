import { useEffect, useState, useRef, useCallback } from 'react';
import { RefreshCw, ScrollText, Trash2, Radio } from 'lucide-react';
import { getLogs } from '../api';

const LEVEL_FILTERS = ['all', 'info', 'warn', 'error'];

function fmtTime(dt) {
  return new Date(dt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

function fmtDate(dt) {
  return new Date(dt).toLocaleDateString('en-IN', {
    month: 'short', day: '2-digit'
  });
}

function LogLine({ log }) {
  return (
    <div className={`log-line log-${log.level}`} style={{ animation: 'fadeIn 0.3s ease' }}>
      <span className="log-time" title={log.created_at}>
        {fmtDate(log.created_at)} {fmtTime(log.created_at)}
      </span>
      <span className="log-level">{log.level?.toUpperCase().slice(0, 4)}</span>
      {log.post_id && (
        <span style={{ color: 'var(--primary-lt)', flexShrink: 0, fontSize: 11 }}>
          [#{log.post_id}]
        </span>
      )}
      <span className="log-msg">{log.message}</span>
    </div>
  );
}

export default function Logs() {
  const [logs,      setLogs]      = useState([]);
  const [level,     setLevel]     = useState('all');
  const [loading,   setLoading]   = useState(true);
  const [liveOn,    setLiveOn]    = useState(true);   // SSE live mode
  const [sseStatus, setSseStatus] = useState('connecting'); // connecting | live | disconnected
  const [autoScroll, setAutoScroll] = useState(true);

  const consoleRef = useRef();
  const esRef      = useRef(null);  // EventSource ref
  const seenIds    = useRef(new Set()); // dedupe SSE + initial load

  // ── Load initial logs from REST ─────────────────────────────────────────────
  const loadInitial = useCallback(async (lv = level) => {
    setLoading(true);
    try {
      const data = await getLogs({ level: lv === 'all' ? null : lv, limit: 300 });
      seenIds.current = new Set(data.map(l => l.id));
      setLogs(data); // already newest-first from API
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [level]);

  // ── Connect SSE ─────────────────────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource('/api/logs/stream');
    esRef.current = es;
    setSseStatus('connecting');

    es.addEventListener('connected', () => setSseStatus('live'));
    es.addEventListener('heartbeat', () => {}); // keep-alive, ignore

    es.addEventListener('log', (e) => {
      try {
        const log = JSON.parse(e.data);

        // Level filter (client-side)
        if (level !== 'all' && log.level !== level) return;

        // Dedupe
        if (log.id && seenIds.current.has(log.id)) return;
        if (log.id) seenIds.current.add(log.id);

        // Prepend to top (newest first)
        setLogs(prev => [log, ...prev].slice(0, 500));
      } catch { /* ignore malformed */ }
    });

    es.onerror = () => {
      setSseStatus('disconnected');
      // Auto-reconnect after 3s
      setTimeout(() => {
        if (esRef.current === es) connectSSE();
      }, 3000);
    };
  }, [level]);

  // ── Disconnect SSE ───────────────────────────────────────────────────────────
  const disconnectSSE = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setSseStatus('disconnected');
  }, []);

  // ── On mount: load + connect ─────────────────────────────────────────────────
  useEffect(() => {
    loadInitial();
    connectSSE();
    return () => disconnectSSE();
  }, []);

  // ── Toggle live mode ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (liveOn) connectSSE();
    else disconnectSSE();
  }, [liveOn]);

  // ── Level filter — reload initial and reconnect SSE ──────────────────────────
  function handleLevel(lv) {
    setLevel(lv);
    seenIds.current.clear();
    loadInitial(lv);
    if (liveOn) {
      // close and reopen so the SSE client-side filter updates
      disconnectSSE();
      setTimeout(() => connectSSE(), 100);
    }
  }

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = 0; // newest is at top
    }
  }, [logs, autoScroll]);

  const statusColor = sseStatus === 'live' ? 'var(--success)' : sseStatus === 'connecting' ? 'var(--warning)' : 'var(--error)';
  const statusLabel = sseStatus === 'live' ? 'Live' : sseStatus === 'connecting' ? 'Connecting…' : 'Disconnected';

  return (
    <div className="page">
      <div className="page-header">
        <h2>Logs</h2>
        <p>Pipeline execution logs — streaming in real time</p>
      </div>

      {/* Toolbar */}
      <div className="card mb-4" style={{ padding: '12px 20px' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">

          {/* Level filter */}
          <div className="filter-pills">
            {LEVEL_FILTERS.map(lv => (
              <button key={lv} className={`pill${level === lv ? ' active' : ''}`} onClick={() => handleLevel(lv)}>
                {lv === 'all' ? 'All' : lv.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">

            {/* SSE status indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20,
              border: `1px solid ${statusColor}22`,
              background: `${statusColor}11`,
              fontSize: 12, fontWeight: 600, color: statusColor
            }}>
              <Radio size={12} style={{
                animation: sseStatus === 'live' ? 'pulse 1.5s infinite' : 'none'
              }} />
              {statusLabel}
            </div>

            {/* Live toggle */}
            <label className="toggle-row" style={{ padding: '5px 12px', cursor: 'pointer', gap: 8, borderRadius: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Live</span>
              <label className="toggle" style={{ width: 36, height: 20 }}>
                <input type="checkbox" checked={liveOn} onChange={e => setLiveOn(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </label>

            {/* Auto-scroll toggle */}
            <label className="toggle-row" style={{ padding: '5px 12px', cursor: 'pointer', gap: 8, borderRadius: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Auto-scroll</span>
              <label className="toggle" style={{ width: 36, height: 20 }}>
                <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </label>

            <button className="btn btn-secondary btn-sm" onClick={() => { seenIds.current.clear(); loadInitial(level); }} title="Refresh">
              <RefreshCw size={13} />
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setLogs([]); seenIds.current.clear(); }} title="Clear view">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Console */}
      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <ScrollText size={40} />
            <p>No log entries yet. Start a post to see live activity here.</p>
          </div>
        </div>
      ) : (
        <div className="log-console" ref={consoleRef}>
          {/* CSS keyframe for new entries */}
          <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }`}</style>
          {logs.map((log, i) => <LogLine key={log.id ?? `tmp-${i}`} log={log} />)}
        </div>
      )}

      <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
        {logs.length} entries
        {liveOn && sseStatus === 'live' && (
          <span style={{ color: 'var(--success)', marginLeft: 8 }}>● Streaming live</span>
        )}
      </div>
    </div>
  );
}
