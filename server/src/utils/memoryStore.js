const { nanoid } = require('nanoid');

const collections = {
  users: [],
  workflows: [],
  executions: [],
  executionLogs: [],
  integrations: [],
  notifications: [],
  agentMemory: []
};

function now() {
  return new Date().toISOString();
}

function clone(value) {
  if (!value) return value;
  return JSON.parse(JSON.stringify(value));
}

function matches(record, filter) {
  return Object.entries(filter).every(([key, val]) => {
    if (val === undefined) return true;
    const recordVal = record[key];
    if (recordVal && typeof recordVal === 'object' && recordVal._id) {
      return String(recordVal._id) === String(val);
    }
    return String(recordVal) === String(val);
  });
}

function insert(collection, data) {
  const record = {
    ...clone(data),
    _id: data._id || nanoid(),
    createdAt: now(),
    updatedAt: now()
  };
  collections[collection].push(record);
  return clone(record);
}

function list(collection, filter = {}) {
  return collections[collection]
    .filter((record) => matches(record, filter))
    .map(clone);
}

function findOne(collection, filter = {}) {
  const record = collections[collection].find((r) => matches(r, filter));
  return record ? clone(record) : null;
}

function update(collection, id, patch) {
  const idx = collections[collection].findIndex((r) => r._id === id);
  if (idx === -1) return null;
  collections[collection][idx] = {
    ...collections[collection][idx],
    ...patch,
    _id: id,
    updatedAt: now()
  };
  return clone(collections[collection][idx]);
}

function remove(collection, id) {
  const idx = collections[collection].findIndex((r) => r._id === id);
  if (idx === -1) return false;
  collections[collection].splice(idx, 1);
  return true;
}

module.exports = { collections, insert, list, findOne, update, remove };
