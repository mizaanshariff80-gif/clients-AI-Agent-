import { useEffect, useState, useCallback, useRef } from "react";
import SettingsTab from "./frontdesk/SettingsTab";
import ReviewsTab from "./frontdesk/ReviewsTab";
import ReceptionTab from "./frontdesk/ReceptionTab";
import { Button, Badge } from "./frontdesk/ui";
import type {
  FrontDeskConfig, FrontDeskStatus, Review, ReviewStats, ReviewMode,
  Appointment, ReceptionMessage, Conversation, ReceptionStats
} from "./frontdesk/types";

type Tab = "reviews" | "reception" | "settings";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "reviews", label: "Google Reviews", hint: "Monitor, reply, request" },
  { id: "reception", label: "Reception", hint: "Calls, bookings, messages" },
  { id: "settings", label: "Settings", hint: "Edit everything, anytime" }
];

export default function FrontDesk() {
  const [tab, setTab] = useState<Tab>("reviews");

  const [config, setConfig] = useState<FrontDeskConfig | null>(null);
  const [draft, setDraft] = useState<FrontDeskConfig | null>(null);
  const [status, setStatus] = useState<FrontDeskStatus | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<ReceptionMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [receptionStats, setReceptionStats] = useState<ReceptionStats | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling must not clobber unsaved edits in the settings form.
  const dirtyRef = useRef(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/frontdesk/config");
      const data = await res.json();
      setConfig(data.config);
      if (!dirtyRef.current) setDraft(data.config);
    } catch {
      setError("Could not reach the server.");
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [statusRes, reviewsRes, receptionRes] = await Promise.all([
        fetch("/api/frontdesk/status"),
        fetch("/api/frontdesk/reviews"),
        fetch("/api/frontdesk/reception")
      ]);
      const statusData = await statusRes.json();
      const reviewsData = await reviewsRes.json();
      const receptionData = await receptionRes.json();

      setStatus(statusData);
      setReviews(reviewsData.reviews || []);
      setReviewStats(reviewsData.stats || null);
      setReviewMode(reviewsData.mode || null);
      setAppointments(receptionData.appointments || []);
      setMessages(receptionData.messages || []);
      setConversations(receptionData.conversations || []);
      setReceptionStats(receptionData.stats || null);
      setError(null);
    } catch {
      setError("Could not reach the server.");
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadConfig, loadData]);

  const dirty = !!(draft && config && JSON.stringify(draft) !== JSON.stringify(config));
  dirtyRef.current = dirty;

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/frontdesk/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Save failed");
      setConfig(data.config);
      setDraft(data.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("Reset every Front Desk setting back to the defaults? Your reviews and appointments are not affected.")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/frontdesk/config/reset", { method: "POST" });
      const data = await res.json();
      setConfig(data.config);
      setDraft(data.config);
    } finally {
      setSaving(false);
    }
  }

  if (!draft || !config) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        {error || "Loading Front Desk…"}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-navy-800">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Front Desk</h1>
              <Badge tone="teal">2 agents in 1</Badge>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              Google Review manager + AI Receptionist for{" "}
              <span className="text-slate-300">{config.business.name}</span> — every word, rule, and
              policy editable in Settings.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 text-right">
            <div>
              <div className="flex items-center justify-end gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${status?.openNow?.open ? "status-dot-working" : "status-dot-idle"}`} />
                <span className="text-[11px] text-slate-400">{status?.openNow?.open ? "Open now" : "Closed now"}</span>
              </div>
              <div className="text-[10px] text-slate-600 mt-0.5">
                {config.receptionist.enabled ? `${config.receptionist.agentName} answering` : "Receptionist off"}
                {" · "}
                {config.reviews.enabled ? (config.reviews.autoReply ? "auto-replies on" : "replies need approval") : "reviews off"}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-3">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                tab === t.id
                  ? "bg-teal-600/20 text-teal-300 border border-teal-500/30"
                  : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
              title={t.hint}
            >
              {t.label}
              {t.id === "reviews" && reviewStats && reviewStats.draftsPending > 0 && (
                <span className="ml-1.5 px-1 rounded bg-amber-500/20 text-amber-300 text-[9px]">{reviewStats.draftsPending}</span>
              )}
              {t.id === "reception" && receptionStats && receptionStats.messagesOpen > 0 && (
                <span className="ml-1.5 px-1 rounded bg-amber-500/20 text-amber-300 text-[9px]">{receptionStats.messagesOpen}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs">{error}</div>
        )}

        {tab === "reviews" && (
          <ReviewsTab reviews={reviews} stats={reviewStats} mode={reviewMode} reload={loadData} />
        )}
        {tab === "reception" && (
          <ReceptionTab
            appointments={appointments}
            messages={messages}
            conversations={conversations}
            stats={receptionStats}
            reload={loadData}
            receptionistName={config.receptionist.agentName}
          />
        )}
        {tab === "settings" && (
          <SettingsTab draft={draft} setDraft={u => setDraft(prev => (prev ? u(prev) : prev))} status={status} />
        )}
      </div>

      {/* Save bar — only in the way when there's something to save */}
      {tab === "settings" && (
        <div className="flex-shrink-0 border-t border-white/5 bg-navy-700/80 backdrop-blur px-6 py-3 flex items-center gap-3">
          <div className="flex-1 text-[11px]">
            {dirty ? (
              <span className="text-amber-400">Unsaved changes — the agent is still using the previous settings.</span>
            ) : saved ? (
              <span className="text-green-400">Saved. The next conversation and review reply use these settings.</span>
            ) : (
              <span className="text-slate-600">All changes saved.</span>
            )}
          </div>
          <Button variant="ghost" onClick={reset} disabled={saving}>Reset to defaults</Button>
          <Button variant="ghost" onClick={() => setDraft(config)} disabled={!dirty || saving}>Discard</Button>
          <Button variant="primary" onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
