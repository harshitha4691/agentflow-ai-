const axios = require('axios');

async function requestWithRetry(config, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios({ ...config, timeout: config.timeout || 15000 });
      return response;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      // Don't retry on 4xx (except 429)
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }
      // Exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

module.exports = { requestWithRetry };
