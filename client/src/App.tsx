import { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import AgentNetwork from "./views/AgentNetwork";
import CommandCenter from "./views/CommandCenter";
import LeadPipeline from "./views/LeadPipeline";
import ContentAnalytics from "./views/ContentAnalytics";
import KnowledgeVault from "./views/KnowledgeVault";
import TasksView from "./views/TasksView";
import FrontDesk from "./views/FrontDesk";
import ChatView from "./views/ChatView";
import { useWebSocket } from "./hooks/useWebSocket";
import { useAppStore } from "./store/appStore";
import type { Agent, ChatMessage, Task, SystemStats } from "./types";

export type NavItem =
  | "command_center"
  | "agents"
  | "tasks"
  | "schedule"
  | "tools"
  | "front_desk"
  | "lead_pipeline"
  | "content_analytics"
  | "content"
  | "knowledge_vault";

export default function App() {
  const [activeNav, setActiveNav] = useState<NavItem>("agents");
  const [activeChatAgent, setActiveChatAgent] = useState<string>("ceo");
  const [showChat, setShowChat] = useState(false);

  const store = useAppStore();

  const wsUrl = (() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    // In Vite dev, use proxy path; in production/direct access use backend port
    if (window.location.port === "5173") return `${proto}//${host}:3001`;
    return `${proto}//${host}:3001`;
  })();

  const { send } = useWebSocket(wsUrl, {
    onConnected: (connected) => store.setWsConnected(connected),
    onInit: (data: unknown) => {
      const d = data as {
        agentStatuses?: Record<string, string>;
        stats?: SystemStats;
        routes?: number;
        reads?: number;
        directive?: string;
        contextWindow?: { agent: string; tasks: number; lastAction: string };
      };
      if (d.agentStatuses) {
        store.setAgents(prev =>
          prev.map(a => ({
            ...a,
            status: ((d.agentStatuses as Record<string, string>)[a.id] || "idle") as Agent["status"]
          }))
        );
      }
      if (d.stats) store.setStats(d.stats);
      if (d.routes !== undefined) store.setRoutes(d.routes);
      if (d.reads !== undefined) store.setReads(d.reads);
      if (d.directive) store.setDirective(d.directive);
      if (d.contextWindow) store.setContextWindow(d.contextWindow);
    },
    onAgentStatus: (agentId, status, currentTask) => {
      store.updateAgentStatus(agentId, status as Agent["status"], currentTask);
    },
    onChatMessage: (msg: unknown) => {
      const m = msg as ChatMessage;
      store.addChatMessage(m);
    },
    onTaskCreated: (task: unknown) => {
      store.addTask(task as Task);
    },
    onTaskUpdated: (id, status) => {
      store.updateTask(id, status as Task["status"]);
    },
    onCeoDirective: (text) => {
      store.setDirective(text);
    },
    onSystemStats: (data: unknown) => {
      const d = data as { stats?: SystemStats; routes?: number; reads?: number };
      if (d.stats) store.setStats(d.stats);
      if (d.routes !== undefined) store.setRoutes(d.routes);
      if (d.reads !== undefined) store.setReads(d.reads);
    },
    onContextWindow: (data: unknown) => {
      store.setContextWindow(data as { agent: string; tasks: number; lastAction: string });
    }
  });

  const sendMessage = useCallback((content: string, agentId: string) => {
    send({ type: "user_message", content, agentId });
  }, [send]);

  const openChat = useCallback((agentId: string) => {
    setActiveChatAgent(agentId);
    setShowChat(true);
  }, []);

  const ceoAgent = store.agents.find(a => a.id === "ceo");

  const renderView = () => {
    if (showChat) {
      return (
        <ChatView
          agents={store.agents}
          activeAgentId={activeChatAgent}
          chatMessages={store.chatMessages}
          onSendMessage={sendMessage}
          onSelectAgent={setActiveChatAgent}
          onClose={() => setShowChat(false)}
        />
      );
    }
    switch (activeNav) {
      case "agents":
        return (
          <AgentNetwork
            agents={store.agents}
            routes={store.routes}
            reads={store.reads}
            wsConnected={store.wsConnected}
            onChatWithAgent={openChat}
          />
        );
      case "command_center":
        return (
          <CommandCenter
            agents={store.agents}
            stats={store.stats}
            directive={store.directive}
            contextWindow={store.contextWindow}
            tasks={store.tasks}
            onChatWithAgent={openChat}
            chatMessages={store.chatMessages}
            onSendMessage={sendMessage}
          />
        );
      case "front_desk":
        return <FrontDesk />;
      case "lead_pipeline":
        return <LeadPipeline />;
      case "content_analytics":
        return <ContentAnalytics />;
      case "knowledge_vault":
        return <KnowledgeVault />;
      case "tasks":
        return <TasksView agents={store.agents} tasks={store.tasks} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-navy-400">
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-20">🚧</div>
              <div className="text-slate-400 font-mono text-sm">Coming soon</div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-navy-800">
      <Sidebar
        activeNav={activeNav}
        onNavChange={(nav) => { setActiveNav(nav as NavItem); setShowChat(false); }}
        agents={store.agents}
        onChatWithAgent={openChat}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {renderView()}
      </main>
    </div>
  );
}
