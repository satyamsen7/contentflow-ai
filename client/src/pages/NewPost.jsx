import { useState } from 'react';
import { Zap, Clock, CheckCircle2, XCircle, Send, CalendarClock } from 'lucide-react';
import { instantPost, schedulePost } from '../api';

const STEPS = [
  { label: 'Generating content points', desc: 'OpenRouter LLM creates 5 bullet points' },
  { label: 'Generating caption', desc: 'Title, description & hashtags' },
  { label: 'Creating Video', desc: 'AI generates visual content' },
  { label: 'Uploading to Cloudinary', desc: 'Shorts stored in cloud' },
  { label: 'Posting to Youtube', desc: 'Shorts published to your account' },
];

export default function NewPost() {
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('instant'); // 'instant' | 'scheduled'
  const [schedAt, setSchedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { success, message }

  async function handleSubmit() {
    if (!topic.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      let res;
      if (mode === 'instant') {
        res = await instantPost(topic.trim());
        setResult({ success: true, message: res.message });
      } else {
        if (!schedAt) {
          setResult({ success: false, message: 'Please select a date and time.' });
          setLoading(false);
          return;
        }
        res = await schedulePost(topic.trim(), schedAt);
        setResult({ success: true, message: res.message });
        setTopic('');
        setSchedAt('');
      }
    } catch (e) {
      setResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  }

  // Min datetime = now + 1 minute
  const minDt = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  return (
    <div className="page">
      <div className="page-header">
        <h2>New Post</h2>
        <p>Create a single post — instantly or schedule for a specific time</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left: Form */}
        <div>
          {/* Topic */}
          <div className="card mb-6">
            <div className="card-title">📝 Topic</div>
            <div className="form-group">
              <label>What should this Instagram post be about?</label>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. 5 morning habits to boost productivity…"
                rows={4}
              />
            </div>
          </div>

          {/* Mode selector */}
          <div className="card mb-6">
            <div className="card-title">📤 Post Mode</div>
            <div className="flex gap-3 mb-4">
              <button
                className={`btn ${mode === 'instant' ? 'btn-primary' : 'btn-secondary'} flex-1`}
                onClick={() => setMode('instant')}
              >
                <Zap size={15} /> Instant Post
              </button>
              <button
                className={`btn ${mode === 'scheduled' ? 'btn-accent' : 'btn-secondary'} flex-1`}
                onClick={() => setMode('scheduled')}
              >
                <CalendarClock size={15} /> Schedule
              </button>
            </div>

            {mode === 'scheduled' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Pick date & time for posting</label>
                <input
                  type="datetime-local"
                  value={schedAt}
                  min={minDt}
                  onChange={e => setSchedAt(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className={`alert alert-${result.success ? 'success' : 'error'}`}>
              {result.success
                ? <CheckCircle2 size={16} />
                : <XCircle size={16} />}
              {result.message}
            </div>
          )}

          {/* Submit */}
          <button
            className={`btn ${mode === 'instant' ? 'btn-primary' : 'btn-accent'} btn-lg w-full`}
            onClick={handleSubmit}
            disabled={loading || !topic.trim()}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Processing…</>
            ) : mode === 'instant' ? (
              <><Send size={16} /> Post Now</>
            ) : (
              <><Clock size={16} /> Schedule Post</>
            )}
          </button>

          {mode === 'instant' && !loading && (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10, textAlign: 'center' }}>
              Pipeline runs in background. Check the <strong>Logs</strong> page for real-time progress.
            </p>
          )}
        </div>

        {/* Right: Pipeline Steps Info */}
        <div>
          <div className="card">
            <div className="card-title">🔄 AI Pipeline Steps</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              When you post, these 5 steps run automatically:
            </p>
            <div className="pipeline-steps">
              {STEPS.map((step, i) => (
                <div key={i} className="pipeline-step">
                  <div className="step-num">{i + 1}</div>
                  <div className="step-text">
                    <strong>{step.label}</strong>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
