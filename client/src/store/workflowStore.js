import { create } from 'zustand';
import api from '../lib/api';

function nodePosition(node, index) {
  if (node.position && Number.isFinite(node.position.x) && Number.isFinite(node.position.y)) {
    return { x: node.position.x, y: node.position.y };
  }
  const col = Math.floor(index / 4);
  const row = index % 4;
  return { x: 300 * col + 50, y: 180 * row + 50 };
}

function serverNodeToFlow(node, index = 0) {
  return {
    id: node.id,
    type: 'workflowNode',
    position: nodePosition(node, index),
    data: {
      type: node.type,
      label: node.label || node.type,
      category: node.category || 'action',
      config: node.config || {},
      status: node.status || 'idle'
    }
  };
}

function normalizeEdges(edges = [], nodes = []) {
  const nodeIds = new Set(nodes.map((n) => n.id));
  return edges
    .map((edge, i) => {
      const source = typeof edge.source === 'object' ? edge.source.id || edge.source : String(edge.source);
      const target = typeof edge.target === 'object' ? edge.target.id || edge.target : String(edge.target);
      return {
        id: edge.id || `edge-${i}-${Date.now()}`,
        source,
        target,
        animated: edge.animated !== false,
        label: edge.label || ''
      };
    })
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
}

function flowNodeToServer(node) {
  return {
    id: node.id,
    type: node.data?.type || node.type,
    label: node.data?.label || '',
    category: node.data?.category || 'action',
    position: node.position || { x: 0, y: 0 },
    config: node.data?.config || {},
    status: node.data?.status || 'idle'
  };
}

export const useWorkflowStore = create((set, get) => ({
  workflows: [],
  activeWorkflow: null,
  nodes: [],
  edges: [],
  executions: [],
  timeline: [],
  dashboard: null,
  loading: false,

  fetchDashboard: async () => {
    try {
      const { data } = await api.get('/workflows/dashboard');
      set({ dashboard: data });
    } catch {
      // Dashboard load failed silently
    }
  },

  fetchWorkflows: async () => {
    try {
      const { data } = await api.get('/workflows');
      set({ workflows: data.workflows || [] });
    } catch {
      // Workflow list load failed silently
    }
  },

  loadWorkflow: async (id) => {
    try {
      const { data } = await api.get(`/workflows/${id}`);
      const workflow = data.workflow;
      const nodes = (workflow.nodes || []).map(serverNodeToFlow);
      const edges = normalizeEdges(workflow.edges || [], nodes);
      set({ activeWorkflow: workflow, nodes, edges });
    } catch {
      // Load failed silently
    }
  },

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => {
    const { nodes } = get();
    set({ edges: normalizeEdges(edges, nodes) });
  },

  saveWorkflow: async () => {
    const { activeWorkflow, nodes, edges } = get();
    const payload = {
      name: activeWorkflow?.name || 'Untitled Workflow',
      description: activeWorkflow?.description || '',
      status: activeWorkflow?.status || 'draft',
      trigger: activeWorkflow?.trigger || { type: 'manual', config: {} },
      tags: activeWorkflow?.tags || [],
      nodes: nodes.map(flowNodeToServer),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label || '',
        animated: e.animated !== false
      }))
    };

    let workflow;
    if (activeWorkflow?._id) {
      const { data } = await api.put(`/workflows/${activeWorkflow._id}`, payload);
      workflow = data.workflow;
    } else {
      const { data } = await api.post('/workflows', payload);
      workflow = data.workflow;
    }

    const savedNodes = (workflow.nodes || []).map(serverNodeToFlow);
    const savedEdges = normalizeEdges(workflow.edges || [], savedNodes);
    set({ activeWorkflow: workflow, nodes: savedNodes, edges: savedEdges });
    get().fetchWorkflows();
    return workflow;
  },

  generateWorkflow: async (prompt) => {
    set({ loading: true });
    try {
      const { data } = await api.post('/workflows/generate', { prompt });
      const workflow = data.workflow;
      const nodes = (workflow.nodes || []).map(serverNodeToFlow);
      const edges = normalizeEdges(workflow.edges || [], nodes);
      set({ activeWorkflow: workflow, nodes, edges, executions: [], timeline: [], loading: false });
      return workflow;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  executeWorkflow: async () => {
    const { activeWorkflow, nodes } = get();
    if (!activeWorkflow?._id) return null;
    try {
      const { data } = await api.post(`/workflows/${activeWorkflow._id}/execute`);
      const execution = data.execution;

      // Mark nodes as completed/failed based on execution output
      if (execution?.output?.results) {
        const updatedNodes = nodes.map((node) => {
          const result = execution.output.results?.[node.id];
          if (result) {
            return { ...node, data: { ...node.data, status: result.error ? 'failed' : 'completed' } };
          }
          return node;
        });
        set({ nodes: updatedNodes });
      }

      set((state) => ({
        executions: [execution, ...state.executions]
      }));
      get().fetchDashboard();
      return execution;
    } catch (err) {
      throw err;
    }
  },

  fetchExecutions: async (workflowId) => {
    try {
      const url = workflowId ? `/executions?workflowId=${workflowId}` : '/executions';
      const { data } = await api.get(url);
      set({ executions: data.executions || [] });
    } catch {
      // Executions load failed silently
    }
  },

  fetchTimeline: async (executionId) => {
    try {
      const { data } = await api.get(`/executions/${executionId}/timeline`);
      set({ timeline: data.timeline || [] });
    } catch {
      // Timeline load failed silently
    }
  }
}));
