import "dotenv/config";
import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import { createServer } from "http";
import { AgentSystem, AGENTS } from "./agents/agentSystem.js";
import { mockLeads, mockTasks, mockContentPosts, mockContentGraph, mockKnowledgeNodes } from "./data/mockData.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

const agentSystem = new AgentSystem(broadcast);

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("Client connected. Total:", clients.size);

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
    contextWindow: agentSystem.contextWindow
  }));

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "user_message") {
        await agentSystem.processUserMessage(msg.content, msg.agentId || "ceo");
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("Client disconnected. Total:", clients.size);
  });
});

app.get("/api/leads", (_, res) => res.json(mockLeads));
app.get("/api/tasks", (_, res) => res.json(mockTasks));
app.get("/api/content", (_, res) => res.json({ posts: mockContentPosts, graph: mockContentGraph }));
app.get("/api/knowledge", (_, res) => res.json({ nodes: mockKnowledgeNodes }));
app.get("/api/stats", (_, res) => res.json({
  stats: agentSystem.stats,
  routes: agentSystem.routes,
  reads: agentSystem.reads,
  directive: agentSystem.currentDirective,
  contextWindow: agentSystem.contextWindow
}));
app.get("/api/agents", (_, res) => res.json(Object.values(AGENTS).map(a => ({
  id: a.id, name: a.name, role: a.role, color: a.color, model: a.model
}))));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Nexora server running on :${PORT}`));
