import { useEffect, useState } from "react";
import type { Agent, Task, SystemStats } from "../types";
import { AGENT_DEFS } from "../store/appStore";

interface Props {
  agents: Agent[];
  stats: SystemStats;
  directive: string;
  contextWindow: { agent: string; tasks: number; lastAction: string };
  tasks: Task[];
  onChatWithAgent: (id: string) => void;
}

function StatusDot({ status }: { status: Agent["status"] }) {
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
      status === "working" ? "status-dot-working working-pulse" :
      status === "waiting" ? "status-dot-waiting working-pulse" :
      "status-dot-idle"
    }`} />
  );
}

function ConfigRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{label}</span>
      <button className="px-2 py-0.5 border border-indigo-500/40 text-indigo-400 text-[9px] uppercase tracking-widest rounded hover:bg-indigo-500/10 transition-colors">
        Config
      </button>
    </div>
  );
}

export default function CommandCenter({ agents, stats, directive, contextWindow, tasks, onChatWithAgent }: Props) {
  const [vps] = useState({ cpu: 30, ram: { used: 2019, total: 7961 }, disk: { used: 50.8, total: 95.0 }, agentDbs: 151.46 });
  const [metrics] = useState({ posts: 7, leads: 17, callsBooked: 24, followUps: 11 });

  const ceoAgent = agents.find(a => a.id === "ceo");
  const contextPct = Math.min(100, (contextWindow.tasks / 200) * 100);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-navy-800">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white">Growth Operations dashboard.</h1>
        <p className="text-slate-500 text-sm mt-0.5">Business outcomes first, with live agent telemetry supporting operator decisions.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          {/* Security Config */}
          <div className="bg-navy-600 border border-white/5 rounded-xl p-4">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-mono mb-3">Security Config</div>
            <ConfigRow label="Mission Control Exposure" />
            <ConfigRow label="SSH Posture" />
            <ConfigRow label="Firewall Posture" />
            <ConfigRow label="Local Data Permissions" />
            <div className="mt-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 working-pulse" />
              <span className="text-[10px] text-slate-500 font-mono">Config posture shown; live VPS metrics on right</span>
            </div>
          </div>

          {/* Current Directive */}
          <div className="bg-navy-600 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 working-pulse" />
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Current Directive</span>
            </div>
            <p className="text-white font-semibold text-sm leading-relaxed">{directive}</p>

            {/* Context Window */}
            <div className="mt-4 p-3 bg-navy-700 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 working-pulse" />
                <span className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Context Window</span>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white text-sm font-semibold">{contextWindow.agent}</span>
                <span className="text-slate-400 text-xs font-mono">{contextWindow.tasks} Tasks</span>
              </div>
              <div className="w-full h-1.5 bg-navy-800 rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                  style={{ width: `${contextPct}%` }}
                />
              </div>
              <p className="text-slate-500 text-[10px] font-mono truncate">↳ {contextWindow.lastAction}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { label: "Integrity", value: `${stats.integrity.toFixed(2)}%` },
                { label: "Agent Calls", value: stats.agentCalls },
                { label: "Messages", value: stats.messages.toLocaleString() },
                { label: "Tokens In", value: stats.tokensIn.toLocaleString() },
                { label: "Errors", value: stats.errors },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[9px] uppercase tracking-wider text-slate-600">{label}</div>
                  <div className={`text-sm font-bold ${label === "Errors" && stats.errors > 0 ? "text-red-400" : "text-white"}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* VPS Health */}
          <div className="bg-navy-600 border border-white/5 rounded-xl p-4">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-mono mb-3">VPS Health</div>
            {[
              { label: "CPU", value: vps.cpu, max: 100, text: `${vps.cpu}%`, color: "from-cyan-500 to-blue-500" },
              { label: "RAM", value: (vps.ram.used / vps.ram.total) * 100, max: 100, text: `${vps.ram.used} / ${vps.ram.total} MB`, color: "from-violet-500 to-purple-500" },
              { label: "Disk", value: (vps.disk.used / vps.disk.total) * 100, max: 100, text: `${vps.disk.used} / ${vps.disk.total} GB`, color: "from-amber-500 to-orange-500" },
            ].map(({ label, value, text, color }) => (
              <div key={label} className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-slate-400">{label}</span>
                  <span className="text-[10px] text-slate-300 font-mono">{text}</span>
                </div>
                <div className="w-full h-1 bg-navy-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${color} transition-all duration-500`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-white/5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Agent DBS</span>
              <span className="text-amber-400 font-mono text-sm font-bold">{vps.agentDbs.toFixed(2)} MB</span>
            </div>
          </div>
        </div>

        {/* Chat with Agent */}
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono mb-3">Chat With An Agent</div>
          <div className="flex gap-2 flex-wrap">
            {agents.map(agent => {
              const def = AGENT_DEFS.find(d => d.id === agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() => onChatWithAgent(agent.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-navy-600 border border-white/5 rounded-lg hover:border-white/15 transition-colors"
                >
                  <div className="w-6 h-6 rounded flex items-center justify-center text-xs" style={{ backgroundColor: `${agent.color}20` }}>
                    {def?.icon}
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-white font-medium">{agent.name}</div>
                    <div className="text-[9px] text-slate-500">{agent.role}</div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <StatusDot status={agent.status} />
                    <span className={`text-[9px] ${
                      agent.status === "working" ? "text-green-400" :
                      agent.status === "waiting" ? "text-amber-400" :
                      "text-slate-500"
                    }`}>{agent.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Business Metrics */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: "Posts This Week", value: metrics.posts, icon: "✦", color: "text-indigo-400" },
            { label: "Active Leads", value: metrics.leads, icon: "◆", color: "text-amber-400" },
            { label: "Calls Booked", value: metrics.callsBooked, icon: "☎", color: "text-green-400" },
            { label: "Follow-up Emails Sent", value: metrics.followUps, icon: "✉", color: "text-blue-400" }
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-navy-600 border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
                <span className={`${color} text-sm`}>{icon}</span>
              </div>
              <div className="text-3xl font-bold text-white">{value}</div>
            </div>
          ))}
        </div>

        {/* Recent Tasks */}
        {tasks.length > 0 && (
          <div className="mt-4 bg-navy-600 border border-white/5 rounded-xl p-4">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-mono mb-3">Live Task Queue</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {tasks.slice(0, 10).map(task => {
                const agent = agents.find(a => a.id === task.agentId);
                const def = AGENT_DEFS.find(d => d.id === task.agentId);
                return (
                  <div key={task.id} className="flex items-center gap-3 text-[11px]">
                    <div className="w-4 h-4 rounded flex items-center justify-center text-[9px] flex-shrink-0"
                      style={{ backgroundColor: `${agent?.color || "#888"}20` }}>
                      {def?.icon}
                    </div>
                    <span className="flex-1 text-slate-300 truncate">{task.title}</span>
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono ${
                      task.status === "completed" ? "bg-green-500/10 text-green-400" :
                      task.status === "in_progress" ? "bg-amber-500/10 text-amber-400" :
                      "bg-slate-500/10 text-slate-500"
                    }`}>{task.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
