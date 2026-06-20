import { useEffect, useState } from "react";

interface Lead {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  company: string;
  industry?: string;
  state?: string;
  linkedin?: string;
  website?: string;
  status?: string;
  emailStatus?: string;
  followupAt?: string;
  lastContactedAt?: string;
  addedAt?: string;
  // mock lead compat
  tierKey?: string;
  revenueTier?: string;
  marketing?: string;
  business?: string;
  booked?: boolean;
  receivedAt?: string;
  callScheduled?: string;
}

interface PipelineStats {
  total: number;
  new: number;
  contacted: number;
  replied: number;
  booked: number;
  emailsSent: number;
  followupsPending: number;
}

interface Email {
  id: string;
  leadId: string;
  to: string;
  subject: string;
  body?: string;
  sentAt: string;
}

interface Followup {
  id: string;
  leadId: string;
  scheduledFor: string;
  status: string;
  subject: string;
}

const EMAIL_STATUS_STYLE: Record<string, string> = {
  not_sent:             "bg-slate-500/10 text-slate-500 border-slate-600/30",
  sent:                 "bg-blue-500/10 text-blue-400 border-blue-500/30",
  follow_up_scheduled:  "bg-amber-500/10 text-amber-400 border-amber-500/30",
  replied:              "bg-green-500/10 text-green-400 border-green-500/30",
  bounced:              "bg-red-500/10 text-red-400 border-red-500/30"
};

const STATUS_STYLE: Record<string, string> = {
  new:          "bg-slate-500/10 text-slate-400",
  contacted:    "bg-blue-500/10 text-blue-400",
  replied:      "bg-indigo-500/10 text-indigo-400",
  booked:       "bg-green-500/10 text-green-400",
  disqualified: "bg-red-500/10 text-red-400"
};

