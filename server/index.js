import "dotenv/config";
import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import { createServer } from "http";

import { AgentSystem, AGENTS } from "./agents/agentSystem.js";
import { startAgentServer } from "./a2a/agentServer.js";
import { AGENT_CONFIGS } from "./a2a/agentConfigs.js";
import { mockLeads, mockTasks, mockContentPosts, mockContentGraph, mockKnowledgeNodes } from "./data/mockData.js";

// ─── Boot all specialist agent A2A servers ─────────────────────────────────
// Each agent runs as its own HTTP server on its own port with:
//   GET  /.well-known/agent-card.json  → A2A discovery
//   POST /                             → JSON-RPC tasks/send, tasks/get, tasks/sendSubscribe

const agentServers = {};

function startAllAgentServers(onStatusChange) {
  for (const [id, config] of Object.entries(AGENT_CONFIGS)) {
    agentServers[id] = startAgentServer(config, config.port, onStatusChange);
  }
}

// ─── Main WebSocket + REST dashboard server ────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

const agentSystem = new AgentSystem(broadcast);

// Start all A2A agent servers, forwarding status changes to the broadcast
startAllAgentServers((agentId, status, currentTask) => {
  agentSystem.agentStatuses[agentId] = status;
  broadcast({ type: "agent_status", agentId, status, currentTask });
});

// ─── WebSocket handler ────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (total: ${clients.size})`);

  // Send full system state to new client
  ws.send(JSON.stringify({
    type: "init",
    agents: Object.values(AGENTS).map(a => ({
      id: a.id, name: a.name, role: a.role, color: a.color, model: a.model
    })),
    agentStatuses: agentSystem.agentStatuses,
    stats: agentSystem.stats,
    routes: agentSystem.routes,
    reads: agentSystem.reads,
    directive: agentSystem.currentDirective,
    contextWindow: agentSystem.contextWindow,
    a2aPorts: Object.fromEntries(
      Object.entries(AGENT_CONFIGS).map(([id, cfg]) => [id, cfg.port])
    )
  }));

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "user_message") {
        await agentSystem.processUserMessage(msg.content, msg.agentId || "ceo");
      }
    } catch (err) {
      console.error("[WS] Message error:", err.message);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected (total: ${clients.size})`);
  });
});

// ─── REST API endpoints ───────────────────────────────────────────────────
app.get("/api/agents", (_, res) => res.json(
  Object.values(AGENTS).map(a => ({
    id: a.id, name: a.name, role: a.role, color: a.color, model: a.model,
    port: a.port, skills: a.skills || []
  }))
));
app.get("/api/leads", (_, res) => res.json(mockLeads));
app.get("/api/tasks", (_, res) => res.json(mockTasks));
app.get("/api/content", (_, res) => res.json({ posts: mockContentPosts, graph: mockContentGraph }));
app.get("/api/knowledge", (_, res) => res.json({ nodes: mockKnowledgeNodes }));
app.get("/api/stats", (_, res) => res.json({
  stats: agentSystem.stats,
  routes: agentSystem.routes,
  reads: agentSystem.reads,
  directive: agentSystem.currentDirective,
  contextWindow: agentSystem.contextWindow,
  agentStatuses: agentSystem.agentStatuses
}));

// Proxy: discover agent cards from the dashboard
app.get("/api/agent-card/:agentId", async (req, res) => {
  const cfg = AGENT_CONFIGS[req.params.agentId];
  if (!cfg) return res.status(404).json({ error: "Agent not found" });
  try {
    const r = await fetch(`http://localhost:${cfg.port}/.well-known/agent-card.json`);
    res.json(await r.json());
  } catch {
    res.status(503).json({ error: "Agent server unavailable" });
  }
});

// ─── Start main server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Nexora AI System`);
  console.log(`   Dashboard server : http://localhost:${PORT}`);
  console.log(`   A2A Agent servers:`);
  Object.entries(AGENT_CONFIGS).forEach(([id, cfg]) => {
    console.log(`     ${cfg.name.padEnd(14)} → http://localhost:${cfg.port}`);
  });
  console.log(`   API key          : ${process.env.ANTHROPIC_API_KEY?.slice(0, 20)}...`);
  console.log();
});
