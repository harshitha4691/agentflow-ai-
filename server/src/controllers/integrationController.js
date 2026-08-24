const asyncHandler = require('../utils/asyncHandler');
const integrationService = require('../services/integrationService');
const env = require('../config/env');

const list = asyncHandler(async (req, res) => {
  const integrations = await integrationService.listIntegrations(String(req.user._id));
  res.json({ integrations });
});

const upsert = asyncHandler(async (req, res) => {
  const integration = await integrationService.upsertIntegration(String(req.user._id), req.body);
  res.json({ integration });
});

const status = asyncHandler(async (_req, res) => {
  const providerStatus = integrationService.oauthStatus();
  res.json({ providers: providerStatus });
});

const startOAuth = asyncHandler(async (req, res) => {
  const result = await integrationService.startOAuth(String(req.user._id), req.params.provider);
  if (result.url) {
    res.json({ url: result.url });
  } else {
    res.json(result);
  }
});

const oauthCallback = async (req, res) => {
  try {
    const result = await integrationService.completeOAuth(req.params.provider, req.query);
    res.redirect(result.redirectUrl);
  } catch (err) {
    const errorUrl = `${env.clientUrl}/integrations?error=${encodeURIComponent(err.message)}`;
    res.redirect(errorUrl);
  }
};

const oauthError = asyncHandler(async (req, res) => {
  const error = req.query.error || 'Unknown OAuth error';
  res.redirect(`${env.clientUrl}/integrations?error=${encodeURIComponent(error)}`);
});

module.exports = { list, upsert, status, startOAuth, oauthCallback, oauthError };
