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
import { startAgentServer, runAgentTurn } from "./a2a/agentServer.js";
import { AGENT_CONFIGS } from "./a2a/agentConfigs.js";
import { mockLeads, mockTasks, mockContentPosts, mockContentGraph, mockKnowledgeNodes } from "./data/mockData.js";
import {
  initLeadStore, getAllLeads, getAllEmails, getAllFollowups,
  getPipelineStats, cancelFollowup
} from "./tools/leadStore.js";
import {
  loadConfig, updateConfig, resetConfig, DEFAULT_CONFIG,
  buildFrontDeskPrompt, getConfigStatus, isWithinHours
} from "./config/frontDeskConfig.js";
import {
  initReviewStore, syncReviews, getAllReviews, getReviewStats, getReviewMode,
  saveDraftReply, postReply, discardDraft, addLocalReview, deleteReview,
  getReviewRequests
} from "./tools/googleReviews.js";
import {
  initReceptionStore, getAllAppointments, getUpcomingAppointments, getAllMessages,
  getAllConversations, getReceptionStats, getAvailability, findNextAvailable,
  bookAppointment, cancelAppointment, updateAppointment, resolveMessage,
  getOrCreateConversation, appendTurn, localDateString
} from "./tools/receptionStore.js";

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

// Init stores so agents can broadcast live updates to dashboard
initLeadStore(broadcast);
initReviewStore(broadcast);
initReceptionStore(broadcast);

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

// ─── Front Desk: editable configuration ───────────────────────────────────────
// Everything the Review agent + Receptionist say and do comes from this config.
// PUT it at any time — the next agent turn picks it up, no restart needed.

app.get("/api/frontdesk/config", (_, res) => res.json({
  config: loadConfig(),
  defaults: DEFAULT_CONFIG,
  status: getConfigStatus()
}));

