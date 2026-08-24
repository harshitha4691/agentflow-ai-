const asyncHandler = require('../utils/asyncHandler');
const executionService = require('../services/executionService');

const list = asyncHandler(async (req, res) => {
  const executions = await executionService.listExecutions(req.query.workflowId || null);
  res.json({ executions });
});

const get = asyncHandler(async (req, res) => {
  const execution = await executionService.getExecution(req.params.id);
  res.json({ execution });
});

const timeline = asyncHandler(async (req, res) => {
  const logs = await executionService.executionTimeline(req.params.id);
  res.json({ timeline: logs });
});

const pause = asyncHandler(async (req, res) => {
  const execution = await executionService.pauseExecution(req.params.id);
  res.json({ execution });
});

const resume = asyncHandler(async (req, res) => {
  const execution = await executionService.resumeExecution(req.params.id);
  res.json({ execution });
});

const cancel = asyncHandler(async (req, res) => {
  const execution = await executionService.cancelExecution(req.params.id);
  res.json({ execution });
});

module.exports = { list, get, timeline, pause, resume, cancel };
