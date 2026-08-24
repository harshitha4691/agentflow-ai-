/**
 * Planner Agent - determines the execution order of nodes based on the workflow graph.
 * Uses topological sort on edges to derive execution path.
 */
async function plannerAgent({ workflow }) {
  const nodes = workflow.nodes || [];
  const edges = workflow.edges || [];

  if (nodes.length === 0) {
    return { agent: 'planner', decision: 'no-nodes', path: [], confidence: 0 };
  }

  // Build adjacency and in-degree maps
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = {};
  const adjacency = {};
  for (const id of nodeIds) {
    inDegree[id] = 0;
    adjacency[id] = [];
  }
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      adjacency[edge.source].push(edge.target);
      inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
    }
  }

  // Topological sort (Kahn's algorithm)
  const queue = [];
  for (const id of nodeIds) {
    if (inDegree[id] === 0) queue.push(id);
  }

  const path = [];
  while (queue.length > 0) {
    const current = queue.shift();
    path.push(current);
    for (const neighbor of adjacency[current]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  // If topological sort didn't include all nodes (cycle), append remaining
  for (const id of nodeIds) {
    if (!path.includes(id)) path.push(id);
  }

  const confidence = path.length === nodes.length ? 0.95 : 0.6;
  const decision = `Execute ${path.length} nodes in topological order. Triggers first, then actions/AI/logic in dependency order.`;

  return { agent: 'planner', decision, path, confidence };
}

module.exports = plannerAgent;
