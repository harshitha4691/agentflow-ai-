const { requestWithRetry } = require('./baseIntegration');

async function sendDiscordMessage({ botToken, channelId, content }) {
  const response = await requestWithRetry({
    method: 'POST',
    url: `https://discord.com/api/v10/channels/${channelId}/messages`,
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json'
    },
    data: { content }
  });
  return { messageId: response.data.id };
}

module.exports = { sendDiscordMessage };
