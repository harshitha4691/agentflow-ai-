/**
 * Recovery Agent - classifies failures and decides retry vs escalate.
 */
const { classifyFailure, shouldRetry, shouldEscalateImmediately, backoffMs } = require('../services/retryService');

async function recoveryAgent({ error, attempt, maxRetries = 3 }) {
  const category = classifyFailure(error);

  // Immediate escalation for non-recoverable errors
  if (shouldEscalateImmediately(error)) {
    return {
      agent: 'recovery',
      category,
      action: 'escalate',
      delayMs: 0,
      reason: `Non-recoverable error: ${category}. Escalating immediately.`,
      fallback: 'notify-operator'
    };
  }

  // Check if retry is appropriate
  if (shouldRetry(error, attempt, maxRetries)) {
    const delay = backoffMs(attempt);
    return {
      agent: 'recovery',
      category,
      action: 'retry_with_backoff',
      delayMs: delay,
      reason: `Retryable error (${category}). Attempt ${attempt + 1}/${maxRetries}. Backoff: ${delay}ms.`,
      fallback: ''
    };
  }

  // Max retries exhausted or non-retryable
  return {
    agent: 'recovery',
    category,
    action: 'escalate',
    delayMs: 0,
    reason: `Max retries exhausted or non-retryable error (${category}). Escalating.`,
    fallback: 'notify-operator'
  };
}

module.exports = recoveryAgent;
