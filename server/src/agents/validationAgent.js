/**
 * Validation Agent - checks that each node's output has the required fields.
 */

const NODE_REQUIRED_FIELDS = {
  'send-email': ['to', 'subject'],
  'send-slack-message': ['channel', 'message'],
  'send-discord-message': ['channel', 'message'],
  'google-sheets-row': ['spreadsheetId', 'range'],
  'http-request': ['url'],
  'ai-classification': ['result'],
  'ai-extraction': ['result'],
  'ai-summarization': ['result']
};

async function validationAgent({ node, output }) {
  const required = NODE_REQUIRED_FIELDS[node.type] || [];
  if (required.length === 0) {
    return { agent: 'validation', valid: true, missing: [], decision: 'no-requirements' };
  }

  const data = output?.data || output || {};
  const config = node.config || {};
  const combined = { ...config, ...data };

  const missing = required.filter((field) => {
    const val = combined[field];
    return val === undefined || val === null || val === '';
  });

  if (missing.length > 0) {
    return {
      agent: 'validation',
      valid: false,
      missing,
      decision: `Missing required fields: ${missing.join(', ')}. Node may produce incomplete results.`
    };
  }

  return { agent: 'validation', valid: true, missing: [], decision: 'all-fields-present' };
}

module.exports = validationAgent;
