/**
 * Orchestrator - coordinates the planner, execution, validation, recovery, and monitoring agents.
 */
const plannerAgent = require('./plannerAgent');
const executionAgent = require('./executionAgent');
const validationAgent = require('./validationAgent');
const recoveryAgent = require('./recoveryAgent');
const monitoringAgent = require('./monitoringAgent');

function getLangGraphStatus() {
  try {
    require('@langchain/langgraph');
    return 'available';
  } catch {
    return 'not-installed';
  }
}

async function runAgenticExecution({ workflow, execution, input = {}, onEvent }) {
  const emit = onEvent || (() => {});
  const results = {};
  const context = { input, outputs: {}, previous: {} };
  const reasoning = [];

  // Step 1: Planning
  const plan = await plannerAgent({ workflow });
  reasoning.push({ agent: 'planner', ...plan });
  await emit({
    agent: 'planner',
    level: 'info',
    event: 'plan-created',
    message: plan.decision,
    metadata: { path: plan.path, confidence: plan.confidence }
  });

  if (plan.path.length === 0) {
    await emit({
      agent: 'planner',
      level: 'warning',
      event: 'empty-plan',
      message: 'No nodes to execute. Workflow is empty.'
    });
    return { output: results, reasoning, langGraph: getLangGraphStatus() };
  }

  // Step 2: Execute each node in planned order
  const nodeMap = {};
  for (const node of workflow.nodes || []) {
    nodeMap[node.id] = node;
  }

  for (const nodeId of plan.path) {
    const node = nodeMap[nodeId];
    if (!node) continue;

    // Monitoring: start
    const monStart = await monitoringAgent({
      workflow, execution,
      step: `start:${nodeId}`,
      message: `Starting node: ${node.label || node.type} (${nodeId})`
    });
    await emit({
      agent: 'monitoring',
      level: 'info',
      event: 'node-start',
      nodeId,
      message: monStart.message,
      metadata: { nodeType: node.type, category: node.category }
    });

    try {
      // Execution
      const output = await executionAgent({ node, workflow, context });
      results[nodeId] = output;
      context.outputs[nodeId] = output.data || output;
      context.previous = output.data || output;

      // Validation
      const validation = await validationAgent({ node, output });
      reasoning.push({ agent: 'validation', nodeId, ...validation });

      if (!validation.valid) {
        await emit({
          agent: 'validation',
          level: 'warning',
          event: 'validation-warning',
          nodeId,
          message: validation.decision,
          metadata: { missing: validation.missing }
        });
      } else {
        await emit({
          agent: 'validation',
          level: 'success',
          event: 'validation-passed',
          nodeId,
          message: `Node ${node.label || nodeId} validated successfully.`
        });
      }

      // Monitoring: complete
      await emit({
        agent: 'monitoring',
        level: 'success',
        event: 'node-complete',
        nodeId,
        message: `Completed: ${node.label || node.type} (${output.simulated ? 'simulated' : 'real'})`,
        metadata: { simulated: !!output.simulated }
      });

    } catch (err) {
      // Recovery
      const recovery = await recoveryAgent({ error: err, attempt: 0, maxRetries: node.config?.retries || 3 });
      reasoning.push({ agent: 'recovery', nodeId, ...recovery });

      await emit({
        agent: 'recovery',
        level: recovery.action === 'escalate' ? 'error' : 'warning',
        event: recovery.action,
        nodeId,
        message: recovery.reason,
        metadata: { category: recovery.category, delayMs: recovery.delayMs }
      });

      if (recovery.action === 'retry_with_backoff') {
        // Retry once with backoff
        await new Promise((r) => setTimeout(r, Math.min(recovery.delayMs, 5000)));
        try {
          const retryOutput = await executionAgent({ node, workflow, context });
          results[nodeId] = retryOutput;
          context.outputs[nodeId] = retryOutput.data || retryOutput;
          context.previous = retryOutput.data || retryOutput;

          await emit({
            agent: 'monitoring',
            level: 'success',
            event: 'node-retry-success',
            nodeId,
            message: `Retry successful for ${node.label || nodeId}`
          });
        } catch (retryErr) {
          results[nodeId] = { nodeId, type: node.type, status: 'failed', error: retryErr.message };
          await emit({
            agent: 'recovery',
            level: 'error',
            event: 'escalate',
            nodeId,
            message: `Retry failed for ${node.label || nodeId}: ${retryErr.message}. Escalating.`
          });
        }
      } else {
        // Escalate immediately
        results[nodeId] = { nodeId, type: node.type, status: 'failed', error: err.message };
      }
    }
  }

  // Final monitoring event
  const completedCount = Object.values(results).filter((r) => r.status === 'completed').length;
  const failedCount = Object.values(results).filter((r) => r.status === 'failed').length;
  await emit({
    agent: 'monitoring',
    level: failedCount > 0 ? 'warning' : 'success',
    event: 'execution-summary',
    message: `Execution complete: ${completedCount} succeeded, ${failedCount} failed out of ${plan.path.length} nodes.`,
    metadata: { completedCount, failedCount, totalNodes: plan.path.length }
  });

  return { output: results, reasoning, langGraph: getLangGraphStatus() };
}

module.exports = { runAgenticExecution, getLangGraphStatus };
