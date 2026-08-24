/**
 * Monitoring Agent - emits timeline events for observability.
 */
async function monitoringAgent({ workflow, execution, step, message, metadata = {} }) {
  return {
    agent: 'monitoring',
    workflowId: workflow?._id || workflow,
    executionId: execution?._id || execution,
    step,
    message,
    metadata,
    timestamp: new Date().toISOString()
  };
}

module.exports = monitoringAgent;