export default function LeadPipeline() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [configStatus, setConfigStatus] = useState<{ apolloConfigured: boolean; emailConfigured: boolean; emailUser?: string } | null>(null);
  const [tab, setTab] = useState<"leads" | "emails" | "followups">("leads");

  useEffect(() => {
    loadData();
    fetch("/api/config/status").then(r => r.json()).then(setConfigStatus).catch(() => {});
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  function loadData() {
    fetch("/api/pipeline")
      .then(r => r.json())
      .then(d => {
        if (d.leads) setLeads(d.leads);
        if (d.stats) setStats(d.stats);
        if (d.emails) setEmails(d.emails);
        if (d.followups) setFollowups(d.followups);
      })
      .catch(() => {
        // fallback to mock leads
        fetch("/api/leads").then(r => r.json()).then(setLeads).catch(() => {});
      });
  }

  const filtered = leads.filter(l => {
    if (filter !== "all" && l.status !== filter && l.emailStatus !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-navy-800">
      <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">Lead Pipeline</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Sales Rep finds US leads via Apollo · sends outreach via Gmail · schedules follow-ups automatically
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* Config warnings */}
        {configStatus && (!configStatus.apolloConfigured || !configStatus.emailConfigured) && (
          <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="text-amber-400 text-xs font-bold mb-2">⚙ Setup required — add to server/.env:</div>
            {!configStatus.apolloConfigured && (
              <div className="font-mono text-[11px] text-amber-300/80 mb-1">APOLLO_API_KEY=your_key  ← get free at apollo.io</div>
            )}
            {!configStatus.emailConfigured && (
              <>
                <div className="font-mono text-[11px] text-amber-300/80 mb-0.5">EMAIL_USER=you@gmail.com</div>
                <div className="font-mono text-[11px] text-amber-300/80 mb-0.5">EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx  ← Gmail App Password</div>
                <div className="font-mono text-[11px] text-amber-300/80">EMAIL_FROM_NAME=Your Name</div>
              </>
            )}
            <div className="text-slate-500 text-[10px] mt-2">Without these, the Sales Rep agent will explain what it would do but can't execute live actions.</div>
          </div>
        )}
        {configStatus?.apolloConfigured && configStatus?.emailConfigured && (
          <div className="mb-4 flex items-center gap-2 text-[11px] text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Apollo + Gmail configured — Sales Rep can find and email US leads automatically
            {configStatus.emailUser && <span className="text-slate-500">({configStatus.emailUser})</span>}
          </div>
        )}

        {/* Stats */}
        {stats ? (
          <div className="grid grid-cols-7 gap-2 mb-5">
            {[
              { label: "Total Leads", value: stats.total, color: "text-white" },
              { label: "New", value: stats.new, color: "text-slate-400" },
              { label: "Contacted", value: stats.contacted, color: "text-blue-400" },
              { label: "Replied", value: stats.replied, color: "text-indigo-400" },
              { label: "Booked", value: stats.booked, color: "text-green-400" },
              { label: "Emails Sent", value: stats.emailsSent, color: "text-cyan-400" },
              { label: "Follow-ups", value: stats.followupsPending, color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-navy-600 border border-white/5 rounded-xl p-3 text-center">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {["Searching...", "Emailing...", "Following up...", "Booked"].map(l => (
              <div key={l} className="bg-navy-600 border border-white/5 rounded-xl p-4">
                <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">{l}</div>
                <div className="text-3xl font-bold text-slate-700">—</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {(["leads", "emails", "followups"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/30"
                  : "bg-navy-600 text-slate-500 border border-white/5 hover:text-slate-300"
              }`}
            >
              {t} {t === "leads" ? `(${leads.length})` : t === "emails" ? `(${emails.length})` : `(${followups.length})`}
            </button>
          ))}
        </div>

        {/* ── Leads tab ── */}
        {tab === "leads" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                placeholder="Search name, company, email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 max-w-xs bg-navy-600 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
              <div className="flex gap-1 flex-wrap">
                {["all", "new", "contacted", "replied", "booked"].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`px-2.5 py-1 rounded text-[10px] capitalize transition-colors ${
                      filter === s
                        ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/30"
                        : "bg-navy-600 text-slate-500 border border-white/5 hover:text-slate-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4 opacity-20">🎯</div>
                <div className="text-slate-500 text-sm mb-2">No leads yet</div>
                <div className="text-slate-600 text-xs max-w-sm">
                  Go to Chat → Sales Rep and say: <br />
                  <span className="text-indigo-400 font-mono">"Find 10 US marketing agency owners and send them a cold email"</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {filtered.map(lead => (
                  <div
                    key={lead.id}
                    className="bg-navy-600 border border-white/8 rounded-xl p-4 hover:border-white/15 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold text-sm leading-tight truncate">{lead.name}</div>
                        {lead.title && <div className="text-slate-400 text-[10px] mt-0.5 truncate">{lead.title}</div>}
                        <div className="text-slate-500 text-[10px] truncate">{lead.company}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                        {lead.status && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${STATUS_STYLE[lead.status] || "text-slate-500"}`}>
                            {lead.status}
                          </span>
                        )}
                        {lead.emailStatus && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${EMAIL_STATUS_STYLE[lead.emailStatus] || ""}`}>
                            {lead.emailStatus?.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-[10px]">
                      {lead.email && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-600">✉</span>
                          <span className="text-slate-400 truncate">{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-600">☎</span>
                          <span className="text-slate-400">{lead.phone}</span>
                        </div>
                      )}
                      {lead.industry && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-600">◆</span>
                          <span className="text-slate-400 truncate">{lead.industry}</span>
                        </div>
                      )}
                      {lead.state && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-600">📍</span>
                          <span className="text-slate-400">{lead.state}, US</span>
                        </div>
                      )}
                      {/* Mock lead compat */}
                      {lead.marketing && <div className="text-slate-500 line-clamp-1">{lead.marketing}</div>}
                      {lead.business && <div className="text-slate-500 line-clamp-1">{lead.business}</div>}
                    </div>

                    {lead.linkedin && (
                      <a
                        href={lead.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-[9px] text-blue-400/70 hover:text-blue-400 font-mono truncate max-w-full"
                        onClick={e => e.stopPropagation()}
                      >
                        LinkedIn ↗
                      </a>
                    )}

                    {lead.followupAt && (
                      <div className="mt-2 text-[9px] text-amber-400/70 font-mono">
                        Follow-up: {new Date(lead.followupAt).toLocaleDateString()}
                      </div>
                    )}
                    {lead.lastContactedAt && (
                      <div className="text-[9px] text-slate-600 font-mono mt-0.5">
                        Contacted: {new Date(lead.lastContactedAt).toLocaleDateString()}
                      </div>
                    )}
                    {/* Mock compat */}
                    {lead.booked !== undefined && (
                      <div className={`mt-2 text-[9px] font-mono ${lead.booked ? "text-green-400" : "text-slate-600"}`}>
                        {lead.booked ? "✓ Booked" : "Not booked"}
                      </div>
                    )}
                    {lead.callScheduled && (
                      <div className="text-[9px] text-indigo-400 font-mono">{lead.callScheduled}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Emails tab ── */}
        {tab === "emails" && (
          <div className="space-y-2">
            {emails.length === 0 ? (
              <div className="text-center py-12 text-slate-600 text-sm">No emails sent yet.</div>
            ) : emails.map(email => (
              <div key={email.id} className="bg-navy-600 border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-white text-sm font-medium">{email.subject}</div>
                  <div className="text-[10px] text-green-400 font-mono">sent ✓</div>
                </div>
                <div className="text-slate-400 text-[11px] mb-2">To: {email.to}</div>
                <div className="text-slate-500 text-[10px] leading-relaxed line-clamp-3 font-mono bg-navy-700 p-2 rounded">{email.body}</div>
                <div className="text-slate-600 text-[9px] mt-2">{new Date(email.sentAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Follow-ups tab ── */}
        {tab === "followups" && (
          <div className="space-y-2">
            {followups.length === 0 ? (
              <div className="text-center py-12 text-slate-600 text-sm">No follow-ups scheduled yet.</div>
            ) : followups.map(f => (
              <div key={f.id} className="bg-navy-600 border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-white text-sm font-medium">{f.subject}</div>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-mono ${
                    f.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                    f.status === "sent" ? "bg-green-500/10 text-green-400" :
                    "bg-slate-500/10 text-slate-500"
                  }`}>{f.status}</span>
                </div>
                <div className="text-slate-400 text-[11px]">Fires: {new Date(f.scheduledFor).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
