const { nanoid } = require('nanoid');
const { isMemoryStore } = require('../config/db');
const memoryStore = require('../utils/memoryStore');
const Workflow = require('../models/Workflow');
const ApiError = require('../utils/apiError');
const { generateWorkflow } = require('./aiService');

function normalizeEdges(edges = [], nodes = []) {
  const nodeIds = new Set(nodes.map((n) => n.id));
  return edges
    .map((edge, i) => {
      const source = typeof edge.source === 'object' ? edge.source.id || edge.source : edge.source;
      const target = typeof edge.target === 'object' ? edge.target.id || edge.target : edge.target;
      return {
        id: edge.id || `edge-${i}-${nanoid(6)}`,
        source: String(source),
        target: String(target),
        label: edge.label || '',
        animated: edge.animated !== false,
        condition: edge.condition || ''
      };
    })
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
}

function normalizeWorkflow(payload, owner) {
  const nodes = (payload.nodes || [])
    .filter((n) => n && n.id)
    .map((n) => ({
      id: n.id,
      type: n.type || n.data?.type || 'action',
      label: n.label || n.data?.label || n.type || '',
      category: n.category || n.data?.category || 'action',
      position: { x: n.position?.x || 0, y: n.position?.y || 0 },
      config: n.config || n.data?.config || {},
      status: n.status || n.data?.status || 'idle'
    }));

  return {
    name: payload.name || 'Untitled Workflow',
    description: payload.description || '',
    owner,
    status: payload.status || 'draft',
    trigger: payload.trigger || { type: 'manual', config: {} },
    nodes,
    edges: normalizeEdges(payload.edges || [], nodes),
    tags: payload.tags || [],
    version: payload.version || 1
  };
}

async function createWorkflow(payload, owner) {
  const data = normalizeWorkflow(payload, owner);

  if (isMemoryStore()) {
    return memoryStore.insert('workflows', data);
  }
  return (await Workflow.create(data)).toObject();
}

async function listWorkflows(owner) {
  if (isMemoryStore()) {
    return memoryStore.list('workflows', { owner })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  return Workflow.find({ owner }).sort({ updatedAt: -1 }).lean();
}

async function getWorkflow(id, owner) {
  let workflow;
  if (isMemoryStore()) {
    workflow = memoryStore.findOne('workflows', { _id: id });
  } else {
    workflow = await Workflow.findById(id).lean();
  }
  if (!workflow) throw new ApiError(404, 'Workflow not found');
  if (String(workflow.owner) !== String(owner)) throw new ApiError(403, 'Access denied');
  return workflow;
}

async function updateWorkflow(id, owner, payload) {
  const existing = await getWorkflow(id, owner);
  const data = normalizeWorkflow({ ...existing, ...payload }, owner);
  data.version = (existing.version || 1) + 1;

  if (isMemoryStore()) {
    return memoryStore.update('workflows', id, data);
  }
  return Workflow.findByIdAndUpdate(id, data, { new: true }).lean();
}

async function duplicateWorkflow(id, owner) {
  const original = await getWorkflow(id, owner);
  const copy = {
    ...original,
    name: `${original.name} Copy`,
    status: 'draft',
    version: 1,
    lastExecutedAt: null
  };
  delete copy._id;
  delete copy.createdAt;
  delete copy.updatedAt;

  if (isMemoryStore()) {
    return memoryStore.insert('workflows', copy);
  }
  return (await Workflow.create(copy)).toObject();
}

async function deleteWorkflow(id, owner) {
  await getWorkflow(id, owner);
  if (isMemoryStore()) {
    return memoryStore.remove('workflows', id);
  }
  await Workflow.findByIdAndDelete(id);
  return true;
}

async function generateWorkflowFromPrompt(prompt, owner) {
  const graph = await generateWorkflow(prompt);
  const data = normalizeWorkflow({ ...graph, name: graph.name || prompt.slice(0, 60) }, owner);
  if (isMemoryStore()) {
    return memoryStore.insert('workflows', data);
  }
  return (await Workflow.create(data)).toObject();
}

async function dashboardStats(owner) {
  if (isMemoryStore()) {
    const workflows = memoryStore.list('workflows', { owner });
    const executions = memoryStore.list('executions', {});
    const ownerExecs = executions.filter((e) => {
      const snap = e.workflowSnapshot;
      return snap && String(snap.owner) === String(owner);
    });
    const notifications = memoryStore.list('notifications', { owner });

    return {
      totalWorkflows: workflows.length,
      activeWorkflows: workflows.filter((w) => w.status === 'active').length,
      failedWorkflows: ownerExecs.filter((e) => e.status === 'FAILED').length,
      aiReasoningActivity: memoryStore.list('executionLogs', {}).length,
      recentExecutions: ownerExecs
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10),
      recentNotifications: notifications
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10),
      successRate: ownerExecs.length
        ? Math.round((ownerExecs.filter((e) => e.status === 'COMPLETED').length / ownerExecs.length) * 100)
        : 0
    };
  }

  const Execution = require('../models/Execution');
  const Notification = require('../models/Notification');
  const ExecutionLog = require('../models/ExecutionLog');

  const workflows = await Workflow.find({ owner }).lean();
  const workflowIds = workflows.map((w) => w._id);
  const executions = await Execution.find({ workflow: { $in: workflowIds } })
    .sort({ createdAt: -1 }).limit(50).lean();
  const notifications = await Notification.find({ owner })
    .sort({ createdAt: -1 }).limit(10).lean();
  const logCount = await ExecutionLog.countDocuments({ workflow: { $in: workflowIds } });

  return {
    totalWorkflows: workflows.length,
    activeWorkflows: workflows.filter((w) => w.status === 'active').length,
    failedWorkflows: executions.filter((e) => e.status === 'FAILED').length,
    aiReasoningActivity: logCount,
    recentExecutions: executions.slice(0, 10),
    recentNotifications: notifications,
    successRate: executions.length
      ? Math.round((executions.filter((e) => e.status === 'COMPLETED').length / executions.length) * 100)
      : 0
  };
}

module.exports = {
  createWorkflow,
  listWorkflows,
  getWorkflow,
  updateWorkflow,
  duplicateWorkflow,
  deleteWorkflow,
  generateWorkflowFromPrompt,
  dashboardStats
};
