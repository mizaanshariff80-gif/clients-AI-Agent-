import { useState } from "react";
import type { Review, ReviewStats, ReviewMode } from "./types";
import { Section, Field, TextInput, TextArea, Button, Stat, Stars, Badge, Empty, Select } from "./ui";

interface Props {
  reviews: Review[];
  stats: ReviewStats | null;
  mode: ReviewMode | null;
  reload: () => void;
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unanswered", label: "Needs reply" },
  { id: "drafts", label: "Awaiting approval" },
  { id: "negative", label: "Negative" },
  { id: "posted", label: "Replied" }
];

const STATUS_BADGE: Record<string, { tone: string; label: string }> = {
  none: { tone: "slate", label: "No reply" },
  draft: { tone: "amber", label: "Draft — needs approval" },
  posted: { tone: "green", label: "Posted to Google" },
  approved_local: { tone: "blue", label: "Approved (local)" }
};

export default function ReviewsTab({ reviews, stats, mode, reload }: Props) {
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newReview, setNewReview] = useState({ author: "", rating: 5, text: "" });
  const [request, setRequest] = useState({ to: "", name: "" });
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = reviews.filter(r => {
    if (filter === "unanswered") return r.replyStatus === "none";
    if (filter === "drafts") return r.replyStatus === "draft";
    if (filter === "negative") return r.rating > 0 && r.rating <= 3;
    if (filter === "posted") return r.replyStatus === "posted" || r.replyStatus === "approved_local";
    return true;
  });

  async function call(url: string, options: RequestInit = {}, key = url) {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
      });
      const data = await res.json();
      reload();
      return data;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Request failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    const data = await call("/api/frontdesk/reviews/sync", { method: "POST" }, "sync");
    if (data && !data.ok) setNotice(data.error || "Sync failed");
    else if (data) setNotice(`Synced ${data.synced} review(s) from Google.`);
  }

  async function generate(review: Review) {
    const data = await call(`/api/frontdesk/reviews/${review.id}/generate`, { method: "POST", body: "{}" }, `gen-${review.id}`);
    if (data?.ok) setNotice(data.summary?.slice(0, 300) || "Reply drafted.");
    else if (data) setNotice(data.error || "Could not draft a reply.");
  }

  const draftText = (r: Review) => drafts[r.id] ?? r.draftReply ?? "";

  return (
    <div className="max-w-4xl">
      {/* Connection state */}
      {mode && (
        <div className={`mb-4 p-3 rounded-xl border ${
          mode.canReply ? "bg-green-500/5 border-green-500/20"
          : mode.canRead ? "bg-blue-500/5 border-blue-500/20"
          : "bg-amber-500/5 border-amber-500/20"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Badge tone={mode.canReply ? "green" : mode.canRead ? "blue" : "amber"}>{mode.mode.replace("_", " ")}</Badge>
            <span className="text-xs text-slate-300">
              {mode.canReply ? "Full read + reply" : mode.canRead ? "Read only" : "Not connected to Google"}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 leading-relaxed">{mode.detail}</div>
          {!mode.canReply && (
            <div className="text-[10px] text-slate-600 mt-1.5 font-mono">
              server/.env → GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_ACCOUNT_ID, GOOGLE_LOCATION_ID
            </div>
          )}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          <Stat label="Reviews" value={stats.total} />
          <Stat label="Average" value={stats.average || "—"} accent="#fbbf24" sub={stats.lastSync ? `synced ${new Date(stats.lastSync).toLocaleTimeString()}` : "never synced"} />
          <Stat label="Needs reply" value={stats.unanswered} accent={stats.unanswered ? "#f97316" : undefined} />
          <Stat label="Awaiting approval" value={stats.draftsPending} accent={stats.draftsPending ? "#fbbf24" : undefined} />
          <Stat label="Requests sent" value={stats.requestsSent} />
        </div>
      )}

      {/* Star distribution */}
      {stats && stats.total > 0 && (
        <div className="bg-navy-700 border border-white/5 rounded-xl p-3 mb-4">
          {[5, 4, 3, 2, 1].map(n => {
            const count = stats.distribution[String(n)] || 0;
            const pct = stats.total ? (count / stats.total) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-2 mb-1 last:mb-0">
                <span className="text-[10px] text-slate-500 w-6">{n}★</span>
                <div className="flex-1 h-1.5 bg-navy-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400/70 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-slate-500 w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
                filter === f.id ? "bg-teal-600/20 text-teal-300 border border-teal-500/30" : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Button onClick={sync} disabled={busy === "sync" || !mode?.canRead}>
          {busy === "sync" ? "Syncing…" : "Sync from Google"}
        </Button>
        <Button onClick={() => setShowAdd(v => !v)}>+ Log a review</Button>
      </div>

      {notice && (
        <div className="mb-3 p-2.5 bg-navy-700 border border-white/10 rounded-lg text-[11px] text-slate-300 whitespace-pre-wrap">
          {notice}
        </div>
      )}

      {showAdd && (
        <Section title="Log a review manually" hint="For reviews from anywhere else, or to try the agent before connecting Google.">
          <div className="grid grid-cols-12 gap-2 items-end">
            <Field label="Author" className="col-span-3">
              <TextInput value={newReview.author} onChange={e => setNewReview({ ...newReview, author: e.target.value })} />
            </Field>
            <Field label="Rating" className="col-span-2">
              <Select value={newReview.rating} onChange={e => setNewReview({ ...newReview, rating: Number(e.target.value) })}>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}
              </Select>
            </Field>
            <Field label="Review text" className="col-span-5">
              <TextInput value={newReview.text} onChange={e => setNewReview({ ...newReview, text: e.target.value })} />
            </Field>
            <div className="col-span-2">
              <Button
                variant="primary"
                disabled={!newReview.author}
                onClick={async () => {
                  await call("/api/frontdesk/reviews", { method: "POST", body: JSON.stringify(newReview) }, "add");
                  setNewReview({ author: "", rating: 5, text: "" });
                  setShowAdd(false);
                }}
              >Add</Button>
            </div>
          </div>
        </Section>
      )}

      {/* Review request */}
      <Section title="Ask a customer for a review" hint="Sends your configured request email with your Google review link. One per customer — the agent blocks duplicates.">
        <div className="grid grid-cols-12 gap-2 items-end">
          <Field label="Customer name" className="col-span-4">
            <TextInput value={request.name} onChange={e => setRequest({ ...request, name: e.target.value })} />
          </Field>
          <Field label="Email" className="col-span-6">
            <TextInput value={request.to} onChange={e => setRequest({ ...request, to: e.target.value })} placeholder="customer@example.com" />
          </Field>
          <div className="col-span-2">
            <Button
              variant="primary"
              disabled={!request.to || !request.name || busy === "req"}
              onClick={async () => {
                setBusy("req");
                try {
                  const res = await fetch("/api/receptionist/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      conversationId: `req-${Date.now()}`,
                      message: `OPERATOR ACTION: send a review request to ${request.to} for ${request.name}. Call send_review_request now and report the result.`
                    })
                  });
                  const data = await res.json();
                  setNotice(data.reply || data.error || "Sent.");
                  setRequest({ to: "", name: "" });
                  reload();
                } catch {
                  setNotice("Request failed.");
                } finally {
                  setBusy(null);
                }
              }}
            >{busy === "req" ? "Sending…" : "Send"}</Button>
          </div>
        </div>
      </Section>

      {/* Reviews */}
      {filtered.length === 0 ? (
        <Empty
          icon="★"
          title="No reviews here yet"
          hint={mode?.canRead
            ? "Hit “Sync from Google” to pull your latest reviews."
            : "Connect Google in Settings, or log a review manually to see the agent draft a reply."}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(review => {
            const badge = STATUS_BADGE[review.replyStatus] || STATUS_BADGE.none;
            const text = draftText(review);
            return (
              <div key={review.id} className="bg-navy-700 border border-white/5 rounded-xl p-3.5 card-hover">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white font-medium">{review.author}</span>
                      <Stars rating={review.rating} />
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                      {review.source !== "business_profile" && <Badge>{review.source}</Badge>}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {new Date(review.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button onClick={() => generate(review)} disabled={busy === `gen-${review.id}`}>
                      {busy === `gen-${review.id}` ? "Writing…" : review.replyStatus === "none" ? "Draft reply with AI" : "Rewrite with AI"}
                    </Button>
                  </div>
                </div>

                {review.text && (
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap">{review.text}</p>
                )}

                {review.reply && (
                  <div className="mt-2.5 pl-3 border-l-2 border-green-500/30">
                    <div className="text-[9px] uppercase tracking-wider text-green-500/70 font-semibold mb-0.5">
                      Published reply
                    </div>
                    <p className="text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">{review.reply}</p>
                  </div>
                )}

                {(review.replyStatus === "draft" || drafts[review.id] !== undefined) && (
                  <div className="mt-2.5">
                    <div className="text-[9px] uppercase tracking-wider text-amber-400/80 font-semibold mb-1">
                      Draft reply — edit before approving
                    </div>
                    <TextArea
                      rows={3}
                      value={text}
                      onChange={e => setDrafts({ ...drafts, [review.id]: e.target.value })}
                    />
                    <div className="flex gap-1.5 mt-1.5">
                      <Button
                        variant="primary"
                        disabled={!text || busy === `post-${review.id}`}
                        onClick={async () => {
                          const data = await call(
                            `/api/frontdesk/reviews/${review.id}/post`,
                            { method: "POST", body: JSON.stringify({ text }) },
                            `post-${review.id}`
                          );
                          setDrafts(d => { const next = { ...d }; delete next[review.id]; return next; });
                          if (data?.note) setNotice(data.note);
                          else if (data?.error) setNotice(data.error);
                        }}
                      >
                        {busy === `post-${review.id}` ? "Publishing…" : "Approve & publish"}
                      </Button>
                      <Button
                        disabled={!text}
                        onClick={() => call(`/api/frontdesk/reviews/${review.id}/draft`, { method: "PUT", body: JSON.stringify({ text }) }, `save-${review.id}`)}
                      >Save draft</Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setDrafts(d => { const next = { ...d }; delete next[review.id]; return next; });
                          call(`/api/frontdesk/reviews/${review.id}/draft`, { method: "DELETE" }, `del-${review.id}`);
                        }}
                      >Discard</Button>
                    </div>
                  </div>
                )}

                {review.replyStatus === "none" && drafts[review.id] === undefined && (
                  <button
                    onClick={() => setDrafts({ ...drafts, [review.id]: "" })}
                    className="text-[10px] text-slate-500 hover:text-teal-300 mt-2 transition-colors"
                  >
                    or write a reply yourself →
                  </button>
                )}

                {review.lastError && (
                  <div className="text-[10px] text-red-400/80 mt-1.5">Last error: {review.lastError}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
