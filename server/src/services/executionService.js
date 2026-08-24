const { isMemoryStore } = require('../config/db');
const memoryStore = require('../utils/memoryStore');
const Execution = require('../models/Execution');
const ApiError = require('../utils/apiError');
const { queues } = require('../queues');
const { runAgenticExecution } = require('../agents/orchestrator');
const { createLog, listLogs } = require('./logService');
const { createNotification } = require('./notificationService');
const { emitEvent } = require('../config/socket');

async function createExecutionRecord(workflow, input = {}) {
  const data = {
    workflow: workflow._id,
    workflowSnapshot: {
      _id: workflow._id,
      name: workflow.name,
      owner: workflow.owner,
      nodes: workflow.nodes,
      edges: workflow.edges,
      trigger: workflow.trigger
    },
    status: 'PENDING',
    currentNodeId: null,
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    input: input || {},
    output: {},
    error: null,
    retryCount: 0
  };

  if (isMemoryStore()) {
    return memoryStore.insert('executions', data);
  }
  return (await Execution.create(data)).toObject();
}

async function updateExecution(id, patch) {
  if (isMemoryStore()) {
    const updated = memoryStore.update('executions', id, patch);
    if (!updated) throw new ApiError(404, 'Execution not found');
    return updated;
  }
  const updated = await Execution.findByIdAndUpdate(id, patch, { new: true }).lean();
  if (!updated) throw new ApiError(404, 'Execution not found');
  return updated;
}

async function getExecution(id) {
  let execution;
  if (isMemoryStore()) {
    execution = memoryStore.findOne('executions', { _id: id });
  } else {
    execution = await Execution.findById(id).lean();
  }
  if (!execution) throw new ApiError(404, 'Execution not found');
  return execution;
}

async function executeWorkflow(workflow, input = {}) {
  const execution = await createExecutionRecord(workflow, input);
  const executionId = execution._id;
  const workflowId = workflow._id;

  // Queue the job (in-memory fallback just logs)
  await queues.workflowExecutionQueue.add('execute', { executionId, workflowId });

  // Mark as RUNNING
  const startedAt = new Date();
  await updateExecution(executionId, { status: 'RUNNING', startedAt: startedAt.toISOString() });

  emitEvent(`workflow:${workflowId}`, 'execution:started', { executionId, workflowId });

  try {
    // Run the agentic orchestration
    const result = await runAgenticExecution({
      workflow,
      execution,
      input,
      onEvent: async (event) => {
        await createLog({
          execution: executionId,
          workflow: workflowId,
          nodeId: event.nodeId || null,
          agent: event.agent,
          level: event.level || 'info',
          event: event.event,
          message: event.message,
          metadata: event.metadata || {}
        });
      }
    });

    // Calculate duration
    const completedAt = new Date();
    const durationMs = completedAt - startedAt;

    // Mark as COMPLETED
    const updated = await updateExecution(executionId, {
      status: 'COMPLETED',
      completedAt: completedAt.toISOString(),
      durationMs,
      output: result
    });

    // Update workflow lastExecutedAt
    if (isMemoryStore()) {
      memoryStore.update('workflows', workflowId, { lastExecutedAt: completedAt.toISOString(), status: 'active' });
    } else {
      const Workflow = require('../models/Workflow');
      await Workflow.findByIdAndUpdate(workflowId, { lastExecutedAt: completedAt, status: 'active' });
    }

    emitEvent(`workflow:${workflowId}`, 'execution:completed', { executionId, status: 'COMPLETED', durationMs });

    // Create notification
    await createNotification({
      owner: workflow.owner,
      workflow: workflowId,
      execution: executionId,
      type: 'success',
      title: `Workflow "${workflow.name}" completed`,
      message: `Execution finished in ${durationMs}ms.`
    });

    return updated;
  } catch (err) {
    const completedAt = new Date();
    const durationMs = completedAt - startedAt;

    const updated = await updateExecution(executionId, {
      status: 'FAILED',
      completedAt: completedAt.toISOString(),
      durationMs,
      error: err.message
    });

    emitEvent(`workflow:${workflowId}`, 'execution:failed', { executionId, error: err.message });

    await createLog({
      execution: executionId,
      workflow: workflowId,
      nodeId: null,
      agent: 'orchestrator',
      level: 'error',
      event: 'execution-failed',
      message: `Execution failed: ${err.message}`
    });

    await createNotification({
      owner: workflow.owner,
      workflow: workflowId,
      execution: executionId,
      type: 'error',
      title: `Workflow "${workflow.name}" failed`,
      message: err.message
    });

    return updated;
  }
}

async function listExecutions(workflowId) {
  if (isMemoryStore()) {
    const all = memoryStore.list('executions', {});
    const filtered = workflowId
      ? all.filter((e) => String(e.workflow) === String(workflowId))
      : all;
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const filter = workflowId ? { workflow: workflowId } : {};
  return Execution.find(filter).sort({ createdAt: -1 }).lean();
}

async function pauseExecution(id) {
  const execution = await getExecution(id);
  if (execution.status !== 'RUNNING') {
    throw new ApiError(400, `Cannot pause execution with status ${execution.status}`);
  }
  return updateExecution(id, { status: 'PAUSED' });
}

async function cancelExecution(id) {
  const execution = await getExecution(id);
  if (['COMPLETED', 'CANCELLED'].includes(execution.status)) {
    throw new ApiError(400, `Cannot cancel execution with status ${execution.status}`);
  }
  return updateExecution(id, { status: 'CANCELLED', completedAt: new Date().toISOString() });
}

async function resumeExecution(id) {
  const execution = await getExecution(id);
  if (execution.status !== 'PAUSED') {
    throw new ApiError(400, `Cannot resume execution with status ${execution.status}`);
  }
  // Re-run the workflow from its snapshot
  const workflow = execution.workflowSnapshot;
  if (!workflow) throw new ApiError(400, 'No workflow snapshot available for resume');
  return executeWorkflow(workflow, execution.input || {});
}

async function executionTimeline(id) {
  await getExecution(id);
  return listLogs({ execution: id });
}

module.exports = {
  executeWorkflow,
  listExecutions,
  getExecution,
  pauseExecution,
  cancelExecution,
  resumeExecution,
  executionTimeline
};