app.put("/api/frontdesk/config", (req, res) => {
  try {
    const config = updateConfig(req.body || {});
    broadcast({ type: "frontdesk_config_updated", status: getConfigStatus() });
    res.json({ ok: true, config, status: getConfigStatus() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post("/api/frontdesk/config/reset", (_, res) => {
  const config = resetConfig();
  broadcast({ type: "frontdesk_config_updated", status: getConfigStatus() });
  res.json({ ok: true, config });
});

// Exactly what the agent will be told on its next turn — useful when tuning.
app.get("/api/frontdesk/prompt", (_, res) => res.json({ prompt: buildFrontDeskPrompt() }));

app.get("/api/frontdesk/status", (_, res) => {
  const cfg = loadConfig();
  res.json({
    ...getConfigStatus(),
    google: getReviewMode(cfg.business.placeId),
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD),
    emailUser: process.env.EMAIL_USER || null,
    openNow: isWithinHours(),
    today: localDateString(new Date(), cfg.business.timezone),
    reception: getReceptionStats(),
    reviews: getReviewStats()
  });
});

// ─── Front Desk: Google reviews ───────────────────────────────────────────────
app.get("/api/frontdesk/reviews", (_, res) => res.json({
  reviews: getAllReviews(),
  stats: getReviewStats(),
  mode: getReviewMode(loadConfig().business.placeId),
  requests: getReviewRequests()
}));

app.post("/api/frontdesk/reviews/sync", async (_, res) => {
  const result = await syncReviews(loadConfig().business.placeId);
  res.json({ ...result, stats: getReviewStats() });
});

app.post("/api/frontdesk/reviews", (req, res) => res.json({ ok: true, review: addLocalReview(req.body || {}) }));

app.delete("/api/frontdesk/reviews/:id", (req, res) => res.json({ ok: deleteReview(req.params.id) }));

app.put("/api/frontdesk/reviews/:id/draft", (req, res) => {
  res.json(saveDraftReply(req.params.id, req.body?.text || ""));
});

app.post("/api/frontdesk/reviews/:id/post", async (req, res) => {
  res.json(await postReply(req.params.id, req.body?.text));
});

app.delete("/api/frontdesk/reviews/:id/draft", (req, res) => res.json(discardDraft(req.params.id)));

/** Ask the agent to write a reply for one review, without leaving the dashboard. */
app.post("/api/frontdesk/reviews/:id/generate", async (req, res) => {
  const review = getAllReviews().find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ ok: false, error: "Review not found" });
  try {
    const text = await runAgentTurn(
      AGENT_CONFIGS.front_desk,
      [{
        role: "user",
        content: `Write and save a reply to this Google review using draft_review_reply.

Review ID: ${review.id}
Author: ${review.author}
Rating: ${review.rating}★
Text: "${review.text || "(no text — rating only)"}"
${req.body?.instruction ? `\nOperator instruction for this reply: ${req.body.instruction}` : ""}

Call draft_review_reply exactly once, then tell me the reply text and whether it posted or is awaiting approval.`
      }]
    );
    const updated = getAllReviews().find(r => r.id === req.params.id);
    res.json({ ok: true, summary: text, review: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Front Desk: reception ────────────────────────────────────────────────────
app.get("/api/frontdesk/reception", (_, res) => res.json({
  appointments: getAllAppointments(),
  upcoming: getUpcomingAppointments(),
  messages: getAllMessages(),
  conversations: getAllConversations().slice(0, 50),
  stats: getReceptionStats()
}));

app.get("/api/frontdesk/availability", (req, res) => {
  const date = req.query.date || localDateString(new Date(), loadConfig().business.timezone);
  res.json({
    ...getAvailability(String(date)),
    next: findNextAvailable(String(date), 14)
  });
});

app.post("/api/frontdesk/appointments", (req, res) => res.json(bookAppointment({ ...req.body, source: "dashboard" })));
app.put("/api/frontdesk/appointments/:id", (req, res) => res.json(updateAppointment(req.params.id, req.body || {})));
app.delete("/api/frontdesk/appointments/:id", (req, res) => res.json(cancelAppointment(req.params.id)));
app.put("/api/frontdesk/messages/:id/resolve", (req, res) => res.json(resolveMessage(req.params.id)));

/**
 * Customer-facing receptionist endpoint. This is what a website widget, phone
 * bridge, or SMS gateway posts to — one conversation id per caller.
 */
app.post("/api/receptionist/chat", async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.receptionist.enabled) {
    return res.json({ ok: false, reply: `Sorry, our virtual receptionist is offline. Please call ${cfg.business.phone || "us"} directly.` });
  }

  const { conversationId, message, channel = "web" } = req.body || {};
  if (!message) return res.status(400).json({ ok: false, error: "message is required" });

  const conversation = getOrCreateConversation(conversationId, { channel });
  appendTurn(conversation.id, "user", message);

  try {
    const history = conversation.turns.map(t => ({
      role: t.role === "user" ? "user" : "assistant",
      content: t.content
    }));
    const reply = await runAgentTurn(AGENT_CONFIGS.front_desk, history, {
      systemSuffix:
        "MODE: LIVE CUSTOMER CONVERSATION. You are speaking directly to a customer, not the operator. " +
        "Never mention tools, IDs, internal status lines, or that you are an AI system component. " +
        "Keep replies short enough to be read aloud. Never output the **Front Desk** status line here."
    });
    appendTurn(conversation.id, "assistant", reply);
    res.json({ ok: true, conversationId: conversation.id, reply });
  } catch (err) {
    res.status(500).json({ ok: false, conversationId: conversation.id, error: err.message });
  }
});

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

// ─── Background review sync ───────────────────────────────────────────────────
// Ticks every minute but only calls Google once the operator's configured
// interval has elapsed, so changing the interval takes effect without a restart.
let lastAutoSync = 0;
setInterval(async () => {
  const cfg = loadConfig();
  if (!cfg.reviews.enabled) return;
  if (!getReviewMode(cfg.business.placeId).canRead) return;

  const intervalMs = Math.max(5, cfg.reviews.syncIntervalMinutes || 60) * 60_000;
  if (Date.now() - lastAutoSync < intervalMs) return;

  lastAutoSync = Date.now();
  const result = await syncReviews(cfg.business.placeId);
  if (result.ok && result.newReviews?.length) {
    console.log(`[Reviews] Auto-sync found ${result.newReviews.length} new review(s)`);
  } else if (!result.ok) {
    console.warn(`[Reviews] Auto-sync failed: ${result.error}`);
  }
}, 60_000).unref();

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

  const fdCfg = loadConfig();
  const google = getReviewMode(fdCfg.business.placeId);
  console.log(`   Front Desk       : ${fdCfg.business.name} — receptionist ${fdCfg.receptionist.enabled ? "on" : "off"}, reviews ${fdCfg.reviews.enabled ? "on" : "off"}`);
  console.log(`   Google reviews   : ${google.mode} — ${google.detail}`);
  console.log(`   Edit everything  : http://localhost:${PORT} → Front Desk → Settings`);
  console.log();
});
