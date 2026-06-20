/**
 * A2A (Agent2Agent) Protocol Server Factory
 *
 * Each specialist agent runs as its own HTTP server exposing:
 *   GET  /.well-known/agent-card.json  → discovery / capabilities
 *   POST /                             → JSON-RPC 2.0 tasks/send & tasks/get
 */

import express from "express";
import { createServer } from "http";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import { searchUSLeads, enrichLead } from "../tools/apolloClient.js";
import { sendEmail, isEmailConfigured } from "../tools/emailClient.js";
import {
  addLead, updateLeadStatus, getAllLeads, getLead,
  recordEmail, scheduleFollowup, getAllFollowups,
  getPipelineStats
} from "../tools/leadStore.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Tool definitions for Sales Rep agent ─────────────────────────────────────
const SALES_TOOLS = [
  {
    name: "search_us_leads",
    description: "Search Apollo.io for US business contacts and decision-makers. Returns real names, emails, companies, titles.",
    input_schema: {
      type: "object",
      properties: {
        jobTitles: { type: "array", items: { type: "string" }, description: "e.g. ['CEO','Founder','Owner']" },
        industries: { type: "array", items: { type: "string" }, description: "e.g. ['SaaS','Marketing Agency']" },
        keywords: { type: "array", items: { type: "string" }, description: "Keywords to filter by" },
        companySizeMin: { type: "number", description: "Min employees" },
        companySizeMax: { type: "number", description: "Max employees" },
        perPage: { type: "number", description: "Results to return (max 25)" }
      },
      required: []
    }
  },
  {
    name: "enrich_lead",
    description: "Enrich a lead by email/name to get more contact details from Apollo.io.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string" },
        name: { type: "string" },
        company: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "add_lead_to_pipeline",
    description: "Add a qualified lead to the CRM pipeline for tracking.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        title: { type: "string" },
        company: { type: "string" },
        industry: { type: "string" },
        phone: { type: "string" },
        linkedin: { type: "string" },
        website: { type: "string" },
        state: { type: "string" },
        notes: { type: "string" }
      },
      required: ["name", "company"]
    }
  },
  {
    name: "send_outreach_email",
    description: "Send a personalized cold outreach email to a lead via Gmail.",
    input_schema: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "Lead ID from the pipeline" },
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Full email body text (plain text, keep under 150 words)" }
      },
      required: ["to", "subject", "body"]
    }
  },
  {
    name: "schedule_followup_email",
    description: "Schedule an automatic follow-up email if the lead doesn't reply.",
    input_schema: {
      type: "object",
      properties: {
        leadId: { type: "string" },
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        delayDays: { type: "number", description: "Days to wait before sending (default: 3)" }
      },
      required: ["to", "subject", "body"]
    }
  },
  {
    name: "get_pipeline_leads",
    description: "Get all leads currently in the CRM pipeline with their email status.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "update_lead_status",
    description: "Update a lead's status in the pipeline.",
    input_schema: {
      type: "object",
      properties: {
        leadId: { type: "string" },
        status: { type: "string", enum: ["new", "contacted", "replied", "booked", "disqualified"] }
      },
      required: ["leadId", "status"]
    }
  }
];

