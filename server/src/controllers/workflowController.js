const asyncHandler = require('../utils/asyncHandler');
const workflowService = require('../services/workflowService');
const executionService = require('../services/executionService');

const ownerId = (req) => String(req.user._id);

const list = asyncHandler(async (req, res) => {
  const workflows = await workflowService.listWorkflows(ownerId(req));
  res.json({ workflows });
});

const create = asyncHandler(async (req, res) => {
  const workflow = await workflowService.createWorkflow(req.body, ownerId(req));
  res.status(201).json({ workflow });
});

const get = asyncHandler(async (req, res) => {
  const workflow = await workflowService.getWorkflow(req.params.id, ownerId(req));
  res.json({ workflow });
});

const update = asyncHandler(async (req, res) => {
  const workflow = await workflowService.updateWorkflow(req.params.id, ownerId(req), req.body);
  res.json({ workflow });
});

const duplicate = asyncHandler(async (req, res) => {
  const workflow = await workflowService.duplicateWorkflow(req.params.id, ownerId(req));
  res.status(201).json({ workflow });
});

const remove = asyncHandler(async (req, res) => {
  await workflowService.deleteWorkflow(req.params.id, ownerId(req));
  res.status(204).end();
});

const generate = asyncHandler(async (req, res) => {
  const workflow = await workflowService.generateWorkflowFromPrompt(req.body.prompt, ownerId(req));
  res.status(201).json({ workflow });
});

const execute = asyncHandler(async (req, res) => {
  const workflow = await workflowService.getWorkflow(req.params.id, ownerId(req));
  const execution = await executionService.executeWorkflow(workflow, req.body.input || {});
  res.status(202).json({ execution });
});

const dashboard = asyncHandler(async (req, res) => {
  const stats = await workflowService.dashboardStats(ownerId(req));
  res.json(stats);
});

module.exports = { list, create, get, update, duplicate, remove, generate, execute, dashboard };
