import "dotenv/config";
import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import { createServer } from "http";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { AgentSystem, AGENTS } from "./agents/agentSystem.js";
import { startAgentServer } from "./a2a/agentServer.js";
import { AGENT_CONFIGS } from "./a2a/agentConfigs.js";
import { mockLeads, mockTasks, mockContentPosts, mockContentGraph, mockKnowledgeNodes } from "./data/mockData.js";
import {
  initLeadStore, getAllLeads, getAllEmails, getAllFollowups,
  getPipelineStats, cancelFollowup
} from "./tools/leadStore.js";

const agentServers = {};

function startAllAgentServers(onStatusChange) {
  for (const [id, config] of Object.entries(AGENT_CONFIGS)) {
    agentServers[id] = startAgentServer(config, config.port, onStatusChange);
  }
}

// ─── Main server ──────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const distPath = join(__dirname, "../client/dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

const server = createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

// Init lead store so agents can broadcast live updates to dashboard
initLeadStore(broadcast);

const agentSystem = new AgentSystem(broadcast);

startAllAgentServers((agentId, status, currentTask) => {
  agentSystem.agentStatuses[agentId] = status;
  broadcast({ type: "agent_status", agentId, status, currentTask });
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (total: ${clients.size})`);

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

// ─── REST API ─────────────────────────────────────────────────────────────────
app.get("/api/agents", (_, res) => res.json(
  Object.values(AGENTS).map(a => ({
    id: a.id, name: a.name, role: a.role, color: a.color, model: a.model,
    port: a.port, skills: a.skills || []
  }))
));

// Lead Pipeline — live data from agents
app.get("/api/leads", (_, res) => {
  const agentLeads = getAllLeads();
  // Merge with mock leads if no agent leads yet
  res.json(agentLeads.length > 0 ? agentLeads : mockLeads);
});
app.get("/api/pipeline", (_, res) => res.json({
  leads: getAllLeads(),
  emails: getAllEmails(),
  followups: getAllFollowups(),
  stats: getPipelineStats()
}));
app.delete("/api/pipeline/followup/:id", (req, res) => {
  const followup = cancelFollowup(req.params.id);
  res.json(followup || { error: "Follow-up not found" });
});

app.get("/api/tasks",    (_, res) => res.json(mockTasks));
app.get("/api/content",  (_, res) => res.json({ posts: mockContentPosts, graph: mockContentGraph }));
app.get("/api/knowledge",(_, res) => res.json({ nodes: mockKnowledgeNodes }));
app.get("/api/stats",    (_, res) => res.json({
  stats: agentSystem.stats,
  routes: agentSystem.routes,
  reads: agentSystem.reads,
  directive: agentSystem.currentDirective,
  contextWindow: agentSystem.contextWindow,
  agentStatuses: agentSystem.agentStatuses
}));

// Check email + apollo config status
app.get("/api/config/status", (_, res) => res.json({
  apolloConfigured: !!process.env.APOLLO_API_KEY,
  emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD),
  emailUser: process.env.EMAIL_USER || null
}));

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

if (existsSync(distPath)) {
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) res.sendFile(join(distPath, "index.html"));
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Nexora AI System`);
  console.log(`   Dashboard + API  : http://localhost:${PORT}`);
  console.log(`   A2A Agent servers:`);
  Object.entries(AGENT_CONFIGS).forEach(([, cfg]) => {
    console.log(`     ${cfg.name.padEnd(14)} → http://localhost:${cfg.port}`);
  });
  console.log(`   Apollo.io        : ${process.env.APOLLO_API_KEY ? "✓ configured" : "✗ APOLLO_API_KEY missing"}`);
  console.log(`   Email (Gmail)    : ${process.env.EMAIL_USER ? `✓ ${process.env.EMAIL_USER}` : "✗ EMAIL_USER missing"}`);
  console.log();
});
