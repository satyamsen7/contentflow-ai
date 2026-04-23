import { useEffect, useState } from 'react';
import { Eye, EyeOff, Save, TestTube2, KeyRound, CheckCircle2, XCircle } from 'lucide-react';

const SECTIONS = [
  {
    id: 'openrouter_text',
    title: '🤖 OpenRouter — Content (Text LLM)',
    desc: 'Generates 5 content points, title, description & hashtags. Get your key at openrouter.ai',
    fields: [
      { key: 'openrouter_api_key', label: 'API Key', type: 'password', placeholder: 'sk-or-v1-…' },
      { key: 'openrouter_model',   label: 'Model',   type: 'text',     placeholder: 'google/gemma-4-26b-a4b-it:free' }
    ],
    testButton: {
      label: 'Test OpenRouter Connection',
      endpoint: '/api/credentials/test-openrouter',
      bodyMap: { openrouter_api_key: 'api_key', openrouter_model: 'model' }
    }
  },
  {
    id: 'openrouter_image',
    title: '🎨 OpenRouter — Image Generation (FLUX)',
    desc: 'Generates background image with 5-point overlay. Can use same or a separate key.',
    fields: [
      { key: 'openrouter_image_api_key', label: 'Image API Key', type: 'password', placeholder: 'sk-or-v1-… (blank = reuse text key)' },
      { key: 'openrouter_image_model',   label: 'Image Model',   type: 'text',     placeholder: 'black-forest-labs/flux-1.1-pro' }
    ]
  },
  {
    id: 'cloudinary',
    title: '☁️ Cloudinary — Media Storage',
    desc: 'Both the image and the final video are stored here. Sign up free at cloudinary.com',
    fields: [
      { key: 'cloudinary_cloud_name', label: 'Cloud Name', type: 'text',     placeholder: 'your-cloud-name' },
      { key: 'cloudinary_api_key',    label: 'API Key',    type: 'text',     placeholder: '123456789012345' },
      { key: 'cloudinary_api_secret', label: 'API Secret', type: 'password', placeholder: 'xxxxxxxxxxxx' }
    ]
  },
  {
    id: 'youtube',
    title: '📺 YouTube — Channel Publishing',
    desc: 'OAuth2 credentials to publish the generated video. Create at console.cloud.google.com.',
    fields: [
      { key: 'youtube_client_id',     label: 'Client ID',     type: 'text',     placeholder: '123…apps.googleusercontent.com' },
      { key: 'youtube_client_secret', label: 'Client Secret', type: 'password', placeholder: 'GOCSPX-…' },
      { key: 'youtube_refresh_token', label: 'Refresh Token', type: 'password', placeholder: '1//0g…' }
    ],
    testButton: {
      label: 'Test YouTube Connection',
      endpoint: '/api/credentials/test-youtube',
      bodyMap: {
        youtube_client_id:     'client_id',
        youtube_client_secret: 'client_secret',
        youtube_refresh_token: 'refresh_token'
      }
    },
    hint: (
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--text-muted)' }}>How to get a Refresh Token:</strong><br />
        1. Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-lt)' }}>console.cloud.google.com</a> → Enable YouTube Data API v3<br />
        2. Create OAuth2 credentials (Desktop app type)<br />
        3. Use <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-lt)' }}>OAuth Playground</a> → authorize scope: <code>https://www.googleapis.com/auth/youtube.upload</code> → copy the Refresh Token
      </div>
    )
  }
];

function CredField({ field, values, revealed, onReveal, onChange }) {
  const val       = values[field.key] || '';
  const sensitive = field.type === 'password';
  const show      = revealed[field.key];

  return (
    <div className="form-group">
      <label>{field.label}</label>
      <div className="input-wrapper">
        <input
          type={sensitive && !show ? 'password' : 'text'}
          className="input"
          placeholder={field.placeholder}
          value={val}
          onChange={e => onChange(field.key, e.target.value)}
        />
        {sensitive && (
          <button className="input-icon" onClick={() => onReveal(field.key)} type="button">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Credentials() {
  const [values,  setValues]  = useState({});
  const [revealed, setRevealed] = useState({});
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(null);
  const [alert,   setAlert]   = useState(null);

  useEffect(() => {
    fetch('/api/credentials')
      .then(r => r.json())
      .then(d => { if (d.success) setValues(d.data); })
      .catch(e => showAlert('error', e.message));
  }, []);

  function showAlert(type, msg) {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 8000);
  }

  function toggleReveal(key) {
    setRevealed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleChange(key, val) {
    setValues(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res  = await fetch('/api/credentials', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(values)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showAlert('success', '✅ Credentials saved successfully!');
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(section) {
    const { endpoint, bodyMap } = section.testButton;
    const body = {};
    let missing = [];

    for (const [fieldKey, bodyKey] of Object.entries(bodyMap)) {
      const val = values[fieldKey];
      if (!val || val === '••••••••') { missing.push(fieldKey); continue; }
      body[bodyKey] = val;
    }
    if (missing.length) {
      return showAlert('error', `Fill in actual values (not masked) for: ${missing.join(', ')}`);
    }

    setTesting(section.id);
    try {
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showAlert('success', data.message || '✅ Connection successful!');
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <KeyRound size={24} color="var(--primary-lt)" />
          <div>
            <h2>Credentials</h2>
            <p>Configure API keys for content, image, video generation and YouTube publishing</p>
          </div>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {alert.msg}
        </div>
      )}

      {SECTIONS.map(section => (
        <div key={section.id} className="cred-section">
          <div className="section-title">{section.title}</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{section.desc}</p>

          <div className="card">
            <div className="cred-grid">
              {section.fields.map(field => (
                <CredField
                  key={field.key}
                  field={field}
                  values={values}
                  revealed={revealed}
                  onReveal={toggleReveal}
                  onChange={handleChange}
                />
              ))}
            </div>

            {section.hint && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                {section.hint}
              </div>
            )}

            {section.testButton && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleTest(section)}
                  disabled={testing === section.id}
                >
                  <TestTube2 size={15} />
                  {testing === section.id ? 'Testing…' : section.testButton.label}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <div style={{ position: 'sticky', bottom: 24, display: 'flex', justifyContent: 'flex-end', paddingTop: 24 }}>
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving…' : 'Save All Credentials'}
        </button>
      </div>
    </div>
  );
}
