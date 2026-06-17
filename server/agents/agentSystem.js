import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";

const apiKey = process.env.ANTHROPIC_API_KEY;
const hasApiKey = apiKey && apiKey !== "your_anthropic_api_key_here";
const client = hasApiKey ? new Anthropic({ apiKey }) : null;

const SIMULATED_RESPONSES = {
  ceo: `{"directive": "Routing operator request to specialist team", "agentTasks": {"researcher": "Research market signals and competitive landscape relevant to the query", "cmo": "Develop content angle and messaging strategy"}, "ceoTask": "Synthesize findings and deliver operator debrief", "response": "Task received. I've routed research to the Researcher and content strategy to the CMO. Standing by to synthesize their outputs and deliver your debrief."}`,
  researcher: "Market research complete. Key signals identified: growing demand in target segment, 3 direct competitors, opportunity window estimated at 6-8 months. Primary sources analyzed and strategic context documented.",
  cmo: "Content strategy developed. Recommended angle: lead with transformation story, pain-point first approach. Draft hook: 'What if your marketing ran itself?' 3 content variations ready for review.",
  sales_rep: "Lead qualification complete. ICP score: 8/10. Decision maker identified. Recommended outreach: personalized case study approach. Follow-up sequence: Day 1 intro, Day 3 value prop, Day 7 social proof.",
  dev: "Technical analysis complete. Zapier automation flow mapped out. 3 steps: trigger on form submit → enrich via Clay → push to CRM. Estimated build time: 45 minutes.",
  data_analyst: "Performance analysis complete. Engagement rate trending +23% WoW. Top performing content: system demos. Conversion funnel drop-off at step 3 — recommend A/B test on CTA copy."
};

export const AGENTS = {
  ceo: {
    id: "ceo",
    name: "CEO",
    role: "Command Layer",
    model: "claude-sonnet-4-6",
    color: "#8b5cf6",
    systemPrompt: `You are the CEO/Orchestrator of Nexora AI System, a multi-agent growth operations platform.

Your role:
- Receive tasks/questions from the operator (user)
- Analyze what needs to be done and create a clear task plan
- Route subtasks to the correct specialist agents
- Do remaining high-level synthesis tasks yourself
- Return a clear debrief to the operator

Your specialist agents:
- Researcher (Intel Gatherer): market research, competitive analysis, finding information
- CMO (Market Voice): content strategy, marketing campaigns, copy writing
- Sales Rep (Revenue Ops): lead qualification, outreach copy, follow-up sequences
- Dev (Build System): technical tasks, automations, integrations, code
- Data Analyst (Signal Layer): data analysis, performance metrics, reporting

When given a task, respond in this JSON format:
{
  "directive": "One sentence describing what the CEO is doing",
  "agentTasks": {
    "researcher": "specific task or null",
    "cmo": "specific task or null",
    "sales_rep": "specific task or null",
    "dev": "specific task or null",
    "data_analyst": "specific task or null"
  },
  "ceoTask": "What the CEO will handle personally",
  "response": "Your direct response to the operator"
}`
  },
  researcher: {
    id: "researcher",
    name: "Researcher",
    role: "Intel Gatherer",
    model: "claude-haiku-4-5-20251001",
    color: "#3b82f6",
    systemPrompt: `You are the Researcher agent in the Nexora AI System multi-agent team.

Your specialty: Intel Gathering — finding market signals, research briefs, competitive analysis, strategic context.

You report to the CEO. Be concise, data-focused, and actionable. Format responses as clear bullet points.`
  },
  cmo: {
    id: "cmo",
    name: "CMO",
    role: "Market Voice",
    model: "claude-haiku-4-5-20251001",
    color: "#f97316",
    systemPrompt: `You are the CMO agent in the Nexora AI System multi-agent team.

Your specialty: Market Voice — content angles, campaigns, publish-ready drafts, brand voice, messaging.

You report to the CEO. Be creative, strategic, and output-ready. Provide specific usable content.`
  },
  sales_rep: {
    id: "sales_rep",
    name: "Sales Rep",
    role: "Revenue Ops",
    model: "claude-haiku-4-5-20251001",
    color: "#ec4899",
    systemPrompt: `You are the Sales Rep agent in the Nexora AI System multi-agent team.

Your specialty: Revenue Ops — lead qualification, outreach copy, follow-up sequences, pipeline intelligence.

You report to the CEO. Be direct, focused on revenue, and action-oriented.`
  },
  dev: {
    id: "dev",
    name: "Dev",
    role: "Build System",
    model: "claude-haiku-4-5-20251001",
    color: "#06b6d4",
    systemPrompt: `You are the Dev agent in the Nexora AI System multi-agent team.

Your specialty: Build System — dashboards, automations, integrations, scripts, Zapier/Make, APIs.

You report to the CEO. Be technical, precise, and implementation-ready.`
  },
  data_analyst: {
    id: "data_analyst",
    name: "Data Analyst",
    role: "Signal Layer",
    model: "claude-haiku-4-5-20251001",
    color: "#6366f1",
    systemPrompt: `You are the Data Analyst agent in the Nexora AI System multi-agent team.

Your specialty: Signal Layer — performance metrics, trend analysis, reporting, engagement signals.

You report to the CEO. Be analytical, precise, and insight-driven with specific numbers.`
  }
};