// ─── Tool executor ─────────────────────────────────────────────────────────────
async function executeTool(name, input) {
  try {
    switch (name) {
      case "search_us_leads": {
        const result = await searchUSLeads(input);
        if (result.error) return `Error searching leads: ${result.error}`;
        // Auto-add to pipeline
        const added = result.leads.map(l => addLead(l));
        return JSON.stringify({
          found: result.total,
          returned: added.length,
          leads: added.map(l => ({ id: l.id, name: l.name, title: l.title, email: l.email, company: l.company, state: l.state }))
        }, null, 2);
      }
      case "enrich_lead": {
        const result = await enrichLead(input);
        if (result.error) return `Enrichment failed: ${result.error}`;
        return JSON.stringify(result, null, 2);
      }
      case "add_lead_to_pipeline": {
        const lead = addLead(input);
        return `Lead added: ${lead.name} (${lead.company}) — ID: ${lead.id}`;
      }
      case "send_outreach_email": {
        if (!isEmailConfigured()) {
          return "Email not configured. The operator needs to add EMAIL_USER and EMAIL_APP_PASSWORD to server/.env";
        }
        const result = await sendEmail(input);
        if (!result.success) return `Email failed: ${result.error}`;
        if (input.leadId) {
          recordEmail({ leadId: input.leadId, to: input.to, subject: input.subject, body: input.body, messageId: result.messageId });
          updateLeadStatus(input.leadId, "contacted");
        }
        return `Email sent to ${input.to} (Message ID: ${result.messageId})`;
      }
      case "schedule_followup_email": {
        const followup = scheduleFollowup({
          leadId: input.leadId,
          delayDays: input.delayDays || 3,
          subject: input.subject,
          body: input.body,
          sendFn: async () => {
            await sendEmail({ to: input.to, subject: input.subject, body: input.body });
          }
        });
        return `Follow-up scheduled for ${input.to} in ${input.delayDays || 3} days (ID: ${followup.id}, fires: ${followup.scheduledFor})`;
      }
      case "get_pipeline_leads": {
        const leads = getAllLeads();
        const stats = getPipelineStats();
        return JSON.stringify({ stats, leads: leads.slice(0, 20) }, null, 2);
      }
      case "update_lead_status": {
        const lead = updateLeadStatus(input.leadId, input.status);
        return lead ? `Lead ${lead.name} status updated to "${input.status}"` : "Lead not found";
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Tool error (${name}): ${err.message}`;
  }
}

// ─── In-memory task store ──────────────────────────────────────────────────────
class TaskStore {
  constructor() { this.tasks = new Map(); }
  create(id, message) {
    const task = { id, status: { state: "submitted", timestamp: new Date().toISOString() }, message, artifacts: [], history: [] };
    this.tasks.set(id, task);
    return task;
  }
  get(id) { return this.tasks.get(id); }
  update(id, updates) { const t = this.tasks.get(id); if (t) Object.assign(t, updates); return t; }
  setStatus(id, state, message = null) {
    const t = this.tasks.get(id);
    if (t) t.status = { state, timestamp: new Date().toISOString(), ...(message ? { message } : {}) };
    return t;
  }
  addArtifact(id, name, text) {
    const t = this.tasks.get(id);
    if (t) t.artifacts.push({ name, index: t.artifacts.length, parts: [{ type: "text", text }] });
    return t;
  }
}

// ─── Agent server factory ──────────────────────────────────────────────────────
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

  app.get("/.well-known/agent-card.json", (_, res) => res.json(buildAgentCard(config)));

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
          const result = await callClaudeWithTools(config, chatHistory);
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
        const result = await callClaudeWithTools(config, chatHistory);
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

export function startAgentServer(config, port, onStatusChange) {
  const { app } = createAgentServer(config, onStatusChange);
  const server = createServer(app);
  server.listen(port, () => console.log(`[A2A] ${config.name} (${config.role}) listening on :${port}`));
  return server;
}

// ─── Claude call with tool use support ────────────────────────────────────────
async function callClaudeWithTools(config, history) {
  const useTools = config.id === "sales_rep";
  const tools = useTools ? SALES_TOOLS : undefined;

  const messages = history.slice(-14);
  let response = await anthropic.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: config.systemPrompt,
    messages,
    ...(tools ? { tools } : {})
  });

  // Agentic tool use loop
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
    const toolResults = [];

    for (const block of toolUseBlocks) {
      console.log(`[${config.name}] → tool: ${block.name}`, JSON.stringify(block.input).slice(0, 120));
      const result = await executeTool(block.name, block.input);
      console.log(`[${config.name}] ← result: ${String(result).slice(0, 120)}`);
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: String(result) });
    }

    // Add assistant turn + tool results, then continue
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: config.model,
      max_tokens: 2048,
      system: config.systemPrompt,
      messages,
      tools
    });
  }

  // Extract final text
  const textBlock = response.content.find(b => b.type === "text");
  return textBlock?.text || "Task completed.";
}

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
    supportedInterfaces: [{ url: `http://localhost:${config.port}`, protocol_binding: "JSONRPC" }]
  };
}

function extractText(message) {
  if (!message) return "";
  if (typeof message === "string") return message;
  if (Array.isArray(message.parts)) return message.parts.filter(p => p.type === "text").map(p => p.text).join("\n");
  return String(message);
}
