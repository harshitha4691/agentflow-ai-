# AgentFlow AI - Agentic AI Automation Platform

A full-stack AI-powered operations automation platform that lets operators describe automations in plain English and converts them into executable visual workflows powered by a chain of cooperating AI agents.

![Dashboard](https://img.shields.io/badge/Status-Active-brightgreen) ![Node.js](https://img.shields.io/badge/Node.js-v18+-green) ![React](https://img.shields.io/badge/React-19-blue) ![Next.js](https://img.shields.io/badge/Next.js-16-black)

## Overview

AgentFlow AI is an operator-focused workspace where users can:
- Describe an automation in natural language
- Watch the platform generate an executable visual workflow graph
- Execute workflows through a multi-agent orchestration engine
- Monitor real-time execution with live agent timeline events
- Connect third-party tools (Gmail, Slack, Discord, Google Sheets)

## Tech Stack

### Frontend
- Next.js (Pages Router) with React 19
- Tailwind CSS for styling
- Zustand for state management
- React Flow (@xyflow/react) for visual workflow canvas
- Socket.IO client for real-time updates
- Axios for API communication
- Lucide React for icons

### Backend
- Node.js with Express
- MongoDB with Mongoose (+ in-memory fallback)
- JWT authentication with bcrypt (cost 12)
- BullMQ on Redis for job queues (+ in-memory fallback)
- Socket.IO for real-time event streaming
- OpenRouter API / Google Gemini for AI workflow generation
- LangChain / LangGraph for agentic orchestration
- Helmet, CORS, express-rate-limit, express-validator for security

## Multi-Agent Architecture

The execution engine uses 5 cooperating agents:

| Agent | Role |
|-------|------|
| **Planner** | Determines node execution order via topological sort, emits confidence score |
| **Execution** | Runs each node against the correct integration or simulates it |
| **Validation** | Verifies required output fields per node type |
| **Recovery** | Classifies failures and decides between retry_with_backoff or escalate |
| **Monitoring** | Emits timeline events for full execution observability |

## Features

- AI Workflow Generation from natural language prompts
- Drag-and-drop React Flow canvas with 22 node types
- Real-time execution monitoring via Socket.IO
- OAuth integrations (Gmail, Slack, Discord, Google Sheets)
- Execution lifecycle controls (pause, resume, cancel)
- Credential encryption at rest (AES-256-GCM)
- Notifications system with live broadcasting
- Dashboard with workflow metrics and AI reasoning activity
- Full execution audit trail with per-agent timeline

## Project Structure

```
agentflow_ai/
├── client/                  # Next.js frontend
│   └── src/
│       ├── components/      # AppShell, WorkflowCanvas, NodePalette, etc.
│       ├── pages/           # Dashboard, Builder, Executions, Integrations, Settings
│       ├── store/           # Zustand stores (auth, workflow)
│       └── lib/             # API client, socket, node catalog
├── server/                  # Express backend
│   └── src/
│       ├── agents/          # Planner, Execution, Validation, Recovery, Monitoring
│       ├── config/          # Environment, DB, Socket.IO
│       ├── controllers/     # Request handlers
│       ├── integrations/    # Gmail, Slack, Discord, Google Sheets
│       ├── middleware/      # Auth, validation, security, error handling
│       ├── models/          # Mongoose schemas (7 collections)
│       ├── queues/          # BullMQ + Redis
│       ├── routes/          # API route definitions
│       ├── services/        # Business logic layer
│       └── utils/           # Crypto, memory store, error classes
```

## Getting Started

### Prerequisites
- Node.js v18+
- npm

### Installation

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Environment Setup

Copy the example env files and fill in your keys:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Required server environment variables:
```env
PORT=5050
CLIENT_URL=http://localhost:3000
API_BASE_URL=http://localhost:5050
MONGO_URI=                          # MongoDB Atlas URI (optional, uses memory fallback)
JWT_SECRET=your-random-secret       # Any random 32+ char string
JWT_EXPIRES_IN=7d
REDIS_URL=                          # Redis URL (optional, uses memory fallback)
OPENROUTER_API_KEY=                 # For AI workflow generation
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
GEMINI_API_KEY=                     # Fallback AI provider (optional)
CREDENTIAL_ENCRYPTION_KEY=your-key  # For encrypting OAuth tokens
```

### Running

```bash
# Start the server (from server/ directory)
npm run dev

# Start the client (from client/ directory)
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5050
- Health check: http://localhost:5050/api/health

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| GET | /api/workflows/dashboard | Dashboard metrics |
| GET | /api/workflows | List workflows |
| POST | /api/workflows | Create workflow |
| POST | /api/workflows/generate | AI generate workflow from prompt |
| GET | /api/workflows/:id | Get workflow |
| PUT | /api/workflows/:id | Update workflow |
| POST | /api/workflows/:id/execute | Execute workflow |
| POST | /api/workflows/:id/duplicate | Duplicate workflow |
| DELETE | /api/workflows/:id | Delete workflow |
| GET | /api/executions | List executions |
| GET | /api/executions/:id | Get execution |
| GET | /api/executions/:id/timeline | Agent timeline |
| POST | /api/executions/:id/pause | Pause execution |
| POST | /api/executions/:id/resume | Resume execution |
| POST | /api/executions/:id/cancel | Cancel execution |
| GET | /api/integrations | List integrations |
| GET | /api/integrations/status | Provider status |
| GET | /api/integrations/oauth/:provider/start | Start OAuth flow |
| GET | /api/notifications | List notifications |
| GET | /api/health | System health check |

## Node Catalog

**Triggers:** Gmail, Webhook, Schedule, Manual, Slack  
**Actions:** Send Email, Slack Message, Discord Message, Google Sheets Row, HTTP Request, Database Insert  
**AI:** Classification, Extraction, Summarization, Decision, Validation, Dynamic Routing  
**Logic:** IF/ELSE, Retry, Delay, Approval, Parallel Execution

## License

MIT
