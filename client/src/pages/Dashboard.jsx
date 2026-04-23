import { useEffect, useState } from 'react';
import {
  FileSpreadsheet, CheckCircle2, TrendingUp,
  Clock, ImageOff, CalendarClock, RefreshCw
} from 'lucide-react';
import { getDashboard } from '../api';
import StatCard    from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

export default function Dashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await getDashboard();
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="page loading"><div className="spinner" /></div>
  );

  if (error) return (
    <div className="page">
      <div className="alert alert-error">{error}</div>
    </div>
  );

  const { totalTopics, pendingTopics, postedToday, successRate, failedPosts, recentPosts, schedule } = data;

  const scheduleLabel = schedule?.active && schedule?.days?.length
    ? `${schedule.days.join(', ')} @ ${schedule.time}`
    : 'Not configured';

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>Dashboard</h2>
          <p>Overview of your Instagram automation</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(236,72,153,0.1) 100%)',
        border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px 32px',
        marginBottom: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20
      }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Recurring Schedule</div>
          <div style={{ fontSize: 20, fontWeight: 700 }} className="gradient-text">{scheduleLabel}</div>
        </div>
        <CalendarClock size={48} color="var(--primary-lt)" style={{ opacity: 0.4 }} />
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard title="Total Topics"   value={totalTopics}  icon={FileSpreadsheet} color="var(--primary-lt)"  />
        <StatCard title="Pending Topics" value={pendingTopics} icon={Clock}           color="var(--warning)"     />
        <StatCard title="Posted Today"   value={postedToday}   icon={CheckCircle2}    color="var(--success)"     />
        <StatCard title="Success Rate"   value={`${successRate}%`} icon={TrendingUp}  color="var(--accent)"
          subtitle={failedPosts > 0 ? `${failedPosts} failed` : 'No failures'} />
      </div>

      {/* Recent Posts */}
      <div className="card">
        <div className="card-title">
          <CheckCircle2 size={16} /> Recent Posts
        </div>

        {!recentPosts?.length ? (
          <div className="empty-state">
            <ImageOff size={40} />
            <p>No posts yet. Go to New Post to create your first one.</p>
          </div>
        ) : (
          <div className="posts-grid">
            {recentPosts.map(post => (
              <div key={post.id} className="post-card">
                <div className="post-card-img">
                  {(() => {
                    let thumbUrl = post.image_url;
                    if (thumbUrl && thumbUrl.includes('youtube.com/watch?v=')) {
                      try {
                        const v = new URL(thumbUrl).searchParams.get('v');
                        if (v) thumbUrl = `https://img.youtube.com/vi/${v}/hqdefault.jpg`;
                      } catch (e) {}
                    } else if (thumbUrl && thumbUrl.includes('cloudinary.com') && thumbUrl.endsWith('.mp4')) {
                      thumbUrl = thumbUrl.replace('.mp4', '.jpg');
                    }
                    
                    return thumbUrl
                      ? <img src={thumbUrl} alt={post.topic} />
                      : <ImageOff size={32} />;
                  })()}
                </div>
                <div className="post-card-body">
                  <div className="post-card-topic">{post.topic}</div>
                  <div className="flex items-center justify-between mt-2">
                    <StatusBadge status={post.status} />
                    <span className="post-card-meta">{fmt(post.posted_at || post.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
