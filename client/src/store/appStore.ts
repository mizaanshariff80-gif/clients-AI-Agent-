import { useState, useCallback } from "react";
import type { Agent, ChatMessage, Task, SystemStats } from "../types";

export const AGENT_DEFS = [
  { id: "ceo", name: "CEO", role: "Command Layer", color: "#8b5cf6", model: "claude-sonnet-4-6", icon: "♟" },
  { id: "researcher", name: "Researcher", role: "Intel Gatherer", color: "#3b82f6", model: "claude-haiku-4-5", icon: "🔍" },
  { id: "cmo", name: "CMO", role: "Market Voice", color: "#f97316", model: "claude-haiku-4-5", icon: "📣" },
  { id: "sales_rep", name: "Sales Rep", role: "Revenue Ops", color: "#ec4899", model: "claude-haiku-4-5", icon: "💰" },
  { id: "dev", name: "Dev", role: "Build System", color: "#06b6d4", model: "claude-haiku-4-5", icon: "⚙" },
  { id: "data_analyst", name: "Data Analyst", role: "Signal Layer", color: "#6366f1", model: "claude-haiku-4-5", icon: "📊" },
  { id: "front_desk", name: "Front Desk", role: "Reviews + Reception", color: "#14b8a6", model: "claude-sonnet-4-6", icon: "☎" }
];

export const AGENT_DESCRIPTIONS: Record<string, string> = {
  ceo: "Routes work, reviews context, coordinates specialists, and returns the operator debrief.",
  researcher: "Finds market signals, research briefs, sources, and strategic context.",
  cmo: "Turns strategy into content angles, campaigns, and publish-ready drafts.",
  sales_rep: "Qualifies leads, drafts outreach, and tracks follow-up opportunities.",
  dev: "Builds dashboards, integrations, scripts, and verifies technical changes.",
  data_analyst: "Analyzes performance, trends, records, and operational signal quality.",
  front_desk: "Answers customers, books appointments, and manages Google reviews — two agents in one, fully editable."
};

export function createInitialAgents(): Agent[] {
  return AGENT_DEFS.map(a => ({ ...a, status: "idle" as const }));
}

export function useAppStore() {
  const [agents, setAgents] = useState<Agent[]>(createInitialAgents());
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<SystemStats>({ agentCalls: 0, messages: 0, tokensIn: 0, errors: 0, integrity: 96.25 });
  const [directive, setDirective] = useState("System ready — awaiting operator command");
  const [contextWindow, setContextWindow] = useState({ agent: "CEO", tasks: 0, lastAction: "Initialized" });
  const [routes, setRoutes] = useState(0);
  const [reads, setReads] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

  const updateAgentStatus = useCallback((agentId: string, status: Agent["status"], currentTask?: string) => {
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status, currentTask } : a));
  }, []);

  const addChatMessage = useCallback((msg: ChatMessage) => {
    setChatMessages(prev => ({
      ...prev,
      [msg.agentId]: [...(prev[msg.agentId] || []), msg]
    }));
  }, []);

  const addTask = useCallback((task: Task) => {
    setTasks(prev => [task, ...prev.slice(0, 49)]);
  }, []);

  const updateTask = useCallback((id: string, status: Task["status"]) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }, []);

  return {
    agents, setAgents,
    chatMessages, setChatMessages,
    tasks, setTasks,
    stats, setStats,
    directive, setDirective,
    contextWindow, setContextWindow,
    routes, setRoutes,
    reads, setReads,
    wsConnected, setWsConnected,
    updateAgentStatus,
    addChatMessage,
    addTask,
    updateTask
  };
}
