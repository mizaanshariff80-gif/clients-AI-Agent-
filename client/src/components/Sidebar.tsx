import type { Agent } from "../types";
import type { NavItem } from "../App";
import { AGENT_DEFS } from "../store/appStore";

interface Props {
  activeNav: NavItem;
  onNavChange: (nav: string) => void;
  agents: Agent[];
  onChatWithAgent: (id: string) => void;
}

const NAV_ITEMS: { id: NavItem; label: string; icon: string }[] = [
  { id: "command_center", label: "Command Center", icon: "⌘" },
  { id: "agents", label: "Agents", icon: "◈" },
  { id: "tasks", label: "Tasks", icon: "☰" },
  { id: "schedule", label: "Schedule", icon: "◷" },
  { id: "tools", label: "Tools", icon: "⚙" },
  { id: "lead_pipeline", label: "Lead Pipeline", icon: "⬡" },
  { id: "content_analytics", label: "Content Analytics", icon: "▣" },
  { id: "content", label: "Content", icon: "+" },
  { id: "knowledge_vault", label: "Knowledge Vault", icon: "⬢" }
];

function StatusDot({ status }: { status: Agent["status"] }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        status === "working"
          ? "status-dot-working"
          : status === "waiting"
          ? "status-dot-waiting"
          : "status-dot-idle"
      }`}
    />
  );
}

export default function Sidebar({ activeNav, onNavChange, agents, onChatWithAgent }: Props) {
  return (
    <aside className="w-44 flex-shrink-0 bg-navy-700 border-r border-white/5 flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="px-3 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            N
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold leading-tight truncate">Nexora AI</div>
            <div className="text-slate-500 text-[9px] uppercase tracking-widest leading-tight">Agentic System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        <div className="space-y-0.5 px-2">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                activeNav === item.id
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <span className="text-[11px] w-3 text-center flex-shrink-0 opacity-60">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Agents Section */}
        <div className="mt-4 px-2">
          <div className="text-[9px] text-slate-600 uppercase tracking-widest px-2 mb-1.5 font-semibold">Agents</div>
          <div className="space-y-0.5">
            {agents.map(agent => {
              const def = AGENT_DEFS.find(d => d.id === agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() => onChatWithAgent(agent.id)}
                  className="w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors group"
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center text-[9px] flex-shrink-0"
                    style={{ backgroundColor: `${agent.color}22`, border: `1px solid ${agent.color}44` }}
                  >
                    <span style={{ color: agent.color }}>{def?.icon || "●"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-slate-300 truncate leading-tight">{agent.name}</div>
                    <div className="text-[8px] text-slate-600 truncate leading-tight">{agent.role}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <StatusDot status={agent.status} />
                    <span className={`text-[8px] ${
                      agent.status === "working" ? "text-green-400" :
                      agent.status === "waiting" ? "text-amber-400" : "text-slate-600"
                    }`}>{agent.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
}
