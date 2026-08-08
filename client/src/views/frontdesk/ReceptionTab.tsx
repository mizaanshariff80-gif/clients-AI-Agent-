import { useState, useRef, useEffect } from "react";
import type { Appointment, ReceptionMessage, Conversation, ReceptionStats } from "./types";
import { Section, Button, Stat, Badge, Empty, TextInput } from "./ui";

interface Props {
  appointments: Appointment[];
  messages: ReceptionMessage[];
  conversations: Conversation[];
  stats: ReceptionStats | null;
  reload: () => void;
  receptionistName: string;
}

interface Turn { role: "user" | "assistant"; content: string }

export default function ReceptionTab({ appointments, messages, conversations, stats, reload, receptionistName }: Props) {
  const [tab, setTab] = useState<"appointments" | "messages" | "transcripts">("appointments");
  const [scope, setScope] = useState<"upcoming" | "all">("upcoming");

  // Customer simulator — talks to the same endpoint a real widget would use.
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(`test-${Date.now()}`);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, sending]);

  async function send() {
    const message = input.trim();
    if (!message || sending) return;
    setInput("");
    setTurns(t => [...t, { role: "user", content: message }]);
    setSending(true);
    try {
      const res = await fetch("/api/receptionist/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message, channel: "test" })
      });
      const data = await res.json();
      setTurns(t => [...t, { role: "assistant", content: data.reply || data.error || "No reply." }]);
      reload();
    } catch {
      setTurns(t => [...t, { role: "assistant", content: "Connection error." }]);
    } finally {
      setSending(false);
    }
  }

  const now = Date.now();
  const shownAppointments = (scope === "upcoming"
    ? appointments.filter(a => a.status !== "cancelled" && new Date(a.startsAt).getTime() >= now)
    : appointments);

  return (
    <div className="max-w-4xl">
      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          <Stat label="Today" value={stats.appointmentsToday} accent="#2dd4bf" />
          <Stat label="Upcoming" value={stats.appointmentsUpcoming} />
          <Stat label="Total booked" value={stats.appointmentsTotal} />
          <Stat label="Open messages" value={stats.messagesOpen} accent={stats.messagesOpen ? "#fbbf24" : undefined} sub={stats.messagesUrgent ? `${stats.messagesUrgent} urgent` : undefined} />
          <Stat label="Conversations" value={stats.conversations} />
        </div>
      )}

      {/* ─── Customer simulator ────────────────────────────────────────────── */}
      <Section
        title={`Talk to ${receptionistName} as a customer`}
        hint="This hits the same endpoint your website widget or phone bridge would. Bookings made here are real."
        action={
          <Button onClick={() => { setTurns([]); setConversationId(`test-${Date.now()}`); }}>New conversation</Button>
        }
      >
        <div className="bg-navy-800 border border-white/5 rounded-lg h-64 overflow-y-auto p-3 space-y-2">
          {turns.length === 0 && (
            <div className="text-slate-600 text-[11px] text-center pt-16">
              Try: “Hi, do you have anything Thursday afternoon?”
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-2.5 py-1.5 rounded-lg text-[11px] leading-relaxed whitespace-pre-wrap ${
                t.role === "user"
                  ? "bg-teal-600/20 text-teal-100 border border-teal-500/20"
                  : "bg-navy-700 text-slate-300 border border-white/5"
              }`}>
                {t.content}
              </div>
            </div>
          ))}
          {sending && <div className="text-slate-600 text-[10px] pl-1 working-pulse">{receptionistName} is typing…</div>}
          <div ref={endRef} />
        </div>
        <div className="flex gap-2 mt-2">
          <TextInput
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send(); }}
            placeholder="Type as if you were a customer…"
            className="flex-1"
          />
          <Button variant="primary" onClick={send} disabled={sending || !input.trim()}>Send</Button>
        </div>
      </Section>

      {/* ─── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        {([
          ["appointments", `Appointments (${shownAppointments.length})`],
          ["messages", `Messages (${messages.filter(m => m.status === "open").length})`],
          ["transcripts", `Transcripts (${conversations.length})`]
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
              tab === id ? "bg-teal-600/20 text-teal-300 border border-teal-500/30" : "text-slate-500 hover:text-slate-300 border border-transparent"
            }`}
          >{label}</button>
        ))}
        <div className="flex-1" />
        {tab === "appointments" && (
          <Button onClick={() => setScope(s => s === "upcoming" ? "all" : "upcoming")}>
            {scope === "upcoming" ? "Show all" : "Show upcoming only"}
          </Button>
        )}
      </div>

      {tab === "appointments" && (
        shownAppointments.length === 0
          ? <Empty icon="◷" title="No appointments yet" hint="Book one through the simulator above, or let a customer do it." />
          : (
            <div className="space-y-2">
              {shownAppointments.map(a => (
                <div key={a.id} className="bg-navy-700 border border-white/5 rounded-xl p-3 flex items-start justify-between gap-3 card-hover">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white font-medium">{a.name}</span>
                      <Badge tone={a.status === "cancelled" ? "red" : "green"}>{a.status}</Badge>
                      <Badge>{a.service}</Badge>
                      {a.confirmationEmail?.sent && <Badge tone="blue">confirmed by email</Badge>}
                    </div>
                    <div className="text-xs text-teal-300 mt-1">{a.when}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {[a.phone, a.email].filter(Boolean).join(" · ") || "no contact details"}
                      {a.durationMinutes ? ` · ${a.durationMinutes} min` : ""}
                    </div>
                    {a.notes && <div className="text-[11px] text-slate-400 mt-1 italic">“{a.notes}”</div>}
                  </div>
                  {a.status !== "cancelled" && (
                    <Button
                      variant="danger"
                      onClick={async () => {
                        await fetch(`/api/frontdesk/appointments/${a.id}`, { method: "DELETE" });
                        reload();
                      }}
                    >Cancel</Button>
                  )}
                </div>
              ))}
            </div>
          )
      )}

      {tab === "messages" && (
        messages.length === 0
          ? <Empty icon="✉" title="No messages" hint="The receptionist takes a message whenever it can't resolve something itself." />
          : (
            <div className="space-y-2">
              {messages.map(m => (
                <div key={m.id} className="bg-navy-700 border border-white/5 rounded-xl p-3 flex items-start justify-between gap-3 card-hover">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white font-medium">{m.name}</span>
                      {m.urgency === "high" && <Badge tone="red">urgent</Badge>}
                      <Badge tone={m.status === "open" ? "amber" : "slate"}>{m.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{m.message}</p>
                    <div className="text-[10px] text-slate-600 mt-1">
                      {[m.phone, m.email].filter(Boolean).join(" · ")} · {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {m.status === "open" && (
                    <Button
                      onClick={async () => {
                        await fetch(`/api/frontdesk/messages/${m.id}/resolve`, { method: "PUT" });
                        reload();
                      }}
                    >Mark handled</Button>
                  )}
                </div>
              ))}
            </div>
          )
      )}

      {tab === "transcripts" && (
        conversations.length === 0
          ? <Empty icon="◈" title="No conversations yet" />
          : (
            <div className="space-y-2">
              {conversations.map(c => (
                <details key={c.id} className="bg-navy-700 border border-white/5 rounded-xl p-3">
                  <summary className="cursor-pointer text-xs text-slate-300 flex items-center gap-2">
                    <Badge tone="teal">{c.channel}</Badge>
                    <span className="text-slate-500">{new Date(c.startedAt).toLocaleString()}</span>
                    <span className="text-slate-600">· {c.turns.length} turns</span>
                  </summary>
                  <div className="mt-2 space-y-1.5 pl-1">
                    {c.turns.map((t, i) => (
                      <div key={i} className="text-[11px] leading-relaxed">
                        <span className={t.role === "user" ? "text-teal-400" : "text-slate-500"}>
                          {t.role === "user" ? "Customer" : "Receptionist"}:
                        </span>{" "}
                        <span className="text-slate-300 whitespace-pre-wrap">{t.content}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )
      )}
    </div>
  );
}
