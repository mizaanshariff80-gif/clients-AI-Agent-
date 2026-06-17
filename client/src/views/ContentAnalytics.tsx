import { useEffect, useRef, useState } from "react";

interface Node {
  id: string;
  label: string;
  type: "topic" | "reel" | "metric";
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphData {
  topics: { id: string; label: string }[];
  reels: { id: string; label: string }[];
  metrics: string[];
  edges: { from: string; to: string }[];
}

interface ContentPost {
  id: string;
  shortId: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  er: number;
  featured?: boolean;
}

const TYPE_COLORS = {
  topic: "#f472b6",
  reel: "#4ade80",
  metric: "#fbbf24"
};

function ContentGraph({ data, selectedNode, onSelectNode }: {
  data: GraphData;
  selectedNode: string | null;
  onSelectNode: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);
  const [size, setSize] = useState({ w: 500, h: 350 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data) return;
    const W = containerRef.current?.clientWidth || 500;
    const H = containerRef.current?.clientHeight || 350;
    setSize({ w: W, h: H });

    const topicCount = data.topics.length;
    const reelCount = data.reels.length;
    const metricCount = data.metrics.length;

    const nodes: Node[] = [
      ...data.topics.map((t, i) => ({
        id: t.id, label: t.label, type: "topic" as const,
        x: W * 0.15, y: H * 0.1 + i * (H * 0.8 / Math.max(topicCount - 1, 1)),
        vx: 0, vy: 0
      })),
      ...data.reels.map((r, i) => ({
        id: r.id, label: r.label, type: "reel" as const,
        x: W * 0.5, y: H * 0.05 + i * (H * 0.9 / Math.max(reelCount - 1, 1)),
        vx: 0, vy: 0
      })),
      ...data.metrics.map((m, i) => ({
        id: m, label: m, type: "metric" as const,
        x: W * 0.85, y: H * 0.2 + i * (H * 0.6 / Math.max(metricCount - 1, 1)),
        vx: 0, vy: 0
      }))
    ];
    nodesRef.current = nodes;
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const nodes = nodesRef.current;
      if (!nodes.length || !data) return;

      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      ctx.lineWidth = 0.8;
      data.edges.forEach(e => {
        const a = nodeMap.get(e.from);
        const b = nodeMap.get(e.to);
        if (!a || !b) return;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(99,102,241,0.25)";
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });

      nodes.forEach(n => {
        const r = n.type === "metric" ? 7 : 6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.id === selectedNode ? "#fff" : TYPE_COLORS[n.type];
        ctx.shadowColor = TYPE_COLORS[n.type];
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = "9px Inter, sans-serif";
        ctx.fillStyle = "rgba(148,163,184,0.85)";
        ctx.textAlign = n.type === "topic" ? "right" : n.type === "metric" ? "left" : "center";
        const offsetX = n.type === "topic" ? -10 : n.type === "metric" ? 10 : 0;
        const offsetY = n.type === "reel" ? -10 : 4;
        ctx.fillText(n.label.slice(0, 20), n.x + offsetX, n.y + offsetY);
      });

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [data, selectedNode]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const nodes = nodesRef.current;
    for (const n of nodes) {
      if (Math.hypot(n.x - mx, n.y - my) < 12) {
        onSelectNode(n.id);
        return;
      }
    }
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        onClick={handleClick}
        className="graph-canvas w-full h-full"
      />
    </div>
  );
}

export default function ContentAnalytics() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);

  useEffect(() => {
    fetch("/api/content")
      .then(r => r.json())
      .then(d => {
        setPosts(d.posts || []);
        setGraphData(d.graph || null);
        if (d.posts?.length) setSelectedPost(d.posts[d.posts.length - 1]);
      })
      .catch(() => {});
  }, []);

  const nodeCount = graphData
    ? graphData.topics.length + graphData.reels.length + graphData.metrics.length
    : 0;
  const edgeCount = graphData?.edges.length || 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-navy-800">
      <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">Content Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Content performance signals and relationship mapping</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Posts List */}
        <div className="mb-6 space-y-2">
          {posts.map(post => (
            <div
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-colors ${
                selectedPost?.id === post.id
                  ? "bg-indigo-600/10 border-indigo-500/30"
                  : "bg-navy-600 border-white/5 hover:border-white/10"
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-navy-700 border border-white/5 flex items-center justify-center text-xl flex-shrink-0">
                🎬
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{post.title}</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-indigo-400 font-mono">{post.shortId}</span>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">{post.likes.toLocaleString()} likes</span>
                    <span className="bg-slate-500/20 text-slate-400 px-1.5 py-0.5 rounded">{post.comments.toLocaleString()} comments</span>
                    <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">ER {post.er.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-white font-bold">{post.views.toLocaleString()}</div>
                <div className="text-[9px] text-slate-500">views</div>
              </div>
            </div>
          ))}
        </div>

        {/* Content Relationship Graph */}
        {graphData && (
          <div className="bg-navy-600 border border-white/5 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">Content relationship graph</div>
                <div className="text-slate-500 text-xs mt-0.5">Reels → topics → performance signal, inspired by Understand-Anything but built native to this dashboard.</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-mono">{nodeCount} nodes • {edgeCount} edges</span>
              </div>
            </div>
            <div className="flex" style={{ height: 380 }}>
              <div className="flex-1 p-2">
                <ContentGraph data={graphData} selectedNode={selectedNode} onSelectNode={setSelectedNode} />
              </div>
              {selectedPost && (
                <div className="w-56 border-l border-white/5 p-4 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-[8px] uppercase tracking-widest text-slate-500 font-mono">Content</span>
                    <span className="text-[8px] uppercase tracking-widest text-slate-500 font-mono">Reel</span>
                    <span className="text-[9px] text-slate-600 font-mono">{selectedPost.shortId}</span>
                  </div>
                  <div className="text-white font-bold text-sm mb-2">{selectedPost.title}</div>
                  <div className="text-[10px] text-slate-400 mb-3">
                    {selectedPost.views.toLocaleString()} views · {selectedPost.comments.toLocaleString()} comments · ER {selectedPost.er.toFixed(2)}%
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded p-2 flex-1 mr-2 text-center">
                        <div className="text-white font-bold text-sm">{selectedPost.views.toLocaleString()}</div>
                        <div className="text-[8px] text-slate-500 uppercase tracking-wider">Views</div>
                      </div>
                      <div className="bg-slate-500/10 border border-slate-500/20 rounded p-2 flex-1 text-center">
                        <div className="text-white font-bold text-sm">{selectedPost.comments.toLocaleString()}</div>
                        <div className="text-[8px] text-slate-500 uppercase tracking-wider">Comments</div>
                      </div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded p-2 text-center">
                      <div className="text-green-400 font-bold text-lg">ER {selectedPost.er.toFixed(2)}%</div>
                    </div>
                  </div>
                  <button className="mt-3 text-[10px] text-indigo-400 hover:underline">Open chart breakdown →</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3">
          {[
            { label: "Topics", color: "#f472b6" },
            { label: "Reels", color: "#4ade80" },
            { label: "Metrics", color: "#fbbf24" }
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
