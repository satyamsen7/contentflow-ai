import { useEffect, useState, useRef } from 'react';
import { Upload, Trash2, RefreshCw, Plus, FileSpreadsheet } from 'lucide-react';
import { getTopics, addTopic, deleteTopic, resetTopic, uploadTopicsExcel } from '../api';
import StatusBadge from '../components/StatusBadge';

const FILTERS = ['all', 'pending', 'used', 'failed'];

export default function Topics() {
  const [topics,   setTopics]   = useState([]);
  const [filter,   setFilter]   = useState('all');
  const [loading,  setLoading]  = useState(true);
  const [alert,    setAlert]    = useState(null);
  const [newTopic, setNewTopic] = useState('');
  const [adding,   setAdding]   = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  async function load(f = filter) {
    setLoading(true);
    try {
      const data = await getTopics(f === 'all' ? null : f);
      setTopics(data);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function showAlert(type, msg) {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  }

  async function handleFilter(f) {
    setFilter(f);
    await load(f);
  }

  async function handleUpload(file) {
    if (!file) return;
    try {
      const res = await uploadTopicsExcel(file);
      showAlert('success', res.message);
      load(filter);
    } catch (e) {
      showAlert('error', e.message);
    }
  }

  async function handleAdd() {
    if (!newTopic.trim()) return;
    setAdding(true);
    try {
      await addTopic(newTopic.trim());
      setNewTopic('');
      showAlert('success', 'Topic added!');
      load(filter);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this topic?')) return;
    try {
      await deleteTopic(id);
      setTopics(t => t.filter(x => x.id !== id));
    } catch (e) {
      showAlert('error', e.message);
    }
  }

  async function handleReset(id) {
    try {
      await resetTopic(id);
      showAlert('success', 'Topic reset to pending');
      load(filter);
    } catch (e) {
      showAlert('error', e.message);
    }
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleUpload(f);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Topics</h2>
        <p>Upload topics via Excel or add them manually</p>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>{alert.msg}</div>
      )}

      {/* Excel Upload */}
      <div className="card mb-6">
        <div className="card-title"><FileSpreadsheet size={16} /> Excel Upload</div>
        <div
          className={`upload-zone${dragging ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            ref={fileRef}
            accept=".xlsx,.xls,.csv"
            onChange={e => handleUpload(e.target.files[0])}
          />
          <div className="upload-zone-icon"><Upload size={24} /></div>
          <h3>Drop your Excel file here</h3>
          <p>Topics should be listed in <strong>Column A</strong>, one per row · .xlsx / .xls / .csv</p>
        </div>
      </div>

      {/* Manual Add */}
      <div className="card mb-6">
        <div className="card-title"><Plus size={16} /> Add Topic Manually</div>
        <div className="flex gap-3">
          <input
            className="input"
            placeholder="Enter a topic for Instagram content…"
            value={newTopic}
            onChange={e => setNewTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button className="btn btn-primary" onClick={handleAdd} disabled={adding || !newTopic.trim()}>
            {adding ? 'Adding…' : <><Plus size={14} /> Add</>}
          </button>
        </div>
      </div>

      {/* Topic Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="card-title" style={{ marginBottom: 0 }}>
            Topic List
            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400, marginLeft: 8 }}>
              ({topics.length} items)
            </span>
          </div>
          <div className="flex gap-2">
            <div className="filter-pills">
              {FILTERS.map(f => (
                <button key={f} className={`pill${filter === f ? ' active' : ''}`} onClick={() => handleFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => load(filter)}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : topics.length === 0 ? (
          <div className="empty-state">
            <FileSpreadsheet size={40} />
            <p>No topics found. Upload an Excel file or add one manually.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Topic</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((t, i) => (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--text-dim)', width: 40 }}>{i + 1}</td>
                    <td style={{ maxWidth: 300 }}>{t.topic}</td>
                    <td><StatusBadge status={t.source} /></td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>{fmtDate(t.created_at)}</td>
                    <td>
                      <div className="td-actions">
                        {t.status !== 'pending' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleReset(t.id)} title="Reset to pending">
                            <RefreshCw size={12} />
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)} title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
