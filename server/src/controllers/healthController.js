const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const { isMemoryStore } = require('../config/db');
const { getLangGraphStatus } = require('../agents/orchestrator');
const { queues, queueNames } = require('../queues');

const health = asyncHandler(async (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: isMemoryStore() ? 'memory-fallback' : 'mongodb',
    redis: env.redisUrl ? 'configured' : 'not-configured',
    queues: {
      names: queueNames,
      mode: env.redisUrl ? 'bullmq' : 'in-memory'
    },
    ai: {
      openRouter: env.openRouterApiKey ? 'configured' : 'not-configured',
      gemini: env.geminiApiKey ? 'configured' : 'not-configured'
    },
    langGraph: getLangGraphStatus()
  });
});

module.exports = { health };
