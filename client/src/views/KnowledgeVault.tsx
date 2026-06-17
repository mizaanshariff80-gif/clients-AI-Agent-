import { useEffect, useRef, useState } from "react";
import type { KnowledgeNode } from "../types";

const TYPE_COLORS: Record<string, string> = {
  agent: "#8b5cf6",
  memory: "#3b82f6",
  data: "#f59e0b",
  topic: "#f472b6",
  content: "#4ade80"
};

const TYPE_SIZES: Record<string, number> = {
  agent: 10,
  memory: 8,
  data: 7,
  topic: 9,
  content: 7
};

function KnowledgeGraph({
  nodes,
  selectedId,
  onSelect
}: { nodes: KnowledgeNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{ nodes: KnowledgeNode[]; dragging: string | null; mouseX: number; mouseY: number }>({
    nodes: [],
    dragging: null,
    mouseX: 0,
    mouseY: 0
  });
  const animRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 500, h: 400 });

  const EDGES: [string, string][] = [
    ["ceo", "researcher"], ["ceo", "cmo"], ["ceo", "sales_rep"], ["ceo", "dev"], ["ceo", "data_analyst"],
    ["researcher", "mem_leads"], ["cmo", "mem_content"], ["sales_rep", "mem_leads"],
    ["dev", "mem_pipeline"], ["data_analyst", "mem_shared"],
    ["mem_leads", "topic_growth"], ["mem_content", "topic_systems"],
    ["topic_systems", "doc_dashboard"], ["doc_dashboard", "artifact_writing"],
    ["doc_model_dev", "ceo"], ["mem_shared", "ceo"]
  ];

  useEffect(() => {
    const W = containerRef.current?.clientWidth || 500;
    const H = containerRef.current?.clientHeight || 400;
    setSize({ w: W, h: H });

    const scaleX = W / 800;
    const scaleY = H / 600;
    stateRef.current.nodes = nodes.map(n => ({
      ...n,
      x: n.x * scaleX,
      y: n.y * scaleY,
      vx: 0,
      vy: 0
    }));
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function simulate() {
      const ns = stateRef.current.nodes;
      const k = 0.005;
      const repel = 1200;
      const damping = 0.85;

      ns.forEach(a => {
        ns.forEach(b => {
          if (a.id === b.id) return;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = repel / (dist * dist);
          (a.vx as number) += (dx / dist) * force;
          (a.vy as number) += (dy / dist) * force;
        });
      });

      EDGES.forEach(([aid, bid]) => {
        const a = ns.find(n => n.id === aid);
        const b = ns.find(n => n.id === bid);
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const ideal = 100;
        const force = (dist - ideal) * k;
        (a.vx as number) += (dx / dist) * force;
        (a.vy as number) += (dy / dist) * force;
        (b.vx as number) -= (dx / dist) * force;
        (b.vy as number) -= (dy / dist) * force;
      });

      const W = size.w, H = size.h;
      ns.forEach(n => {
        if (stateRef.current.dragging === n.id) return;
        n.vx = ((n.vx || 0) * damping) as number;
        n.vy = ((n.vy || 0) * damping) as number;
        n.x = Math.max(20, Math.min(W - 20, n.x + (n.vx || 0)));
        n.y = Math.max(20, Math.min(H - 20, n.y + (n.vy || 0)));
      });
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ns = stateRef.current.nodes;
      simulate();
      const nodeMap = new Map(ns.map(n => [n.id, n]));

      EDGES.forEach(([aid, bid]) => {
        const a = nodeMap.get(aid);
        const b = nodeMap.get(bid);
        if (!a || !b) return;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(99,102,241,0.2)";
        ctx.lineWidth = 0.8;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });

      ns.forEach(n => {
        const r = TYPE_SIZES[n.type] || 6;
        const color = TYPE_COLORS[n.type] || "#888";
        const isSelected = n.id === selectedId;

        ctx.beginPath();
        ctx.arc(n.x, n.y, r + (isSelected ? 3 : 0), 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#fff" : color;
        ctx.shadowColor = color;
        ctx.shadowBlur = isSelected ? 16 : 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = "8px Inter, sans-serif";
        ctx.fillStyle = isSelected ? "#e2e8f0" : "rgba(148,163,184,0.7)";
        ctx.textAlign = "center";
        ctx.fillText(n.label.slice(0, 16), n.x, n.y + r + 10);
      });

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [selectedId, size]);

  function handleMouseDown(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ns = stateRef.current.nodes;
    for (const n of ns) {
      const r = TYPE_SIZES[n.type] || 6;
      if (Math.hypot(n.x - mx, n.y - my) < r + 4) {
        stateRef.current.dragging = n.id;
        stateRef.current.mouseX = mx;
        stateRef.current.mouseY = my;
        onSelect(n.id);
        return;
      }
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!stateRef.current.dragging) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ns = stateRef.current.nodes;
    const node = ns.find(n => n.id === stateRef.current.dragging);
    if (node) {
      node.x = mx;
      node.y = my;
    }
  }

  function handleMouseUp() {
    stateRef.current.dragging = null;
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="graph-canvas w-full h-full"
      />
    </div>
  );
}

export default function KnowledgeVault() {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>("ceo");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/knowledge")
      .then(r => r.json())
      .then(d => setNodes(d.nodes || []))
      .catch(() => {});
  }, []);

  const selectedNode = nodes.find(n => n.id === selectedId);
  const totalEdges = 210;

  const filteredNodes = filter === "ALL" ? nodes : nodes.filter(n => {
    const map: Record<string, string> = {
      AGENTS: "agent", MEMORIES: "memory", DATA: "data", TOPICS: "topic", CONTENT: "content"
    };
    return map[filter] ? n.type === map[filter] : true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-navy-800">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
        <div className="text-[9px] text-slate-500 uppercase tracking-widest font-mono mb-1">Obsidian Memory Layer</div>
        <h1 className="text-2xl font-bold text-white">Knowledge graph powering the agentic OS.</h1>
        <p className="text-slate-500 text-xs mt-1 max-w-2xl">
          Indexed from real local memories, agent vault notes, dashboard data, and runtime artifacts — rendered as a dense colored graph so the system feels like a living second brain.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 working-pulse" />
          <span className="text-[10px] text-green-400 font-mono">Indexed 0s ago</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 px-6 py-3 border-b border-white/5 flex-shrink-0">
        {[
          { label: "Nodes", value: nodes.length || 46, sub: "Indexed Graph" },
          { label: "Edges", value: totalEdges, sub: "Relationships" },
          { label: "Sources", value: 5, sub: "Local Roots" },
          { label: "Files", value: 32, sub: "Real Artifacts", highlight: true }
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className="bg-navy-600 border border-white/5 rounded-lg px-4 py-2 min-w-[90px]">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
            <div className={`text-2xl font-bold ${highlight ? "text-red-400" : "text-white"}`}>{value}</div>
            <div className="text-[8px] text-slate-600 uppercase tracking-wider">{sub}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Search + Filters */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search agents, memories, notes, topics, paths..."
            className="flex-1 bg-navy-600 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
          <div className="flex gap-1">
            {["ALL", "AGENTS", "MEMORIES", "CONTENT", "DATA", "SYSTEM", "TOPICS"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 rounded text-[9px] font-mono transition-colors ${
                  filter === f
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                    : "bg-navy-600 text-slate-500 border border-white/5 hover:text-slate-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Graph + Panel */}
        <div className="bg-navy-600 border border-white/5 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <div className="text-white font-semibold">Colored memory/database topology</div>
              <div className="text-slate-500 text-xs">Agents, memories, vault docs, data artifacts, config nodes, and topic hubs.</div>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">{filteredNodes.length} nodes • {totalEdges} edges</span>
          </div>
          <div className="flex" style={{ height: 420 }}>
            <div className="flex-1 p-2">
              <KnowledgeGraph nodes={filteredNodes} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            {/* Right Panel */}
            {selectedNode && (
              <div className="w-56 border-l border-white/5 p-4 flex-shrink-0">
                <div className="flex flex-wrap items-center gap-1 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[selectedNode.type] }} />
                  <span className="text-[8px] uppercase tracking-widest text-slate-500 font-mono">Agents</span>
                  <span className="text-[8px] text-indigo-400 uppercase font-mono">{selectedNode.type.toUpperCase()}</span>
                </div>
                <div className="text-white font-bold text-sm mb-2">{selectedNode.label}</div>
                <p className="text-slate-500 text-[11px] leading-relaxed mb-4">{selectedNode.description}</p>

                <div className="space-y-2 text-[10px]">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-600 uppercase">Agent</span>
                    <span className="text-slate-400">Local</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">0 Bytes</span>
                    <span className="text-slate-600">0 Links</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {["specialist-agent", "orchestrates", "contexts", "owns_context"].map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[8px] uppercase tracking-wider font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-slate-500 capitalize">{type}s</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
