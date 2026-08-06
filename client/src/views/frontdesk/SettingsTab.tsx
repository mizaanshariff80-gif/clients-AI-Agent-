import { useState } from "react";
import type { FrontDeskConfig, FrontDeskStatus, Service, Faq } from "./types";
import { DAYS } from "./types";
import { Section, Field, TextInput, TextArea, Select, Toggle, Button, Badge } from "./ui";

interface Props {
  draft: FrontDeskConfig;
  setDraft: (updater: (prev: FrontDeskConfig) => FrontDeskConfig) => void;
  status: FrontDeskStatus | null;
}

const MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — best judgement (recommended)" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — fastest, cheapest" },
  { id: "claude-opus-4-1", label: "Opus 4.1 — deepest reasoning" }
];

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
  "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
  "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi",
  "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Sydney", "Australia/Perth", "UTC"
];

const RATING_LABEL: Record<string, string> = {
  "5": "5★ — delighted", "4": "4★ — happy with a caveat", "3": "3★ — mixed",
  "2": "2★ — unhappy", "1": "1★ — angry"
};

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${seq++}`;

export default function SettingsTab({ draft, setDraft, status }: Props) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState("");

  // Section-scoped setters keep the deep-update noise out of the JSX below.
  const setBusiness = (patch: Partial<FrontDeskConfig["business"]>) =>
    setDraft(p => ({ ...p, business: { ...p.business, ...patch } }));
  const setReception = (patch: Partial<FrontDeskConfig["receptionist"]>) =>
    setDraft(p => ({ ...p, receptionist: { ...p.receptionist, ...patch } }));
  const setReviews = (patch: Partial<FrontDeskConfig["reviews"]>) =>
    setDraft(p => ({ ...p, reviews: { ...p.reviews, ...patch } }));
  const setAppointment = (patch: Partial<FrontDeskConfig["receptionist"]["appointment"]>) =>
    setDraft(p => ({ ...p, receptionist: { ...p.receptionist, appointment: { ...p.receptionist.appointment, ...patch } } }));
  const setEscalation = (patch: Partial<FrontDeskConfig["receptionist"]["escalation"]>) =>
    setDraft(p => ({ ...p, receptionist: { ...p.receptionist, escalation: { ...p.receptionist.escalation, ...patch } } }));

  const setDay = (day: string, patch: Partial<{ open: string; close: string; closed: boolean }>) =>
    setDraft(p => ({
      ...p,
      business: { ...p.business, hours: { ...p.business.hours, [day]: { ...p.business.hours[day], ...patch } } }
    }));

  async function loadPrompt() {
    setShowPrompt(v => !v);
    if (!prompt) {
      try {
        const r = await fetch("/api/frontdesk/prompt");
        const d = await r.json();
        setPrompt(d.prompt || "");
      } catch {
        setPrompt("Could not load the composed prompt.");
      }
    }
  }

  const services = draft.receptionist.services || [];
  const faqs = draft.receptionist.faqs || [];

  return (
    <div className="max-w-4xl">
      <div className="mb-4 p-3 bg-teal-500/5 border border-teal-500/20 rounded-xl">
        <div className="text-teal-300 text-xs font-semibold mb-0.5">Everything here is live-editable</div>
        <div className="text-slate-400 text-[11px] leading-relaxed">
          Change anything, hit <span className="text-slate-200 font-medium">Save changes</span>, and the very next
          customer conversation or review reply uses the new settings. No restart, no redeploy, no code.
        </div>
      </div>

      {/* ─── Business ─────────────────────────────────────────────────────── */}
      <Section title="Business profile" hint="Who the agent says it works for, and the facts it's allowed to state.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Business name">
            <TextInput value={draft.business.name} onChange={e => setBusiness({ name: e.target.value })} />
          </Field>
          <Field label="Industry">
            <TextInput value={draft.business.industry} onChange={e => setBusiness({ industry: e.target.value })} placeholder="Dental clinic, law firm, salon…" />
          </Field>
          <Field label="Phone">
            <TextInput value={draft.business.phone} onChange={e => setBusiness({ phone: e.target.value })} placeholder="(555) 012-3456" />
          </Field>
          <Field label="Email">
            <TextInput value={draft.business.email} onChange={e => setBusiness({ email: e.target.value })} placeholder="hello@business.com" />
          </Field>
          <Field label="Website">
            <TextInput value={draft.business.website} onChange={e => setBusiness({ website: e.target.value })} />
          </Field>
          <Field label="Timezone" hint="All bookings and hours are resolved in this zone.">
            <Select value={draft.business.timezone} onChange={e => setBusiness({ timezone: e.target.value })}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </Select>
          </Field>
          <Field label="Address" className="col-span-2">
            <TextInput value={draft.business.address} onChange={e => setBusiness({ address: e.target.value })} />
          </Field>
          <Field label="Tagline" className="col-span-2" hint="Optional one-liner the agent can use to describe you.">
            <TextInput value={draft.business.tagline} onChange={e => setBusiness({ tagline: e.target.value })} />
          </Field>
          <Field label="Booking link" hint="Offered when a caller prefers to book themselves.">
            <TextInput value={draft.business.bookingLink} onChange={e => setBusiness({ bookingLink: e.target.value })} placeholder="https://cal.com/…" />
          </Field>
          <Field label="Google review link" hint="Where review requests send customers. Get it from your Business Profile → Ask for reviews.">
            <TextInput value={draft.business.reviewLink} onChange={e => setBusiness({ reviewLink: e.target.value })} placeholder="https://g.page/r/…/review" />
          </Field>
          <Field label="Google Place ID" className="col-span-2" hint="Used to read reviews via the Places API. Find it at developers.google.com/maps/documentation/places/web-service/place-id.">
            <TextInput value={draft.business.placeId} onChange={e => setBusiness({ placeId: e.target.value })} placeholder="ChIJ…" />
          </Field>
        </div>
      </Section>

      {/* ─── Hours ────────────────────────────────────────────────────────── */}
      <Section title="Opening hours" hint="The receptionist refuses to book outside these, and uses the after-hours message when closed.">
        <div className="space-y-1.5">
          {DAYS.map(({ key, label }) => {
            const h = draft.business.hours[key] || { open: "09:00", close: "17:00", closed: true };
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-24 text-xs text-slate-400">{label}</div>
                <button
                  type="button"
                  onClick={() => setDay(key, { closed: !h.closed })}
                  className={`px-2 py-1 rounded border text-[10px] w-16 transition-colors ${
                    h.closed
                      ? "bg-navy-600 border-white/10 text-slate-500"
                      : "bg-teal-500/10 border-teal-500/30 text-teal-300"
                  }`}
                >
                  {h.closed ? "Closed" : "Open"}
                </button>
                <TextInput type="time" value={h.open} disabled={h.closed} className="w-28 disabled:opacity-30"
                  onChange={e => setDay(key, { open: e.target.value })} />
                <span className="text-slate-600 text-xs">to</span>
                <TextInput type="time" value={h.close} disabled={h.closed} className="w-28 disabled:opacity-30"
                  onChange={e => setDay(key, { close: e.target.value })} />
              </div>
            );
          })}
        </div>
      </Section>

      {/* ─── Receptionist ─────────────────────────────────────────────────── */}
      <Section
        title="AI Receptionist"
        hint="How it introduces itself, sounds, and behaves with customers."
        action={<Toggle checked={draft.receptionist.enabled} onChange={v => setReception({ enabled: v })} label={draft.receptionist.enabled ? "Enabled" : "Disabled"} />}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Receptionist name">
            <TextInput value={draft.receptionist.agentName} onChange={e => setReception({ agentName: e.target.value })} />
          </Field>
          <Field label="Tone">
            <TextInput value={draft.receptionist.tone} onChange={e => setReception({ tone: e.target.value })} placeholder="warm, professional, efficient" />
          </Field>
          <Field label="Greeting" className="col-span-2" hint="Use {{business}} and {{agentName}} as placeholders.">
            <TextArea rows={2} value={draft.receptionist.greeting} onChange={e => setReception({ greeting: e.target.value })} />
          </Field>
          <Field label="Speaking style" className="col-span-2">
            <TextArea rows={2} value={draft.receptionist.style} onChange={e => setReception({ style: e.target.value })} />
          </Field>
          <Field label="After-hours message" className="col-span-2">
            <TextArea rows={2} value={draft.receptionist.afterHoursMessage} onChange={e => setReception({ afterHoursMessage: e.target.value })} />
          </Field>
          <Field label="Languages" hint="Comma separated.">
            <TextInput
              value={(draft.receptionist.languages || []).join(", ")}
              onChange={e => setReception({ languages: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
            />
          </Field>
          <Field label="Always collect" hint="Comma separated. The agent won't close a booking without these.">
            <TextInput
              value={(draft.receptionist.collectFields || []).join(", ")}
              onChange={e => setReception({ collectFields: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
            />
          </Field>
        </div>
      </Section>

      {/* ─── Services ─────────────────────────────────────────────────────── */}
      <Section
        title="Services"
        hint="What can be booked, how long each takes, and what it costs. Durations drive real slot lengths."
        action={
          <Button onClick={() => setReception({
            services: [...services, { id: newId("svc"), name: "", duration: 30, price: "", description: "" }]
          })}>+ Add service</Button>
        }
      >
        {services.length === 0 && <div className="text-slate-600 text-[11px]">No services yet — add one so the agent can book it.</div>}
        <div className="space-y-2">
          {services.map((s: Service, i: number) => (
            <div key={s.id} className="grid grid-cols-12 gap-2 items-start bg-navy-800/60 rounded-lg p-2">
              <TextInput className="col-span-3" placeholder="Service name" value={s.name}
                onChange={e => setReception({ services: services.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
              <TextInput className="col-span-2" type="number" placeholder="Minutes" value={s.duration}
                onChange={e => setReception({ services: services.map((x, j) => j === i ? { ...x, duration: Number(e.target.value) } : x) })} />
              <TextInput className="col-span-2" placeholder="Price" value={s.price}
                onChange={e => setReception({ services: services.map((x, j) => j === i ? { ...x, price: e.target.value } : x) })} />
              <TextInput className="col-span-4" placeholder="Short description" value={s.description}
                onChange={e => setReception({ services: services.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} />
              <Button variant="danger" className="col-span-1" onClick={() => setReception({ services: services.filter((_, j) => j !== i) })}>✕</Button>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── FAQs ─────────────────────────────────────────────────────────── */}
      <Section
        title="Approved answers (FAQ)"
        hint="The agent answers from these and won't contradict them. This is your guardrail against invented policies."
        action={
          <Button onClick={() => setReception({ faqs: [...faqs, { id: newId("faq"), question: "", answer: "" }] })}>
            + Add answer
          </Button>
        }
      >
        {faqs.length === 0 && <div className="text-slate-600 text-[11px]">No approved answers yet.</div>}
        <div className="space-y-2">
          {faqs.map((f: Faq, i: number) => (
            <div key={f.id} className="bg-navy-800/60 rounded-lg p-2">
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <TextInput placeholder="Question a customer might ask" value={f.question}
                    onChange={e => setReception({ faqs: faqs.map((x, j) => j === i ? { ...x, question: e.target.value } : x) })} />
                  <TextArea rows={2} placeholder="The exact answer the agent should give" value={f.answer}
                    onChange={e => setReception({ faqs: faqs.map((x, j) => j === i ? { ...x, answer: e.target.value } : x) })} />
                </div>
                <Button variant="danger" onClick={() => setReception({ faqs: faqs.filter((_, j) => j !== i) })}>✕</Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Booking rules ────────────────────────────────────────────────── */}
      <Section title="Booking rules" hint="Hard limits the agent cannot talk its way around.">
        <div className="grid grid-cols-4 gap-3">
          <Field label="Slot length (min)">
            <TextInput type="number" value={draft.receptionist.appointment.slotMinutes}
              onChange={e => setAppointment({ slotMinutes: Number(e.target.value) })} />
          </Field>
          <Field label="Min notice (hrs)">
            <TextInput type="number" value={draft.receptionist.appointment.leadTimeHours}
              onChange={e => setAppointment({ leadTimeHours: Number(e.target.value) })} />
          </Field>
          <Field label="Book up to (days)">
            <TextInput type="number" value={draft.receptionist.appointment.maxDaysAhead}
              onChange={e => setAppointment({ maxDaysAhead: Number(e.target.value) })} />
          </Field>
          <Field label="Bookings per slot">
            <TextInput type="number" value={draft.receptionist.appointment.maxPerSlot}
              onChange={e => setAppointment({ maxPerSlot: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="mt-3">
          <Toggle
            checked={draft.receptionist.appointment.sendConfirmationEmail}
            onChange={v => setAppointment({ sendConfirmationEmail: v })}
            label="Email a confirmation after every booking"
            hint={status?.emailConfigured ? `Sends from ${status.emailUser}` : "Needs EMAIL_USER + EMAIL_APP_PASSWORD in server/.env"}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 mt-3">
          <Field label="Confirmation subject">
            <TextInput value={draft.receptionist.appointment.confirmationSubject}
              onChange={e => setAppointment({ confirmationSubject: e.target.value })} />
          </Field>
          <Field label="Confirmation body" hint="Placeholders: {{name}} {{service}} {{when}} {{business}} {{address}} {{phone}} {{agentName}}">
            <TextArea rows={6} value={draft.receptionist.appointment.confirmationBody}
              onChange={e => setAppointment({ confirmationBody: e.target.value })} />
          </Field>
        </div>
      </Section>

      {/* ─── Escalation ───────────────────────────────────────────────────── */}
      <Section title="Escalation" hint="When the agent should stop and get a human involved.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Transfer to">
            <TextInput value={draft.receptionist.escalation.transferTo}
              onChange={e => setEscalation({ transferTo: e.target.value })} placeholder="Front desk / (555) 012-3456" />
          </Field>
          <Field label="Notify email">
            <TextInput value={draft.receptionist.escalation.notifyEmail}
              onChange={e => setEscalation({ notifyEmail: e.target.value })} placeholder="owner@business.com" />
          </Field>
          <Field label="Escalation triggers" className="col-span-2" hint="Comma separated.">
            <TextInput
              value={(draft.receptionist.escalation.triggers || []).join(", ")}
              onChange={e => setEscalation({ triggers: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
            />
          </Field>
        </div>
      </Section>

      {/* ─── Reviews ──────────────────────────────────────────────────────── */}
      <Section
        title="Google review replies"
        hint="Voice, length, and the approval policy for public replies."
        action={<Toggle checked={draft.reviews.enabled} onChange={v => setReviews({ enabled: v })} label={draft.reviews.enabled ? "Enabled" : "Disabled"} />}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reply tone">
            <TextInput value={draft.reviews.replyTone} onChange={e => setReviews({ replyTone: e.target.value })} />
          </Field>
          <Field label="Sign-off">
            <TextInput value={draft.reviews.signature} onChange={e => setReviews({ signature: e.target.value })} />
          </Field>
          <Field label="Max reply length (words)">
            <TextInput type="number" value={draft.reviews.maxLength} onChange={e => setReviews({ maxLength: Number(e.target.value) })} />
          </Field>
          <Field label="Sync every (minutes)" hint="Minimum 5.">
            <TextInput type="number" value={draft.reviews.syncIntervalMinutes}
              onChange={e => setReviews({ syncIntervalMinutes: Number(e.target.value) })} />
          </Field>
        </div>

        <div className="mt-3 space-y-2.5 border-t border-white/5 pt-3">
          <Toggle
            checked={draft.reviews.autoReply}
            onChange={v => setReviews({ autoReply: v })}
            label="Auto-post replies without approval"
            hint="Off is safer: every reply waits for your approval in the Reviews tab."
          />
          {draft.reviews.autoReply && (
            <div className="pl-10 grid grid-cols-2 gap-3">
              <Field label="Auto-post at or above" hint="Anything lower is still drafted for approval.">
                <Select value={draft.reviews.autoReplyMinRating} onChange={e => setReviews({ autoReplyMinRating: Number(e.target.value) })}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}
                </Select>
              </Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Alert me below" hint="Negative reviews trigger an email to the address on the right.">
              <Select value={draft.reviews.negativeAlertBelow} onChange={e => setReviews({ negativeAlertBelow: Number(e.target.value) })}>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}
              </Select>
            </Field>
            <Field label="Alert email">
              <TextInput value={draft.reviews.negativeAlertEmail} onChange={e => setReviews({ negativeAlertEmail: e.target.value })} placeholder="owner@business.com" />
            </Field>
          </div>
        </div>
      </Section>

      {/* ─── Reply playbook ───────────────────────────────────────────────── */}
      <Section title="Reply playbook by star rating" hint="Direction for each rating — not fixed text, so replies stay specific to what the reviewer actually said.">
        <div className="space-y-2">
          {["5", "4", "3", "2", "1"].map(stars => (
            <Field key={stars} label={RATING_LABEL[stars]}>
              <TextArea rows={2} value={draft.reviews.templates[stars] || ""}
                onChange={e => setReviews({ templates: { ...draft.reviews.templates, [stars]: e.target.value } })} />
            </Field>
          ))}
        </div>
      </Section>

      {/* ─── Review requests ──────────────────────────────────────────────── */}
      <Section title="Review request email" hint="Sent to happy customers to ask for a Google review. Never offer anything in exchange — Google prohibits it.">
        <div className="space-y-3">
          <Field label="Subject" hint="Placeholders: {{name}} {{business}}">
            <TextInput value={draft.reviews.requestSubject} onChange={e => setReviews({ requestSubject: e.target.value })} />
          </Field>
          <Field label="Body" hint="Placeholders: {{name}} {{business}} {{reviewLink}}">
            <TextArea rows={8} value={draft.reviews.requestBody} onChange={e => setReviews({ requestBody: e.target.value })} />
          </Field>
        </div>
      </Section>

      {/* ─── Advanced ─────────────────────────────────────────────────────── */}
      <Section title="Advanced" hint="Free-text instructions are appended last, so they override everything above.">
        <div className="space-y-3">
          <Field label="Model">
            <Select value={draft.model} onChange={e => setDraft(p => ({ ...p, model: e.target.value }))}>
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Extra receptionist instructions" hint="e.g. “Never quote prices for insurance work — take a message instead.”">
            <TextArea rows={4} value={draft.receptionist.customInstructions}
              onChange={e => setReception({ customInstructions: e.target.value })} />
          </Field>
          <Field label="Extra review instructions" hint="e.g. “Always mention our 12-month warranty when someone praises a repair.”">
            <TextArea rows={4} value={draft.reviews.customInstructions}
              onChange={e => setReviews({ customInstructions: e.target.value })} />
          </Field>

          <div className="pt-1">
            <Button onClick={loadPrompt}>{showPrompt ? "Hide" : "Show"} the exact brief the agent receives</Button>
            {showPrompt && (
              <div className="mt-2">
                <div className="mb-1"><Badge tone="teal">Saved settings only — save first to see edits</Badge></div>
                <pre className="bg-navy-900 border border-white/5 rounded-lg p-3 text-[10px] text-slate-400 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {prompt}
                </pre>
              </div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
