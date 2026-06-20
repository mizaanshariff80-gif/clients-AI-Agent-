import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import { sendTaskStreaming, sendTaskAndWait } from "../a2a/a2aClient.js";
import { AGENT_CONFIGS, CEO_CONFIG } from "../a2a/agentConfigs.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const AGENTS = {
  [CEO_CONFIG.id]: CEO_CONFIG,
  ...AGENT_CONFIGS
};

/** Get the A2A base URL for a specialist agent */
function agentUrl(id) {
  const cfg = AGENT_CONFIGS[id];
  return cfg ? `http://localhost:${cfg.port}` : null;
}

export class AgentSystem {
  constructor(broadcast) {
    this.broadcast = broadcast;
    this.stats = { agentCalls: 0, messages: 0, tokensIn: 0, errors: 0, integrity: 96.25 };
    this.agentStatuses = Object.fromEntries(Object.keys(AGENTS).map(id => [id, "idle"]));
    this.routes = 0;
    this.reads = 0;
    this.currentDirective = "System ready — awaiting operator command";
    this.contextWindow = { agent: "CEO", tasks: 0, lastAction: "Initialized" };
    this.ceoHistory = [];
  }

  setAgentStatus(agentId, status, currentTask = null) {
    this.agentStatuses[agentId] = status;
    this.broadcast({ type: "agent_status", agentId, status, currentTask });
  }

  async callCEO(userMessage) {
    this.stats.agentCalls++;
    this.reads++;
    this.ceoHistory.push({ role: "user", content: userMessage });

    const response = await anthropic.messages.create({
      model: CEO_CONFIG.model,
      max_tokens: 3000,
      system: CEO_CONFIG.systemPrompt,
      messages: this.ceoHistory.slice(-14)
    });

    const content = response.content[0].text;
    this.ceoHistory.push({ role: "assistant", content });
    this.stats.tokensIn += response.usage?.input_tokens || 0;
    this.stats.messages += 2;
    return content;
  }

