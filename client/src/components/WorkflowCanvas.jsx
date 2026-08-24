import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow
} from '@xyflow/react';
import { CheckCircle2, Download, Play, Save, Trash2, Upload } from 'lucide-react';
import NodeConfigPanel from './NodeConfigPanel';
import NodePalette from './NodePalette';
import { useWorkflowStore } from '../store/workflowStore';

function exportJson(workflow, nodes, edges) {
  const data = JSON.stringify({ workflow, nodes, edges }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${workflow?.name || 'workflow'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const categoryStyles = {
  trigger: 'border-sky-200 bg-sky-50 text-sky-900',
  action: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  ai: 'border-violet-200 bg-violet-50 text-violet-900',
  logic: 'border-amber-200 bg-amber-50 text-amber-900'
};

const statusStyles = {
  idle: 'bg-slate-100 text-slate-600',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700'
};

function WorkflowNode({ id, data, selected, onRemove }) {
  const category = data?.category || 'action';
  const status = data?.status || 'idle';

  return (
    <div className={`min-w-48 rounded border bg-white p-3 shadow-soft ${selected ? 'ring-2 ring-teal-500' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="mb-2 flex items-start justify-between gap-3">
        <span className={`rounded border px-2 py-1 text-[11px] font-semibold uppercase ${categoryStyles[category] || categoryStyles.action}`}>
          {category}
        </span>
        <button
          type="button"
          aria-label={`Remove ${data?.label || id}`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(id);
          }}
          className="grid h-7 w-7 place-items-center rounded border border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <p className="max-w-56 text-sm font-semibold text-slate-950">{data?.label || data?.type || id}</p>
      <p className="mt-1 max-w-56 truncate text-xs text-slate-500">{data?.type}</p>
      <span className={`mt-3 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${statusStyles[status] || statusStyles.idle}`}>
        {status === 'completed' && <CheckCircle2 size={13} />}
        {status}
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function fallbackPosition(node, index) {
  if (node.position && Number.isFinite(node.position.x) && Number.isFinite(node.position.y)) {
    return { x: node.position.x, y: node.position.y };
  }
  const col = Math.floor(index / 4);
  const row = index % 4;
  return { x: 300 * col + 50, y: 180 * row + 50 };
}

function normalizeImportedNode(node, index = 0) {
  const id = node.id || `node-${Date.now()}-${index}`;
  const data = node.data || {};
  return {
    id,
    type: 'workflowNode',
    position: fallbackPosition(node, index),
    data: {
      type: data.type || node.type || 'action',
      label: data.label || node.label || node.type || id,
      category: data.category || node.category || 'action',
      config: data.config || node.config || {},
      status: data.status || node.status || 'idle'
    }
  };
}

function normalizeImportedEdges(edges = [], nodes = []) {
  const nodeIds = new Set(nodes.map((n) => n.id));
  return edges
    .map((edge, i) => {
      const source = typeof edge.source === 'object' ? edge.source.id || String(edge.source) : String(edge.source);
      const target = typeof edge.target === 'object' ? edge.target.id || String(edge.target) : String(edge.target);
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

function WorkflowCanvasInner() {
  const {
    activeWorkflow,
    nodes,
    edges,
    setNodes,
    setEdges,
    saveWorkflow,
    executeWorkflow
  } = useWorkflowStore();
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [message, setMessage] = useState('');
  const { fitView } = useReactFlow();

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2 }), 100);
    }
  }, [fitView, nodes.length, edges.length]);

  const onNodesChange = useCallback((changes) => {
    setNodes(applyNodeChanges(changes, nodes));
  }, [nodes, setNodes]);

  const onEdgesChange = useCallback((changes) => {
    const updated = applyEdgeChanges(changes, edges);
    setEdges(updated);
  }, [edges, setEdges]);

  const onConnect = useCallback((connection) => {
    const newEdges = addEdge({ ...connection, animated: true }, edges);
    setEdges(newEdges);
  }, [edges, setEdges]);

  const removeNode = useCallback((nodeId) => {
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [nodes, edges, selectedNodeId, setNodes, setEdges]);

  const nodeTypes = useMemo(() => ({
    workflowNode: (props) => <WorkflowNode {...props} onRemove={removeNode} />
  }), [removeNode]);

  const onAddNode = (node) => {
    const id = `${node.data?.type || node.type}-${Date.now()}`;
    const position = { x: 100 + nodes.length * 60, y: 100 + (nodes.length % 4) * 150 };
    const newNode = {
      id,
      type: 'workflowNode',
      position,
      data: {
        type: node.data?.type || node.type,
        label: node.data?.label || node.label || node.type,
        category: node.data?.category || node.category || 'action',
        config: node.data?.config || { retries: 3, backoffStrategy: 'exponential' },
        status: 'idle'
      }
    };
    setNodes([...nodes, newNode]);
    setMessage(`Added "${newNode.data.label}" node. Drag to position, connect edges, then Save.`);
    setTimeout(() => setMessage(''), 3000);
  };

  const onNodeUpdate = (updatedNode) => {
    setNodes(nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
  };

  const importFile = async (file) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const rawNodes = json.nodes || json.workflow?.nodes || [];
      const rawEdges = json.edges || json.workflow?.edges || [];
      const importedNodes = rawNodes.map(normalizeImportedNode);
      const importedEdges = normalizeImportedEdges(rawEdges, importedNodes);
      setNodes(importedNodes);
      setEdges(importedEdges);
      setMessage(`Imported ${importedNodes.length} nodes and ${importedEdges.length} edges`);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to import file. Check the JSON format.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleSave = async () => {
    if (nodes.length === 0) {
      setMessage('Add at least one node before saving.');
      setTimeout(() => setMessage(''), 3000);
      return null;
    }
    try {
      const wf = await saveWorkflow();
      setMessage(`Workflow "${wf.name}" saved (v${wf.version}).`);
      setTimeout(() => setMessage(''), 3000);
      return wf;
    } catch (err) {
      setMessage(`Save failed: ${err.response?.data?.message || err.message}`);
      setTimeout(() => setMessage(''), 4000);
      return null;
    }
  };

  const handleExecute = async () => {
    if (nodes.length === 0) {
      setMessage('Add nodes before executing.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      if (!activeWorkflow?._id) {
        await saveWorkflow();
      }
      const execution = await executeWorkflow();
      setMessage(`Execution ${execution?.status || 'started'}. Check timeline for details.`);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setMessage(`Execution failed: ${err.response?.data?.message || err.message}`);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-8rem)] gap-4 xl:grid-cols-[280px_1fr_320px]">
      <aside className="rounded border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Builder</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{activeWorkflow?.name || 'New Workflow'}</h2>
        </div>
        <NodePalette onAddNode={onAddNode} />
      </aside>

      <section className="overflow-hidden rounded border border-slate-200 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Visual Workflow Graph</p>
            <p className="text-xs text-slate-500">{nodes.length} nodes / {edges.length} edges</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleSave} className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Save size={15} />
              Save
            </button>
            <button type="button" onClick={handleExecute} className="inline-flex items-center gap-2 rounded bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              <Play size={15} />
              Execute
            </button>
            <button type="button" onClick={() => exportJson(activeWorkflow, nodes, edges)} className="grid h-10 w-10 place-items-center rounded border border-slate-300 text-slate-700 hover:bg-slate-50" title="Export workflow">
              <Download size={16} />
            </button>
            <label className="grid h-10 w-10 cursor-pointer place-items-center rounded border border-slate-300 text-slate-700 hover:bg-slate-50" title="Import workflow">
              <Upload size={16} />
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0])}
              />
            </label>
          </div>
        </div>
        {message && (
          <div className="border-b border-teal-100 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900">
            {message}
          </div>
        )}
        <div className="h-[720px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodesDraggable
            nodesConnectable
            elementsSelectable
            fitView
          >
            <MiniMap pannable zoomable />
            <Controls />
            <Background gap={18} />
          </ReactFlow>
        </div>
      </section>

      <aside className="space-y-4">
        <NodeConfigPanel node={selectedNode} onChange={onNodeUpdate} onRemove={removeNode} />
        <div className="rounded border border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase text-slate-500">Execution States</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
            {['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'PAUSED', 'CANCELLED'].map((state) => (
              <span key={state} className="rounded border border-slate-200 px-2 py-1">{state}</span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
