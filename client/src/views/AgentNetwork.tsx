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

const A2A_PORTS: Record<string, number> = {
  researcher: 3010,
  cmo: 3011,
  sales_rep: 3012,
  dev: 3013,
  data_analyst: 3014
};

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

function CeoCard({ agent, routes, reads, onClick }: { agent: Agent; routes: number; reads: number; onClick: () => void }) {
  const def = AGENT_DEFS.find(d => d.id === agent.id);
  const desc = AGENT_DESCRIPTIONS[agent.id] || "";

  return (
    <div
      onClick={onClick}
      className="relative bg-navy-600 border rounded-xl p-5 cursor-pointer card-hover"
      style={{ borderColor: `${agent.color}30`, boxShadow: `0 0 30px ${agent.color}10` }}
    >
      <div className="absolute top-3 right-3">
        <StatusBadge status={agent.status} />
      </div>
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `radial-gradient(circle at 35% 35%, ${agent.color}60, ${agent.color}20)`, border: `1px solid ${agent.color}50` }}
        >
          {def?.icon}
        </div>
        <div>
          <div className="text-white font-bold text-xl leading-tight">{agent.name}/Orchestrator</div>
          <div className="text-[10px] uppercase tracking-widest font-mono mt-0.5" style={{ color: agent.color }}>
            Command Layer
          </div>
        </div>
      </div>
      <p className="text-slate-400 text-[11px] leading-relaxed mb-4">{desc}</p>
      <div className="grid grid-cols-3 gap-3 text-[10px]">
        <div className="bg-navy-700 rounded-lg px-3 py-2">
          <div className="text-slate-500 uppercase tracking-wider mb-0.5">Routes</div>
          <div className="text-white font-bold text-lg">{routes}</div>
        </div>
        <div className="bg-navy-700 rounded-lg px-3 py-2">
          <div className="text-slate-500 uppercase tracking-wider mb-0.5">Reads</div>
          <div className="text-white font-bold text-lg">{reads}</div>
        </div>
        <div className="bg-navy-700 rounded-lg px-3 py-2">
          <div className="text-slate-500 uppercase tracking-wider mb-0.5">Model</div>
          <div className="text-slate-300 font-mono text-[10px] mt-0.5 leading-tight">
            {agent.model.replace("claude-", "")}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
        <span className="text-[9px] text-slate-600 font-mono">A2A Orchestrator · port 3001</span>
      </div>
      {agent.currentTask && (
        <div className="mt-2 text-[10px] text-amber-400/80 truncate border-t border-white/5 pt-2">
          ↳ {agent.currentTask}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const def = AGENT_DEFS.find(d => d.id === agent.id);
  const desc = AGENT_DESCRIPTIONS[agent.id] || "";
  const port = A2A_PORTS[agent.id];
  const [cardFetched, setCardFetched] = useState(false);

  useEffect(() => {
    fetch(`/api/agent-card/${agent.id}`)
      .then(r => r.ok ? setCardFetched(true) : null)
      .catch(() => {});
  }, [agent.id]);

  return (
    <div
      onClick={onClick}
      className="relative bg-navy-600 border rounded-xl p-3 cursor-pointer card-hover"
      style={{ borderColor: `${agent.color}18`, width: 176 }}
    >
      <div className="absolute top-2 right-2">
        <StatusBadge status={agent.status} />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
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
      <div className="space-y-1 text-[9px]">
        <div>
          <span className="text-slate-600 uppercase tracking-wider">Model </span>
          <span className="text-slate-400 font-mono">{agent.model.replace("claude-", "")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cardFetched ? "bg-green-400" : "bg-slate-600"}`}
          />
          <span className="text-slate-600 font-mono">
            A2A :{port} {cardFetched ? "· card ✓" : "· connecting"}
          </span>
        </div>
      </div>
      {agent.currentTask && (
        <div className="mt-1.5 text-[9px] text-amber-400/70 truncate border-t border-white/5 pt-1.5">
          ↳ {agent.currentTask}
        </div>
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
        <div className="mb-6">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mb-1">Agent Network</div>
          <p className="text-slate-400 text-sm">One command brain coordinating five specialist agents via A2A protocol.</p>
          <div className="flex items-center gap-4 mt-2 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              <span className="text-slate-500">CEO Orchestrator :3001</span>
            </div>
            {specialists.map(a => (
              <div key={a.id} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                <span className="text-slate-500">{a.name} :{A2A_PORTS[a.id]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CEO Node */}
        <div className="flex justify-center mb-2">
          <CeoCard agent={ceo} routes={routes} reads={reads} onClick={() => onChatWithAgent("ceo")} />
        </div>

        {/* Connection lines SVG */}
        <div className="flex justify-center mb-2 pointer-events-none" style={{ height: 44 }}>
          <svg width="960" height="44" viewBox="0 0 960 44">
            {specialists.map((_, i) => {
              const count = specialists.length;
              const spacing = 860 / (count - 1);
              const x = 50 + i * spacing;
              return (
                <g key={i}>
                  <line x1="480" y1="0" x2={x} y2="44"
                    stroke="rgba(99,102,241,0.2)" strokeWidth="1" strokeDasharray="4,3" />
                  <circle cx={x} cy="44" r="2.5" fill="rgba(99,102,241,0.5)" />
                </g>
              );
            })}
            <circle cx="480" cy="0" r="3" fill="rgba(139,92,246,0.7)" />
          </svg>
        </div>

        {/* Specialist Agents */}
        <div className="flex flex-wrap justify-center gap-3">
          {specialists.map(agent => (
            <AgentCard key={agent.id} agent={agent} onClick={() => onChatWithAgent(agent.id)} />
          ))}
        </div>

        {/* A2A Protocol Info */}
        <div className="mt-8 mx-auto max-w-2xl bg-navy-700 border border-white/5 rounded-xl p-4">
          <div className="text-[9px] uppercase tracking-widest text-indigo-400 font-mono mb-2">A2A Protocol Active</div>
          <p className="text-slate-500 text-[10px] leading-relaxed">
            Each agent runs as an independent HTTP server exposing a discovery card at{" "}
            <code className="text-indigo-400 font-mono">/.well-known/agent-card.json</code> and a JSON-RPC endpoint for{" "}
            <code className="text-slate-400 font-mono">tasks/send</code>,{" "}
            <code className="text-slate-400 font-mono">tasks/get</code>, and{" "}
            <code className="text-slate-400 font-mono">tasks/sendSubscribe</code>.
            The CEO fetches agent cards, routes tasks, and synthesizes outputs into a final debrief.
          </p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {specialists.map(a => (
              <div key={a.id} className="text-center">
                <div className="text-[8px] font-mono text-slate-600">:{A2A_PORTS[a.id]}</div>
                <div className="text-[9px]" style={{ color: a.color }}>{a.name}</div>
                <div className="text-[8px] text-slate-600">card ✓</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