  async processUserMessage(userMessage, targetAgentId = "ceo") {
    // Direct message to specialist agent (not CEO)
    if (targetAgentId !== "ceo") {
      this.broadcast({ type: "chat_message", agentId: targetAgentId, role: "user", content: userMessage, timestamp: new Date().toISOString() });
      const url = agentUrl(targetAgentId);
      if (!url) return;
      this.setAgentStatus(targetAgentId, "working", userMessage.slice(0, 60));

      try {
        const result = await sendTaskStreaming(url, userMessage,
          (event) => {
            if (event?.result?.status?.state) {
              this.broadcast({ type: "agent_status", agentId: targetAgentId, status: "working", currentTask: userMessage.slice(0, 60) });
            }
          }
        );
        const text = result || "Task completed.";
        this.broadcast({ type: "chat_message", agentId: targetAgentId, role: "assistant", content: text, timestamp: new Date().toISOString() });
        this.stats.agentCalls++;
        this.stats.messages += 2;
      } catch (err) {
        this.stats.errors++;
        this.broadcast({ type: "chat_message", agentId: targetAgentId, role: "assistant", content: `Error: ${err.message}`, timestamp: new Date().toISOString() });
      } finally {
        this.setAgentStatus(targetAgentId, "idle");
        this.broadcast({ type: "system_stats", stats: this.stats, routes: this.routes, reads: this.reads });
      }
      return;
    }

    // ─── CEO Orchestration Pipeline ───────────────────────────────────────────
    const masterTaskId = uuidv4();
    this.routes++;

    this.broadcast({ type: "chat_message", agentId: "ceo", role: "user", content: userMessage, timestamp: new Date().toISOString() });
    this.setAgentStatus("ceo", "working", "Analyzing operator request...");
    this.broadcast({ type: "task_created", task: { id: masterTaskId, title: userMessage.slice(0, 80), agentId: "ceo", status: "in_progress", createdAt: new Date().toISOString() } });

    try {
      // Step 1: CEO creates routing plan
      const ceoRoutingResponse = await this.callCEO(userMessage);
      let plan = null;
      try {
        const match = ceoRoutingResponse.match(/\{[\s\S]*\}/);
        plan = match ? JSON.parse(match[0]) : null;
      } catch {}

      if (plan?.directive) {
        this.currentDirective = `CEO — ${plan.directive}`;
        this.broadcast({ type: "ceo_directive", text: this.currentDirective });
      }

      // Acknowledge operator immediately
      if (plan?.operator_ack) {
        this.broadcast({ type: "chat_message", agentId: "ceo", role: "assistant", content: plan.operator_ack, timestamp: new Date().toISOString() });
      }

      // Step 2: Route tasks to agents via A2A protocol in parallel
      const agentResults = {};
      const routing = plan?.routing || {};

      const agentWork = Object.entries(routing)
        .filter(([, task]) => task && task !== "null")
        .map(async ([agentId, taskText]) => {
          const url = agentUrl(agentId);
          if (!url) return;

          const agentTaskId = uuidv4();
          this.setAgentStatus(agentId, "working", String(taskText).slice(0, 60));
          this.broadcast({
            type: "task_created",
            task: { id: agentTaskId, title: String(taskText).slice(0, 80), agentId, status: "in_progress", createdAt: new Date().toISOString() }
          });

          try {
            // Use A2A streaming protocol
            const result = await sendTaskStreaming(url, String(taskText));
            const text = result || "Task completed.";
            agentResults[agentId] = text;
            this.stats.agentCalls++;
            this.stats.messages += 2;
            this.broadcast({ type: "agent_message", agentId, content: text, timestamp: new Date().toISOString() });
            this.broadcast({ type: "task_updated", id: agentTaskId, status: "completed" });
          } catch (err) {
            this.stats.errors++;
            agentResults[agentId] = `Error: ${err.message}`;
            this.broadcast({ type: "task_updated", id: agentTaskId, status: "failed" });
          } finally {
            this.setAgentStatus(agentId, "idle");
          }
        });

      await Promise.all(agentWork);

      // Step 3: CEO synthesizes results and handles remaining tasks
      const hasResults = Object.keys(agentResults).length > 0;

      if (hasResults) {
        this.setAgentStatus("ceo", "working", plan?.ceo_handles?.slice(0, 60) || "Synthesizing agent outputs...");

        const agentSummary = Object.entries(agentResults)
          .map(([id, result]) => `**${AGENTS[id]?.name || id} (${AGENTS[id]?.role || ""}):**\n${result}`)
          .join("\n\n---\n\n");

        const synthesisPrompt = `The operator asked: "${userMessage}"

Your specialist agents have completed their work. Here are their A2A outputs:

${agentSummary}

Now synthesize these findings into a single, clear debrief for the operator.
Format:
1. **Summary** — What was accomplished
2. **Agent Outputs** — Key findings per agent (1-3 bullets each)
3. **Next Steps** — 2-3 specific recommended actions

Be direct, specific, and actionable.`;

        const synthesis = await this.callCEO(synthesisPrompt);
        this.broadcast({ type: "chat_message", agentId: "ceo", role: "assistant", content: synthesis, timestamp: new Date().toISOString() });
      } else if (!plan?.operator_ack) {
        // CEO handled it directly, no agents needed
        const directResponse = await this.callCEO(`Please provide your full response to: "${userMessage}"`);
        this.broadcast({ type: "chat_message", agentId: "ceo", role: "assistant", content: directResponse, timestamp: new Date().toISOString() });
      }

      this.broadcast({ type: "task_updated", id: masterTaskId, status: "completed" });
      this.contextWindow = { agent: "CEO", tasks: ++this.contextWindow.tasks, lastAction: userMessage.slice(0, 80) };
      this.broadcast({ type: "context_window", data: this.contextWindow });

    } catch (err) {
      this.stats.errors++;
      console.error("CEO pipeline error:", err);
      this.broadcast({ type: "chat_message", agentId: "ceo", role: "assistant", content: `Error in CEO pipeline: ${err.message}`, timestamp: new Date().toISOString() });
      this.broadcast({ type: "task_updated", id: masterTaskId, status: "failed" });
    } finally {
      this.setAgentStatus("ceo", "idle");
      this.broadcast({ type: "system_stats", stats: this.stats, routes: this.routes, reads: this.reads });
    }
  }
}
