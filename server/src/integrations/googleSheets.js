const { requestWithRetry } = require('./baseIntegration');

async function appendRow({ accessToken, spreadsheetId, range, values }) {
  const response = await requestWithRetry({
    method: 'POST',
    url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    params: { valueInputOption: 'USER_ENTERED' },
    data: { values: Array.isArray(values[0]) ? values : [values] }
  });
  return { updatedRange: response.data.updates?.updatedRange || range };
}

async function readRange({ accessToken, spreadsheetId, range }) {
  const response = await requestWithRetry({
    method: 'GET',
    url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return { values: response.data.values || [] };
}

module.exports = { appendRow, readRange };
