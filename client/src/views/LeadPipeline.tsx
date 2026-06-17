import { useEffect, useState } from "react";
import type { Lead } from "../types";

const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "100k": { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400" },
  "30k": { bg: "bg-teal-500/10", border: "border-teal-500/30", text: "text-teal-400" },
  "10k": { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
  "2k": { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400" }
};

const TIER_LABELS: Record<string, string> = {
  "100k": "$100K+/MO",
  "30k": "$30K-$100K/MO",
  "10k": "$10K-$30K/MO",
  "2k": "$2K-$10K/MO"
};

export default function LeadPipeline() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [bookedOnly, setBookedOnly] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/leads")
      .then(r => r.json())
      .then(setLeads)
      .catch(() => {});
  }, []);

  const tierCounts = {
    "100k": leads.filter(l => l.tierKey === "100k").length,
    "30k": leads.filter(l => l.tierKey === "30k").length,
    "10k": leads.filter(l => l.tierKey === "10k").length,
    "2k": leads.filter(l => l.tierKey === "2k").length,
  };

  const filtered = leads.filter(l => {
    if (filter !== "all" && l.tierKey !== filter) return false;
    if (bookedOnly && !l.booked) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-navy-800">
      <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">Lead Pipeline</h1>
        <p className="text-slate-500 text-sm mt-0.5">Qualified inbound leads sorted by revenue tier</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Tier Counters */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {(["100k", "30k", "10k", "2k"] as const).map(tier => {
            const c = TIER_COLORS[tier];
            return (
              <div key={tier} className={`bg-navy-600 border rounded-xl p-4 ${c.border}`}>
                <div className={`text-[9px] uppercase tracking-wider mb-1 ${c.text}`}>{TIER_LABELS[tier]}</div>
                <div className="text-3xl font-bold text-white">{tierCounts[tier]}</div>
                <div className="text-[9px] text-slate-500 mt-1 uppercase tracking-wider">Qualified Leads</div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Name, company, email, website..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 max-w-xs bg-navy-600 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
          <div className="flex gap-1">
            {[
              { key: "all", label: "All Revenue" },
              { key: "100k", label: "$100K+/MO" },
              { key: "30k", label: "$30K-$100K/MO" },
              { key: "10k", label: "$10K-$30K/MO" },
              { key: "2k", label: "$2K-$10K/MO" }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-2.5 py-1 rounded text-[10px] transition-colors ${
                  filter === key
                    ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/30"
                    : "bg-navy-600 text-slate-500 border border-white/5 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <button
            onClick={() => setBookedOnly(!bookedOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              bookedOnly
                ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/30"
                : "bg-navy-600 text-slate-400 border-white/10 hover:text-slate-200"
            }`}
          >
            Booked calls only
          </button>
        </div>

        {/* Lead Cards Grid */}
        <div className="grid grid-cols-3 gap-3">
          {filtered.map(lead => {
            const tc = TIER_COLORS[lead.tierKey];
            return (
              <div
                key={lead.id}
                className={`bg-navy-600 border rounded-xl p-4 card-hover cursor-pointer ${
                  lead.tierKey === "100k" ? "border-green-500/20" :
                  lead.tierKey === "30k" ? "border-teal-500/20" :
                  lead.tierKey === "10k" ? "border-amber-500/20" :
                  "border-orange-500/20"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-[8px] text-slate-600 uppercase tracking-widest font-mono">Qualified Intake Lead</div>
                    <div className="text-white font-bold text-base leading-tight mt-0.5">{lead.name}</div>
                    <div className="text-slate-500 text-[10px] mt-0.5">{lead.company}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${tc.text} ${tc.bg} border ${tc.border}`}>
                      {lead.revenueTier}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      lead.booked
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-slate-500/10 text-slate-500 border border-slate-600/30"
                    }`}>
                      {lead.booked ? "Booked" : "Not Booked"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div>
                    <span className="text-[9px] text-slate-600 font-mono">Marketing: </span>
                    <span className="text-[10px] text-slate-400 line-clamp-2">{lead.marketing}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-600 font-mono">Business: </span>
                    <span className="text-[10px] text-slate-400 line-clamp-2">{lead.business}</span>
                  </div>
                </div>
                <div className="border-t border-white/5 pt-2 space-y-0.5">
                  <div className="text-[9px] text-slate-600 font-mono">Received {lead.receivedAt}</div>
                  {lead.callScheduled && (
                    <div className="text-[9px] text-indigo-400 font-mono">{lead.callScheduled}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-40 text-slate-600 text-sm">No leads match the current filter.</div>
        )}
      </div>
    </div>
  );
}