export class AgentSystem {
  constructor(broadcast) {
    this.broadcast = broadcast;
    this.stats = {
      agentCalls: 0,
      messages: 0,
      tokensIn: 0,
      errors: 0,
      integrity: 96.25
    };
    this.tasks = [];
    this.agentStatuses = {
      ceo: "idle",
      researcher: "idle",
      cmo: "idle",
      sales_rep: "idle",
      dev: "idle",
      data_analyst: "idle"
    };
    this.routes = 0;
    this.reads = 0;
    this.currentDirective = "System ready — awaiting operator command";
    this.contextWindow = { agent: "CEO", tasks: 0, lastAction: "Initialized" };
    this.chatHistories = {};
    Object.keys(AGENTS).forEach(id => { this.chatHistories[id] = []; });

    if (!hasApiKey) {
      console.log("⚠  No Anthropic API key found — running in demo mode with simulated responses.");
    } else {
      console.log("✓ Anthropic API key detected — AI agents are live.");
    }
  }

  setAgentStatus(agentId, status, currentTask = null) {
    this.agentStatuses[agentId] = status;
    this.broadcast({ type: "agent_status", agentId, status, currentTask });
  }

  async callAgent(agentId, userMessage) {
    const agent = AGENTS[agentId];
    this.stats.agentCalls++;
    this.reads++;

    const history = this.chatHistories[agentId];
    history.push({ role: "user", content: userMessage });

    if (!hasApiKey || !client) {
      await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
      const response = SIMULATED_RESPONSES[agentId] || "Task completed. Findings documented.";
      history.push({ role: "assistant", content: response });
      this.stats.messages += 2;
      return response;
    }

    try {
      const response = await client.messages.create({
        model: agent.model,
        max_tokens: 1024,
        system: agent.systemPrompt,
        messages: history.slice(-10)
      });

      const content = response.content[0].text;
      history.push({ role: "assistant", content });
      this.stats.tokensIn += response.usage?.input_tokens || 0;
      this.stats.messages += 2;
      return content;
    } catch (err) {
      this.stats.errors++;
      console.error(`Agent ${agentId} error:`, err.message);
      throw err;
    }
  }

