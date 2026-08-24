const axios = require('axios');
const { requestWithRetry } = require('./baseIntegration');

async function listMessages({ accessToken, maxResults = 10 }) {
  const response = await requestWithRetry({
    method: 'GET',
    url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { maxResults }
  });
  return response.data;
}

async function sendEmail({ accessToken, to, subject, body }) {
  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
  ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const response = await requestWithRetry({
    method: 'POST',
    url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    data: { raw }
  });
  return { messageId: response.data.id, threadId: response.data.threadId };
}

module.exports = { listMessages, sendEmail };
