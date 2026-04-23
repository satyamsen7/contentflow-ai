import { useEffect, useState } from 'react';
import { CalendarClock, Save, Power } from 'lucide-react';
import { getSchedule, updateSchedule } from '../api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Schedule() {
  const [days,    setDays]    = useState([]);
  const [time,    setTime]    = useState('09:00');
  const [active,  setActive]  = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [alert,   setAlert]   = useState(null);

  useEffect(() => {
    getSchedule()
      .then(s => {
        if (s) {
          setDays(s.days || []);
          setTime(s.time || '09:00');
          setActive(s.active ?? false);
        }
      })
      .catch(e => showAlert('error', e.message))
      .finally(() => setLoading(false));
  }, []);

  function showAlert(type, msg) {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  }

  function toggleDay(day) {
    setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  }

  async function handleSave() {
    if (!days.length) return showAlert('error', 'Select at least one day');
    setSaving(true);
    try {
      await updateSchedule({ days, time, active });
      showAlert('success', `Schedule saved! Posts will run on ${days.join(', ')} at ${time}${active ? '' : ' (inactive)'}.`);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page loading"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Schedule</h2>
        <p>Configure which days and time to auto-post from your topic list</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Active Toggle */}
      <div className="card mb-6">
        <div className="toggle-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Power size={16} style={{ color: active ? 'var(--success)' : 'var(--text-dim)' }} />
              Auto-posting {active ? 'Enabled' : 'Disabled'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {active ? 'Pipeline will fire automatically on selected days.' : 'Toggle ON to activate the recurring schedule.'}
            </div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Day Picker */}
      <div className="card mb-6">
        <div className="card-title"><CalendarClock size={16} /> Select Days</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          Pick which days the automation will run — like setting a weekly alarm 🔔
        </p>
        <div className="day-picker">
          {DAYS.map(day => (
            <button
              key={day}
              className={`day-btn${days.includes(day) ? ' selected' : ''}`}
              onClick={() => toggleDay(day)}
            >
              {day}
            </button>
          ))}
        </div>

        {days.length > 0 && (
          <div style={{
            marginTop: 20,
            padding: '10px 16px',
            background: 'rgba(124,58,237,0.08)',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            color: 'var(--primary-lt)'
          }}>
            ✅ Selected: <strong>{days.join(' · ')}</strong>
          </div>
        )}
      </div>

      {/* Time Picker */}
      <div className="card mb-6">
        <div className="card-title">⏰ Post Time</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Set the time of day to publish (server time — IST).
        </p>
        <div style={{ maxWidth: 220 }}>
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            style={{ fontSize: 28, fontWeight: 700, padding: '14px 18px', letterSpacing: 2 }}
          />
        </div>
      </div>

      {/* Summary */}
      {days.length > 0 && (
        <div className="card mb-6" style={{ background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.2)' }}>
          <div className="card-title gradient-text">📋 Schedule Summary</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <div>📅 <strong>Days:</strong> {days.join(', ')}</div>
            <div>🕐 <strong>Time:</strong> {time} IST</div>
            <div>🔄 <strong>Action:</strong> Pick oldest pending topic → run full AI pipeline → post to Instagram</div>
            <div>📊 <strong>Status:</strong> {active ? '🟢 Active' : '🔴 Inactive'}</div>
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
        <Save size={16} />
        {saving ? 'Saving…' : 'Save Schedule'}
      </button>
    </div>
  );
}
