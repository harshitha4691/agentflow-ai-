import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CheckCircle2, KeyRound, Link as LinkIcon, RefreshCw } from 'lucide-react';
import AppShell from '../components/AppShell';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';

const providers = [
  ['gmail', 'Gmail API', 'Connect Google OAuth for real email send/read actions', 'Access token', 'oauth'],
  ['slack', 'Slack API', 'Connect Slack OAuth for real channel messages', 'Bot token', 'oauth'],
  ['google-sheets', 'Google Sheets API', 'Connect Google OAuth for real spreadsheet row appends', 'Access token', 'oauth'],
  ['discord', 'Discord API', 'Paste a Discord webhook URL for real notifications', 'Webhook URL', 'manual'],
  ['openrouter', 'OpenRouter API', 'Configured from server environment variables', 'Managed in .env', 'env'],
  ['gemini', 'Gemini API', 'Configured from server environment variables', 'Managed in .env', 'env']
];

function IntegrationsContent() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({});
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
    // Check for OAuth callback params
    const { connected, error } = router.query;
    if (connected) {
      setMessage(`Successfully connected ${connected}!`);
    }
    if (error) {
      setMessage(`OAuth error: ${error}`);
    }
  }, [router.query]);

  const loadData = async () => {
    try {
      const [integResp, statusResp] = await Promise.all([
        api.get('/integrations'),
        api.get('/integrations/status')
      ]);
      setItems(integResp.data.integrations || []);
      setStatus(statusResp.data.providers || {});
    } catch {
      // Silent fail on initial load
    }
  };

  const connected = new Set(items.map((item) => item.provider));

  const refreshIntegrations = async () => {
    try {
      await loadData();
      setMessage('Integrations refreshed.');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to refresh integrations.');
    }
  };

  const startOAuth = async (id, name) => {
    try {
      const { data } = await api.get(`/integrations/oauth/${id}/start`);
      if (data.url) {
        window.location.href = data.url;
      } else if (data.connected) {
        setMessage(`${name} connected successfully!`);
        loadData();
      }
    } catch (err) {
      setMessage(err.response?.data?.message || `Failed to start OAuth for ${name}. Check server configuration.`);
    }
  };

  const connectProvider = async (id, name, placeholder, mode) => {
    if (mode === 'env') {
      setMessage(`${name} is managed via server environment variables (.env file).`);
      setTimeout(() => setMessage(''), 4000);
      return;
    }
    if (mode === 'oauth') {
      await startOAuth(id, name);
      return;
    }
    // Manual mode (Discord)
    const value = drafts[id];
    if (!value) {
      setMessage(`Paste your ${placeholder} for ${name} first.`);
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      await api.post('/integrations', { provider: id, accessToken: value });
      setMessage(`${name} connected successfully!`);
      setDrafts((d) => ({ ...d, [id]: '' }));
      loadData();
    } catch (err) {
      setMessage(err.response?.data?.message || `Failed to connect ${name}.`);
    }
  };

  return (
    <AppShell title="API Integrations">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {providers.map(([id, name, description, placeholder, mode]) => {
          const oauthManaged = mode === 'oauth';
          const credential = drafts[id] || '';
          return (
            <div key={id} className="rounded border border-slate-200 bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">{name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{description}</p>
                </div>
                {connected.has(id) ? <CheckCircle2 className="text-teal-700" size={20} /> : <KeyRound className="text-slate-400" size={20} />}
              </div>
              <p className="mb-4 rounded bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                {status[id] || 'ready'}
              </p>
              {mode === 'manual' && (
                <input
                  type={id === 'discord' ? 'url' : 'password'}
                  value={credential}
                  onChange={(event) => setDrafts((current) => ({ ...current, [id]: event.target.value }))}
                  placeholder={connected.has(id) ? 'Connected - paste a new value to replace' : placeholder}
                  className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
              )}
              {oauthManaged && (
                <button
                  type="button"
                  onClick={() => startOAuth(id, name)}
                  className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  <LinkIcon size={15} />
                  {connected.has(id) ? 'Reconnect OAuth' : 'Connect OAuth'}
                </button>
              )}
              <button
                type="button"
                onClick={() => connectProvider(id, name, placeholder, mode)}
                className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw size={15} />
                {mode === 'manual' ? (connected.has(id) ? 'Reconnect' : 'Connect') : 'Refresh Status'}
              </button>
            </div>
          );
        })}
      </div>
      {message && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900">
          <p>{message}</p>
          <button type="button" onClick={refreshIntegrations} className="rounded border border-teal-200 px-3 py-1 text-xs font-semibold hover:bg-white">
            Refresh
          </button>
        </div>
      )}
    </AppShell>
  );
}

export default function IntegrationsPage() {
  return (
    <ProtectedRoute>
      <IntegrationsContent />
    </ProtectedRoute>
  );
}
