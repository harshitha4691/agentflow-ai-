const { requestWithRetry } = require('./baseIntegration');

async function sendSlackMessage({ accessToken, channel, text }) {
  const response = await requestWithRetry({
    method: 'POST',
    url: 'https://slack.com/api/chat.postMessage',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    data: { channel, text }
  });

  if (!response.data.ok) {
    throw new Error(`Slack API error: ${response.data.error}`);
  }
  return { ts: response.data.ts, channel: response.data.channel };
}

module.exports = { sendSlackMessage };
