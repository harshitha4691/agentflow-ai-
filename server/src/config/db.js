const mongoose = require('mongoose');
const env = require('./env');

let usingMemoryStore = true;

async function connectDatabase() {
  if (!env.mongoUri) {
    return { status: 'memory-fallback', reason: 'MONGO_URI not configured' };
  }
  try {
    await mongoose.connect(env.mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000
    });
    usingMemoryStore = false;
    return { status: 'connected' };
  } catch (err) {
    usingMemoryStore = true;
    return { status: 'memory-fallback', reason: err.message };
  }
}

function isMemoryStore() {
  if (!usingMemoryStore && mongoose.connection.readyState !== 1) {
    return true;
  }
  return usingMemoryStore;
}

module.exports = { connectDatabase, isMemoryStore };
