const ESCALATE_PATTERNS = [
  'INTEGRATION_NOT_CONNECTED',
  'MISSING_CREDENTIAL',
  'PERMISSION_DENIED',
  'SERVICE_DISABLED',
  'accessNotConfigured',
  'AUTH_EXPIRED'
];

function classifyFailure(error = {}) {
  const msg = (error.message || error.code || String(error)).toUpperCase();

  if (msg.includes('TIMEOUT') || msg.includes('ETIMEDOUT')) return 'TIMEOUT';
  if (msg.includes('RATE_LIMIT') || msg.includes('429') || msg.includes('TOO_MANY')) return 'RATE_LIMIT';
  if (msg.includes('AUTH_EXPIRED') || msg.includes('TOKEN_EXPIRED') || msg.includes('UNAUTHORIZED')) return 'AUTH_EXPIRED';
  if (msg.includes('MISSING_FIELD') || msg.includes('VALIDATION')) return 'MISSING_FIELDS';
  if (msg.includes('MALFORMED') || msg.includes('PARSE')) return 'MALFORMED_RESPONSE';
  if (msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED')) return 'TRANSIENT';
  return 'API_FAILURE';
}

function shouldEscalateImmediately(error) {
  const msg = (error.message || error.code || String(error));
  return ESCALATE_PATTERNS.some((pattern) => msg.includes(pattern));
}

function shouldRetry(error, attempt, maxRetries = 3) {
  if (shouldEscalateImmediately(error)) return false;
  if (attempt >= maxRetries) return false;
  const category = classifyFailure(error);
  const retryable = new Set(['TIMEOUT', 'RATE_LIMIT', 'TRANSIENT', 'API_FAILURE', 'MALFORMED_RESPONSE']);
  return retryable.has(category);
}

function backoffMs(attempt) {
  const base = Math.pow(2, attempt) * 1000;
  return Math.min(base, 30000);
}

module.exports = { classifyFailure, shouldRetry, shouldEscalateImmediately, backoffMs };
