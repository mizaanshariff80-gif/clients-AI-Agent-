/**
 * A2A (Agent2Agent) Protocol Server Factory
 *
 * Each specialist agent runs as its own HTTP server exposing:
 *   GET  /.well-known/agent-card.json  → discovery / capabilities
 *   POST /                             → JSON-RPC 2.0 tasks/send & tasks/get
 *
 * Task lifecycle: submitted → working → completed | failed
 */

import express from "express";
import { createServer } from "http";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** In-memory task store per agent server */
class TaskStore {
  constructor() {
    this.tasks = new Map();
  }
  create(id, message) {
    const task = {
      id,
      status: { state: "submitted", timestamp: new Date().toISOString() },
      message,
      artifacts: [],
      history: []
    };
    this.tasks.set(id, task);
    return task;
  }
  get(id) { return this.tasks.get(id); }
  update(id, updates) {
    const t = this.tasks.get(id);
    if (t) Object.assign(t, updates);
    return t;
  }
  setStatus(id, state, message = null) {
    const t = this.tasks.get(id);
    if (t) {
      t.status = { state, timestamp: new Date().toISOString(), ...(message ? { message } : {}) };
    }
    return t;
  }
  addArtifact(id, name, text) {
    const t = this.tasks.get(id);
    if (t) {
      t.artifacts.push({
        name,
        index: t.artifacts.length,
        parts: [{ type: "text", text }]
      });
    }
    return t;
  }
}

/**
 * Build and return an A2A-compatible Express app for a specialist agent.
 * @param {object} config - Agent configuration
 * @param {function} onStatusChange - callback(agentId, status, currentTask) for broadcasting
 */
export function createAgentServer(config, onStatusChange = () => {}) {
  const app = express();
  const store = new TaskStore();
  const chatHistory = [];

  app.use(express.json());
  app.use((_, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  /** A2A Discovery endpoint */
  app.get("/.well-known/agent-card.json", (_, res) => {
    res.json(buildAgentCard(config));
  });

  /** A2A JSON-RPC endpoint */
  app.post("/", async (req, res) => {
    const { jsonrpc, method, params, id: rpcId } = req.body;
    if (jsonrpc !== "2.0") return res.status(400).json({ error: "Invalid JSON-RPC version" });

    if (method === "tasks/send") {
      const taskId = params?.id || uuidv4();
      const userText = extractText(params?.message);
      const task = store.create(taskId, params?.message);

      onStatusChange(config.id, "working", userText.slice(0, 60));
      store.setStatus(taskId, "working");

      (async () => {
        try {
          chatHistory.push({ role: "user", content: userText });
          const result = await callClaude(config, chatHistory);
          chatHistory.push({ role: "assistant", content: result });

          store.addArtifact(taskId, "result", result);
          store.setStatus(taskId, "completed");
          onStatusChange(config.id, "idle");
        } catch (err) {
          store.setStatus(taskId, "failed", err.message);
          onStatusChange(config.id, "idle");
        }
      })();

      return res.json({ jsonrpc: "2.0", result: store.get(taskId), id: rpcId });
    }

    if (method === "tasks/get") {
      const task = store.get(params?.id);
      if (!task) return res.json({ jsonrpc: "2.0", error: { code: -32001, message: "Task not found" }, id: rpcId });
      return res.json({ jsonrpc: "2.0", result: task, id: rpcId });
    }

    if (method === "tasks/sendSubscribe") {
      const taskId = params?.id || uuidv4();
      const userText = extractText(params?.message);
      store.create(taskId, params?.message);
      onStatusChange(config.id, "working", userText.slice(0, 60));
      store.setStatus(taskId, "working");

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");

      const writeEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
      writeEvent({ jsonrpc: "2.0", result: { id: taskId, status: { state: "working" } }, id: rpcId });

      try {
        chatHistory.push({ role: "user", content: userText });
        const result = await callClaude(config, chatHistory);
        chatHistory.push({ role: "assistant", content: result });

        store.addArtifact(taskId, "result", result);
        store.setStatus(taskId, "completed");
        onStatusChange(config.id, "idle");

        writeEvent({ jsonrpc: "2.0", result: { id: taskId, status: { state: "completed" }, artifacts: store.get(taskId).artifacts }, id: rpcId });
        res.end();
      } catch (err) {
        store.setStatus(taskId, "failed", err.message);
        onStatusChange(config.id, "idle");
        writeEvent({ jsonrpc: "2.0", error: { code: -32000, message: err.message }, id: rpcId });
        res.end();
      }
      return;
    }

    return res.json({ jsonrpc: "2.0", error: { code: -32601, message: `Method not found: ${method}` }, id: rpcId });
  });

  return { app, store };
}

/** Start an A2A agent on the given port, returns the http.Server */
export function startAgentServer(config, port, onStatusChange) {
  const { app } = createAgentServer(config, onStatusChange);
  const server = createServer(app);
  server.listen(port, () => {
    console.log(`[A2A] ${config.name} (${config.role}) listening on :${port}`);
  });
  return server;
}

/** Build the AgentCard discovery document */
function buildAgentCard(config) {
  return {
    name: config.name,
    description: config.description,
    version: "1.0.0",
    url: `http://localhost:${config.port}`,
    capabilities: { streaming: true, pushNotifications: false },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: config.skills,
    supportedInterfaces: [{
      url: `http://localhost:${config.port}`,
      protocol_binding: "JSONRPC"
    }]
  };
}

/** Extract plain text from A2A message object */
function extractText(message) {
  if (!message) return "";
  if (typeof message === "string") return message;
  if (Array.isArray(message.parts)) {
    return message.parts.filter(p => p.type === "text").map(p => p.text).join("\n");
  }
  return String(message);
}

/** Call Claude with the agent's system prompt */
async function callClaude(config, history) {
  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: config.systemPrompt,
    messages: history.slice(-12)
  });
  return response.content[0].text;
}
