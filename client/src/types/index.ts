export type AgentStatus = "working" | "waiting" | "idle";

export interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  model: string;
  status: AgentStatus;
  currentTask?: string;
  routes?: number;
  reads?: number;
}

export interface ChatMessage {
  id: string;
  agentId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  agentId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  priority?: "low" | "medium" | "high";
  createdAt: string;
}

export interface SystemStats {
  agentCalls: number;
  messages: number;
  tokensIn: number;
  errors: number;
  integrity: number;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  revenueTier: string;
  tierKey: string;
  booked: boolean;
  marketing: string;
  business: string;
  receivedAt: string;
  callScheduled: string | null;
}

export interface ContentPost {
  id: string;
  shortId: string;
  title: string;
  thumbnail: string | null;
  views: number;
  likes: number;
  comments: number;
  er: number;
  type: string;
  featured?: boolean;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  type: "agent" | "memory" | "data" | "topic" | "content";
  description: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}