  async processUserMessage(userMessage, targetAgentId = "ceo") {
    const taskId = uuidv4();

    this.broadcast({ type: "chat_message", agentId: targetAgentId, role: "user", content: userMessage, timestamp: new Date().toISOString() });

    if (targetAgentId !== "ceo") {
      this.setAgentStatus(targetAgentId, "working", userMessage.slice(0, 60));
      try {
        const response = await this.callAgent(targetAgentId, userMessage);
        this.broadcast({ type: "chat_message", agentId: targetAgentId, role: "assistant", content: response, timestamp: new Date().toISOString() });
        this.setAgentStatus(targetAgentId, "idle");
        this.broadcast({ type: "system_stats", stats: this.stats });
        return;
      } catch (e) {
        this.setAgentStatus(targetAgentId, "idle");
        this.broadcast({ type: "error", message: e.message });
        return;
      }
    }

    this.setAgentStatus("ceo", "working", "Analyzing operator request...");
    this.routes++;

    const taskCreated = {
      id: taskId,
      title: userMessage.slice(0, 80),
      agentId: "ceo",
      status: "in_progress",
      createdAt: new Date().toISOString()
    };
    this.broadcast({ type: "task_created", task: taskCreated });

    try {
      const ceoResponse = await this.callAgent("ceo", userMessage);

      let plan = null;
      try {
        const jsonMatch = ceoResponse.match(/\{[\s\S]*\}/);
        plan = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {}

      if (plan?.directive) {
        this.currentDirective = `CEO — ${plan.directive}`;
        this.broadcast({ type: "ceo_directive", text: this.currentDirective });
      }

      const agentResults = {};

      if (plan?.agentTasks) {
        const agentWork = Object.entries(plan.agentTasks)
          .filter(([, task]) => task && task !== "null")
          .map(async ([agentId, task]) => {
            this.setAgentStatus(agentId, "working", String(task).slice(0, 60));

            const agentTaskId = uuidv4();
            this.broadcast({
              type: "task_created",
              task: { id: agentTaskId, title: String(task).slice(0, 80), agentId, status: "in_progress", createdAt: new Date().toISOString() }
            });

            try {
              const result = await this.callAgent(agentId, String(task));
              agentResults[agentId] = result;
              this.broadcast({ type: "agent_message", agentId, content: result, timestamp: new Date().toISOString() });
              this.broadcast({ type: "task_updated", id: agentTaskId, status: "completed" });
            } catch {
              agentResults[agentId] = "Error completing task";
            } finally {
              this.setAgentStatus(agentId, "idle");
            }
          });

        await Promise.all(agentWork);
      }

      let finalResponse = plan?.response || ceoResponse;

      if (Object.keys(agentResults).length > 0 && plan?.ceoTask) {
        this.setAgentStatus("ceo", "working", String(plan.ceoTask).slice(0, 60));
        const synthesisPrompt = `You previously planned: ${JSON.stringify(plan)}\n\nAgent results:\n${Object.entries(agentResults).map(([id, r]) => `**${id}**: ${r}`).join("\n\n")}\n\nSynthesize these findings and deliver a clear, actionable response to the operator. Be direct and concise — no fluff.`;

        try {
          const synthesis = await this.callAgent("ceo", synthesisPrompt);
          finalResponse = synthesis;
        } catch {}
      }

      this.broadcast({ type: "chat_message", agentId: "ceo", role: "assistant", content: finalResponse, timestamp: new Date().toISOString() });
      this.broadcast({ type: "task_updated", id: taskId, status: "completed" });

      this.contextWindow = {
        agent: "CEO",
        tasks: ++this.contextWindow.tasks,
        lastAction: userMessage.slice(0, 80)
      };
      this.broadcast({ type: "context_window", data: this.contextWindow });

    } catch (err) {
      this.stats.errors++;
      const errMsg = hasApiKey
        ? `Error: ${err.message}`
        : "Demo mode active — add your ANTHROPIC_API_KEY to /server/.env for live AI agents.";
      this.broadcast({ type: "chat_message", agentId: "ceo", role: "assistant", content: errMsg, timestamp: new Date().toISOString() });
    } finally {
      this.setAgentStatus("ceo", "idle");
      this.broadcast({ type: "system_stats", stats: this.stats, routes: this.routes, reads: this.reads });
    }
  }
}
