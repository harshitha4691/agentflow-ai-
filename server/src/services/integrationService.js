const axios = require('axios');
const jwt = require('jsonwebtoken');
const { isMemoryStore } = require('../config/db');
const env = require('../config/env');
const memoryStore = require('../utils/memoryStore');
const Integration = require('../models/Integration');
const { decrypt, encrypt } = require('../utils/crypto');

const googleOAuth = {
  gmail: {
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly'
    ]
  },
  'google-sheets': {
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  }
};

const slackScopes = ['chat:write', 'channels:read', 'groups:read'];

function safeIntegration(integration) {
  if (!integration) return null;
  const safe = { ...integration };
  delete safe.encryptedAccessToken;
  delete safe.encryptedRefreshToken;
  return safe;
}

async function listIntegrations(owner) {
  let integrations;
  if (isMemoryStore()) {
    integrations = memoryStore.list('integrations', { owner });
  } else {
    integrations = await Integration.find({ owner }).lean();
  }
  return integrations.map(safeIntegration);
}

async function getIntegration(owner, provider) {
  if (isMemoryStore()) {
    return memoryStore.findOne('integrations', { owner: String(owner), provider });
  }
  return Integration.findOne({ owner, provider }).lean();
}

async function upsertIntegration(owner, payload) {
  const { provider, accessToken, refreshToken, scopes, expiresAt, webhookUrl } = payload;
  const encrypted = {
    owner: String(owner),
    provider,
    status: 'connected',
    scopes: scopes || [],
    encryptedAccessToken: encrypt(accessToken || webhookUrl || ''),
    encryptedRefreshToken: encrypt(refreshToken || ''),
    expiresAt: expiresAt || null,
    lastError: ''
  };

  if (isMemoryStore()) {
    const existing = memoryStore.findOne('integrations', { owner: String(owner), provider });
    if (existing) {
      return safeIntegration(memoryStore.update('integrations', existing._id, encrypted));
    }
    return safeIntegration(memoryStore.insert('integrations', encrypted));
  }

  const result = await Integration.findOneAndUpdate(
    { owner, provider },
    encrypted,
    { upsert: true, new: true }
  ).lean();
  return safeIntegration(result);
}

async function refreshGoogleAccessToken(owner, provider, refreshToken) {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const { access_token, expires_in } = response.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  await upsertIntegration(owner, {
    provider,
    accessToken: access_token,
    refreshToken,
    expiresAt
  });

  return access_token;
}

async function getProviderSecret(owner, provider) {
  const integration = await getIntegration(owner, provider);
  if (!integration || integration.status !== 'connected') {
    return null;
  }

  const accessToken = decrypt(integration.encryptedAccessToken);
  const refreshToken = decrypt(integration.encryptedRefreshToken);

  if (!accessToken) {
    return null;
  }

  // Check if token is expired for Google providers
  if (['gmail', 'google-sheets'].includes(provider) && integration.expiresAt) {
    const expiry = new Date(integration.expiresAt);
    if (expiry < new Date()) {
      if (refreshToken) {
        try {
          const newToken = await refreshGoogleAccessToken(owner, provider, refreshToken);
          return { accessToken: newToken, refreshToken };
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  return { accessToken, refreshToken };
}

function callbackUrl(provider) {
  return `${env.apiBaseUrl}/api/integrations/oauth/${provider}/callback`;
}

function oauthState(owner, provider) {
  return jwt.sign({ owner: String(owner), provider }, env.jwtSecret, { expiresIn: '10m' });
}

function verifyOauthState(state, expectedProvider) {
  try {
    const decoded = jwt.verify(state, env.jwtSecret);
    if (decoded.provider !== expectedProvider) {
      throw new Error('Provider mismatch in OAuth state');
    }
    return decoded;
  } catch (err) {
    throw new Error(`Invalid OAuth state: ${err.message}`);
  }
}

async function startOAuth(owner, provider) {
  const state = oauthState(owner, provider);

  if (['gmail', 'google-sheets'].includes(provider)) {
    if (!env.googleClientId || !env.googleClientSecret) {
      throw new Error('Google OAuth client credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }
    const scopes = googleOAuth[provider]?.scopes || [];
    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(env.googleClientId)}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl(provider))}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${encodeURIComponent(state)}`;
    return { url };
  }

  if (provider === 'slack') {
    if (!env.slackClientId || !env.slackClientSecret) {
      throw new Error('Slack OAuth credentials not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.');
    }
    const url = `https://slack.com/oauth/v2/authorize?` +
      `client_id=${encodeURIComponent(env.slackClientId)}&` +
      `scope=${encodeURIComponent(slackScopes.join(','))}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl(provider))}&` +
      `state=${encodeURIComponent(state)}`;
    return { url };
  }

  if (provider === 'discord') {
    if (!env.discordBotToken) {
      throw new Error('Discord bot token not configured. Set DISCORD_BOT_TOKEN.');
    }
    // Discord uses bot tokens, not OAuth for this use case
    await upsertIntegration(owner, { provider, accessToken: env.discordBotToken });
    return { url: null, connected: true, message: 'Discord bot connected via token.' };
  }

  throw new Error(`Unsupported OAuth provider: ${provider}`);
}

async function completeOAuth(provider, query) {
  const { code, state } = query;
  if (!code || !state) throw new Error('Missing code or state parameter');

  const decoded = verifyOauthState(state, provider);
  const owner = decoded.owner;

  if (['gmail', 'google-sheets'].includes(provider)) {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: callbackUrl(provider),
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await upsertIntegration(owner, {
      provider,
      accessToken: access_token,
      refreshToken: refresh_token,
      scopes: googleOAuth[provider]?.scopes || [],
      expiresAt
    });

    return { redirectUrl: `${env.clientUrl}/integrations?connected=${provider}` };
  }

  if (provider === 'slack') {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        code,
        client_id: env.slackClientId,
        client_secret: env.slackClientSecret,
        redirect_uri: callbackUrl(provider)
      }
    });

    if (!response.data.ok) throw new Error(`Slack OAuth failed: ${response.data.error}`);

    const { access_token } = response.data;
    await upsertIntegration(owner, {
      provider,
      accessToken: access_token,
      scopes: slackScopes
    });

    return { redirectUrl: `${env.clientUrl}/integrations?connected=${provider}` };
  }

  throw new Error(`Unsupported OAuth callback provider: ${provider}`);
}

function oauthStatus() {
  return {
    gmail: env.googleClientId ? 'oauth-ready' : 'not-configured',
    'google-sheets': env.googleClientId ? 'oauth-ready' : 'not-configured',
    slack: env.slackClientId ? 'oauth-ready' : 'not-configured',
    discord: env.discordBotToken ? 'webhook-ready' : 'not-configured',
    openrouter: env.openRouterApiKey ? 'api-key' : 'not-configured',
    gemini: env.geminiApiKey ? 'api-key' : 'not-configured'
  };
}

module.exports = {
  listIntegrations,
  upsertIntegration,
  getProviderSecret,
  startOAuth,
  completeOAuth,
  oauthStatus
};
