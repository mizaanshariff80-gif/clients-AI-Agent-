import { useEffect, useState } from "react";
import type { Agent } from "../types";
import { AGENT_DEFS, AGENT_DESCRIPTIONS } from "../store/appStore";

interface Props {
  agents: Agent[];
  routes: number;
  reads: number;
  wsConnected: boolean;
  onChatWithAgent: (id: string) => void;
}

function StatusBadge({ status }: { status: Agent["status"] }) {
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
      status === "working" ? "text-green-400" :
      status === "waiting" ? "text-amber-400" :
      "text-slate-500"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        status === "working" ? "status-dot-working working-pulse" :
        status === "waiting" ? "status-dot-waiting working-pulse" :
        "status-dot-idle"
      }`} />
      {status}
    </div>
  );
}

function AgentCard({ agent, size = "sm", onClick }: { agent: Agent; size?: "lg" | "sm"; onClick?: () => void }) {
  const def = AGENT_DEFS.find(d => d.id === agent.id);
  const desc = AGENT_DESCRIPTIONS[agent.id] || "";

  if (size === "lg") {
    return (
      <div
        onClick={onClick}
        className="relative bg-navy-600 border border-white/8 rounded-xl p-4 cursor-pointer agent-card-glow card-hover w-72"
        style={{ borderColor: `${agent.color}22` }}
      >
        <div className="absolute top-3 right-3">
          <StatusBadge status={agent.status} />
        </div>
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ backgroundColor: `${agent.color}20`, border: `1px solid ${agent.color}40` }}
          >
            {def?.icon}
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-tight">{agent.name}</div>
            <div className="text-[10px] uppercase tracking-widest font-mono mt-0.5" style={{ color: agent.color }}>
              {agent.role}
            </div>
          </div>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed mb-3">{desc}</p>
        <div className="flex items-center gap-4 text-[10px]">
          <div>
            <div className="text-slate-500 uppercase tracking-wider">Routes</div>
            <div className="text-white font-bold text-sm">{agent.routes ?? 111}</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase tracking-wider">Reads</div>
            <div className="text-white font-bold text-sm">{agent.reads ?? 154}</div>
          </div>
          <div className="ml-auto">
            <div className="text-slate-500 uppercase tracking-wider">Model</div>
            <div className="text-slate-300 font-mono text-[10px]">{agent.model.replace("claude-", "")}</div>
          </div>
        </div>
        {agent.currentTask && (
          <div className="mt-2 text-[10px] text-amber-400/80 truncate">↳ {agent.currentTask}</div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="relative bg-navy-600 border border-white/5 rounded-xl p-3 cursor-pointer agent-card-glow card-hover w-44"
      style={{ borderColor: `${agent.color}18` }}
    >
      <div className="absolute top-2 right-2">
        <StatusBadge status={agent.status} />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ backgroundColor: `${agent.color}20`, border: `1px solid ${agent.color}40` }}
        >
          {def?.icon}
        </div>
        <div>
          <div className="text-white font-semibold text-xs leading-tight">{agent.name}</div>
          <div className="text-[9px] uppercase tracking-wider font-mono leading-tight" style={{ color: agent.color }}>
            {agent.role}
          </div>
        </div>
      </div>
      <p className="text-slate-500 text-[10px] leading-relaxed mb-2 line-clamp-3">{desc}</p>
      <div className="text-[9px]">
        <span className="text-slate-600 uppercase tracking-wider">Model </span>
        <span className="text-slate-400 font-mono">{agent.model.replace("claude-", "")}</span>
      </div>
      {agent.currentTask && (
        <div className="mt-1 text-[9px] text-amber-400/70 truncate">↳ {agent.currentTask}</div>
      )}
    </div>
  );
}

export default function AgentNetwork({ agents, routes, reads, wsConnected, onChatWithAgent }: Props) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const ceo = agents.find(a => a.id === "ceo")!;
  const specialists = agents.filter(a => a.id !== "ceo");

  const ceoWithStats = { ...ceo, routes, reads };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-navy-800">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 flex-shrink-0">
        <div />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-400 working-pulse" : "bg-red-400"}`} />
            <span className="text-xs text-slate-400">
              {wsConnected ? "Agentic System Operational" : "Connecting..."}
            </span>
          </div>
          <div className="text-slate-400 font-mono text-sm">
            {time.toTimeString().slice(0, 8)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mb-1">Agent Network</div>
          <p className="text-slate-400 text-sm">One command brain coordinating five specialist agent roles.</p>
        </div>

        {/* CEO Node */}
        <div className="flex justify-center mb-2">
          <AgentCard agent={ceoWithStats} size="lg" onClick={() => onChatWithAgent("ceo")} />
        </div>

        {/* Connection lines */}
        <div className="flex justify-center mb-2 pointer-events-none" style={{ height: 40 }}>
          <svg width="900" height="40" viewBox="0 0 900 40">
            {specialists.map((_, i) => {
              const count = specialists.length;
              const spacing = 860 / (count - 1);
              const x = 20 + i * spacing;
              return (
                <line
                  key={i}
                  x1="450" y1="0"
                  x2={x} y2="40"
                  stroke="rgba(99,102,241,0.25)"
                  strokeWidth="1"
                  strokeDasharray="4,3"
                />
              );
            })}
          </svg>
        </div>

        {/* Specialist Agents */}
        <div className="flex flex-wrap justify-center gap-3">
          {specialists.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              size="sm"
              onClick={() => onChatWithAgent(agent.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
