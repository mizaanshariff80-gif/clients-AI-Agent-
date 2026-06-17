import { useEffect, useState } from "react";
import type { Agent, Task } from "../types";
import { AGENT_DEFS } from "../store/appStore";

interface Props {
  agents: Agent[];
  tasks: Task[];
}

export default function TasksView({ agents, tasks: liveTasks }: Props) {
  const [staticTasks, setStaticTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/tasks")
      .then(r => r.json())
      .then(setStaticTasks)
      .catch(() => {});
  }, []);

  const allTasks = [...liveTasks, ...staticTasks.filter(st => !liveTasks.find(lt => lt.id === st.id))];

  const filtered = allTasks.filter(t => filter === "all" || t.status === filter);

  const counts = {
    all: allTasks.length,
    in_progress: allTasks.filter(t => t.status === "in_progress").length,
    pending: allTasks.filter(t => t.status === "pending").length,
    completed: allTasks.filter(t => t.status === "completed").length,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-navy-800">
      <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">Task Queue</h1>
        <p className="text-slate-500 text-sm mt-0.5">Live and historical agent task assignments</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { key: "all", label: `All (${counts.all})` },
            { key: "in_progress", label: `In Progress (${counts.in_progress})` },
            { key: "pending", label: `Pending (${counts.pending})` },
            { key: "completed", label: `Completed (${counts.completed})` }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                filter === key
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "bg-navy-600 text-slate-500 border border-white/5 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map(task => {
            const agent = agents.find(a => a.id === task.agentId);
            const def = AGENT_DEFS.find(d => d.id === task.agentId);
            return (
              <div
                key={task.id}
                className="flex items-center gap-4 p-3 bg-navy-600 border border-white/5 rounded-xl hover:border-white/10 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ backgroundColor: `${agent?.color || "#888"}20`, border: `1px solid ${agent?.color || "#888"}30` }}
                >
                  {def?.icon || "●"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-medium truncate">{task.title}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    <span style={{ color: agent?.color }}>{agent?.name || task.agentId}</span>
                    <span className="mx-1 text-slate-700">·</span>
                    {new Date(task.createdAt).toLocaleString()}
                  </div>
                </div>
                {task.priority && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                    task.priority === "high" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                    task.priority === "medium" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                    "bg-slate-500/10 text-slate-500 border border-slate-600/20"
                  }`}>
                    {task.priority}
                  </span>
                )}
                <span className={`text-[9px] px-2 py-0.5 rounded font-mono ${
                  task.status === "completed" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                  task.status === "in_progress" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                  task.status === "failed" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                  "bg-slate-500/10 text-slate-500 border border-slate-600/20"
                }`}>
                  {task.status.replace("_", " ")}
                </span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">No tasks in this view.</div>
          )}
        </div>
      </div>
    </div>
  );
}
