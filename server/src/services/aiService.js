const axios = require('axios');
const { nanoid } = require('nanoid');
const env = require('../config/env');

const nodeCatalog = {
  triggers: ['gmail-trigger', 'webhook-trigger', 'schedule-trigger', 'manual-trigger', 'slack-trigger'],
  actions: ['send-email', 'send-slack-message', 'send-discord-message', 'google-sheets-row', 'http-request', 'database-insert'],
  ai: ['ai-classification', 'ai-extraction', 'ai-summarization', 'ai-decision', 'ai-validation', 'dynamic-routing'],
  logic: ['if-else', 'retry', 'delay', 'approval', 'parallel-execution']
};

function extractEmail(prompt) {
  const match = prompt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : '';
}

function extractQuotedText(prompt, fallback) {
  const matches = prompt.match(/["']([^"']+)["']/g);
  if (matches && matches.length > 0) {
    return matches[matches.length - 1].replace(/["']/g, '');
  }
  return fallback;
}

function extractSubject(prompt) {
  return extractQuotedText(prompt, 'Automation Test');
}

function isEmailAutomationPrompt(prompt) {
  const lower = prompt.toLowerCase();
  return lower.includes('send') && (lower.includes('email') || lower.includes('mail'));
}

function isSlackPrompt(prompt) {
  return prompt.toLowerCase().includes('slack');
}

function isDiscordPrompt(prompt) {
  return prompt.toLowerCase().includes('discord');
}

function isSheetsPrompt(prompt) {
  const lower = prompt.toLowerCase();
  return lower.includes('sheet') || lower.includes('spreadsheet');
}

function buildEmailWorkflow(prompt) {
  const email = extractEmail(prompt);
  const subject = extractSubject(prompt);
  const body = extractQuotedText(prompt, 'Hello from AgentFlow AI');
  const nodes = [
    { id: 'trigger-1', type: 'manual-trigger', label: 'Manual Trigger', category: 'trigger', position: { x: 50, y: 200 }, config: {} },
    { id: 'action-1', type: 'send-email', label: 'Send Email', category: 'action', position: { x: 350, y: 200 }, config: { to: email, subject, body } }
  ];
  const edges = [{ id: 'e-1', source: 'trigger-1', target: 'action-1', animated: true }];
  return { name: `Send Email to ${email || 'recipient'}`, description: prompt, trigger: { type: 'manual', config: {} }, nodes, edges, tags: ['email'] };
}

function buildFallbackWorkflow(prompt) {
  const lower = prompt.toLowerCase();
  const nodes = [];
  const edges = [];
  let y = 100;
  let prevId = null;
  let edgeIdx = 0;

  // Determine trigger
  const triggerId = `trigger-${nanoid(4)}`;
  if (lower.includes('gmail') || lower.includes('email arrive') || lower.includes('invoice email')) {
    nodes.push({ id: triggerId, type: 'gmail-trigger', label: 'Gmail Trigger', category: 'trigger', position: { x: 50, y }, config: {} });
  } else if (lower.includes('schedule') || lower.includes('cron')) {
    nodes.push({ id: triggerId, type: 'schedule-trigger', label: 'Schedule Trigger', category: 'trigger', position: { x: 50, y }, config: {} });
  } else if (lower.includes('webhook')) {
    nodes.push({ id: triggerId, type: 'webhook-trigger', label: 'Webhook Trigger', category: 'trigger', position: { x: 50, y }, config: {} });
  } else {
    nodes.push({ id: triggerId, type: 'manual-trigger', label: 'Manual Trigger', category: 'trigger', position: { x: 50, y }, config: {} });
  }
  prevId = triggerId;

  // AI extraction/classification if mentioned
  if (lower.includes('extract') || lower.includes('classify') || lower.includes('invoice') || lower.includes('parse')) {
    const aiId = `ai-${nanoid(4)}`;
    nodes.push({ id: aiId, type: 'ai-extraction', label: 'AI Extraction', category: 'ai', position: { x: 350, y }, config: {} });
    edges.push({ id: `e-${edgeIdx++}`, source: prevId, target: aiId, animated: true });
    prevId = aiId;
    y += 0;
  }

  // Action nodes based on prompt
  const x = 650;
  if (isSlackPrompt(prompt)) {
    const slackId = `action-${nanoid(4)}`;
    nodes.push({ id: slackId, type: 'send-slack-message', label: 'Send Slack Message', category: 'action', position: { x, y: y - 80 }, config: { channel: '#general', message: 'Notification from AgentFlow' } });
    edges.push({ id: `e-${edgeIdx++}`, source: prevId, target: slackId, animated: true });
  }

  if (isDiscordPrompt(prompt)) {
    const discordId = `action-${nanoid(4)}`;
    nodes.push({ id: discordId, type: 'send-discord-message', label: 'Send Discord Message', category: 'action', position: { x, y }, config: { channel: 'general', message: 'Notification from AgentFlow' } });
    edges.push({ id: `e-${edgeIdx++}`, source: prevId, target: discordId, animated: true });
  }

  if (isEmailAutomationPrompt(prompt)) {
    const emailId = `action-${nanoid(4)}`;
    const email = extractEmail(prompt);
    nodes.push({ id: emailId, type: 'send-email', label: 'Send Email', category: 'action', position: { x, y: y + 80 }, config: { to: email, subject: 'Automated Notification', body: 'Sent by AgentFlow AI' } });
    edges.push({ id: `e-${edgeIdx++}`, source: prevId, target: emailId, animated: true });
  }

  if (isSheetsPrompt(prompt)) {
    const sheetsId = `action-${nanoid(4)}`;
    nodes.push({ id: sheetsId, type: 'google-sheets-row', label: 'Google Sheets Row', category: 'action', position: { x: x + 300, y }, config: { spreadsheetId: '', range: 'Sheet1!A:D', values: [] } });
    edges.push({ id: `e-${edgeIdx++}`, source: prevId, target: sheetsId, animated: true });
  }

  // Decision / escalation
  if (lower.includes('escalat') || lower.includes('above') || lower.includes('threshold') || lower.includes('decision')) {
    const decisionId = `logic-${nanoid(4)}`;
    nodes.push({ id: decisionId, type: 'if-else', label: 'Decision Gate', category: 'logic', position: { x: x + 300, y: y - 80 }, config: { condition: 'amount > 5000' } });
    edges.push({ id: `e-${edgeIdx++}`, source: prevId, target: decisionId, animated: true });

    const approvalId = `logic-${nanoid(4)}`;
    nodes.push({ id: approvalId, type: 'approval', label: 'Escalation Approval', category: 'logic', position: { x: x + 600, y: y - 80 }, config: {} });
    edges.push({ id: `e-${edgeIdx++}`, source: decisionId, target: approvalId, animated: true });
  }

  // If no action nodes were added, at minimum add a notification
  if (nodes.length <= 2) {
    const notifyId = `action-${nanoid(4)}`;
    nodes.push({ id: notifyId, type: 'send-slack-message', label: 'Send Notification', category: 'action', position: { x: 350, y: y + 80 }, config: { channel: '#notifications', message: 'Workflow completed' } });
    edges.push({ id: `e-${edgeIdx++}`, source: prevId, target: notifyId, animated: true });
  }

  const name = prompt.length > 60 ? prompt.slice(0, 57) + '...' : prompt;
  return { name: `AI Generated: ${name}`, description: prompt, trigger: { type: 'manual', config: {} }, nodes, edges, tags: ['ai-generated'] };
}

function hasUsableNodes(graph) {
  return graph && Array.isArray(graph.nodes) && graph.nodes.length > 0 && graph.nodes.some((n) => n.id && n.type);
}

function sanitizeGeneratedWorkflow(graph, prompt) {
  if (!graph || !Array.isArray(graph.nodes)) return null;

  const nodes = graph.nodes
    .filter((n) => n && n.id)
    .map((n, i) => ({
      id: n.id || `node-${i}`,
      type: n.type || 'action',
      label: n.label || n.type || 'Node',
      category: n.category || guessCategory(n.type),
      position: n.position || { x: 300 * Math.floor(i / 4) + 50, y: 180 * (i % 4) + 50 },
      config: n.config || {},
      status: 'idle'
    }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = (graph.edges || [])
    .filter((e) => e && nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)))
    .map((e, i) => ({
      id: e.id || `edge-${i}`,
      source: String(e.source),
      target: String(e.target),
      animated: true,
      label: e.label || ''
    }));

  // Merge email defaults for email prompts
  if (isEmailAutomationPrompt(prompt)) {
    const emailNode = nodes.find((n) => n.type === 'send-email');
    if (emailNode && !emailNode.config.to) {
      emailNode.config.to = extractEmail(prompt);
      emailNode.config.subject = extractSubject(prompt);
    }
  }

  return {
    name: graph.name || prompt.slice(0, 60),
    description: graph.description || prompt,
    trigger: graph.trigger || { type: 'manual', config: {} },
    nodes,
    edges,
    tags: graph.tags || ['ai-generated']
  };
}

function guessCategory(type) {
  if (!type) return 'action';
  if (type.includes('trigger')) return 'trigger';
  if (type.startsWith('ai-') || type.includes('dynamic')) return 'ai';
  if (['if-else', 'retry', 'delay', 'approval', 'parallel-execution'].includes(type)) return 'logic';
  return 'action';
}

function extractJson(text) {
  if (!text) return null;
  // Try direct parse
  try { return JSON.parse(text); } catch {}
  // Try extracting from markdown code block
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch {}
  }
  // Try finding first { ... }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

const SYSTEM_PROMPT = `You are a workflow graph generator. Given a user prompt describing an automation, return a JSON object with this structure:
{
  "name": "short workflow name",
  "description": "what this workflow does",
  "trigger": { "type": "manual-trigger" or another trigger type, "config": {} },
  "nodes": [{ "id": "unique-id", "type": "node-type-from-catalog", "label": "Human Label", "category": "trigger|action|ai|logic", "position": { "x": number, "y": number }, "config": {} }],
  "edges": [{ "id": "edge-id", "source": "node-id", "target": "node-id" }],
  "tags": ["tag1"]
}

Available node types:
Triggers: ${nodeCatalog.triggers.join(', ')}
Actions: ${nodeCatalog.actions.join(', ')}
AI: ${nodeCatalog.ai.join(', ')}
Logic: ${nodeCatalog.logic.join(', ')}

Position nodes in a left-to-right layout starting at x:50, spacing 300px horizontally. Return ONLY valid JSON, no markdown.`;

async function generateWithOpenRouter(prompt) {
  if (!env.openRouterApiKey) return null;
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: env.openRouterModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${env.openRouterApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    const content = response.data?.choices?.[0]?.message?.content;
    return extractJson(content);
  } catch {
    return null;
  }
}

async function generateWithGemini(prompt) {
  if (!env.geminiApiKey) return null;
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(env.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: env.geminiModel });
    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nUser prompt: ${prompt}`);
    const text = result.response.text();
    return extractJson(text);
  } catch {
    return null;
  }
}

async function generateWorkflow(prompt) {
  // Try OpenRouter first
  let graph = await generateWithOpenRouter(prompt);
  if (graph && hasUsableNodes(graph)) {
    const sanitized = sanitizeGeneratedWorkflow(graph, prompt);
    if (sanitized && sanitized.nodes.length > 0) return sanitized;
  }

  // Try Gemini
  graph = await generateWithGemini(prompt);
  if (graph && hasUsableNodes(graph)) {
    const sanitized = sanitizeGeneratedWorkflow(graph, prompt);
    if (sanitized && sanitized.nodes.length > 0) return sanitized;
  }

  // Deterministic fallback
  if (isEmailAutomationPrompt(prompt)) {
    return buildEmailWorkflow(prompt);
  }
  return buildFallbackWorkflow(prompt);
}

module.exports = { generateWorkflow, nodeCatalog };
