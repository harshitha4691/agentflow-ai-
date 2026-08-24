const { isMemoryStore } = require('../config/db');
const memoryStore = require('../utils/memoryStore');
const ExecutionLog = require('../models/ExecutionLog');
const { emitEvent } = require('../config/socket');

async function createLog({ execution, workflow, nodeId, agent, level = 'info', event, message, metadata = {} }) {
  const entry = { execution, workflow, nodeId, agent, level, event, message, metadata };

  let saved;
  if (isMemoryStore()) {
    saved = memoryStore.insert('executionLogs', entry);
  } else {
    saved = (await ExecutionLog.create(entry)).toObject();
  }

  // Emit to both execution and workflow rooms
  emitEvent(`execution:${execution}`, 'execution:log', saved);
  emitEvent(`workflow:${workflow}`, 'workflow:log', saved);

  return saved;
}

async function listLogs(filter = {}) {
  if (isMemoryStore()) {
    return memoryStore.list('executionLogs', filter)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
  return ExecutionLog.find(filter).sort({ createdAt: 1 }).lean();
}

module.exports = { createLog, listLogs };
