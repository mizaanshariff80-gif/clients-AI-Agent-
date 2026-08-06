/**
 * Front Desk configuration — the single editable brain for the
 * Google Review agent + AI Receptionist ("2 in one").
 *
 * Everything the agent says and does is driven by this config, which lives on
 * disk at server/data/frontdesk.config.json and can be rewritten at any time
 * from the dashboard (PUT /api/frontdesk/config). No restart, no code edits:
 * the system prompt is recomposed from the current config on every agent call.
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../data");
const CONFIG_PATH = join(DATA_DIR, "frontdesk.config.json");

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG = {
  model: "claude-sonnet-4-6",

  business: {
    name: "Your Business",
    industry: "Local services",
    tagline: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    timezone: "America/New_York",
    bookingLink: "",
    reviewLink: "",          // e.g. https://g.page/r/XXXX/review
    placeId: "",             // Google Place ID (used by the Places API reader)
    hours: {
      mon: { open: "09:00", close: "17:00", closed: false },
      tue: { open: "09:00", close: "17:00", closed: false },
      wed: { open: "09:00", close: "17:00", closed: false },
      thu: { open: "09:00", close: "17:00", closed: false },
      fri: { open: "09:00", close: "17:00", closed: false },
      sat: { open: "10:00", close: "14:00", closed: false },
      sun: { open: "00:00", close: "00:00", closed: true }
    }
  },

  receptionist: {
    enabled: true,
    agentName: "Ava",
    greeting: "Thanks for calling! This is Ava at {{business}}. How can I help you today?",
    tone: "warm, professional, efficient",
    style: "Short conversational replies (1-3 sentences). Ask one question at a time.",
    languages: ["English"],
    collectFields: ["name", "phone", "email", "reason for visit"],
    services: [
      { id: "svc-default", name: "Consultation", duration: 30, price: "", description: "Intro call to scope the work." }
    ],
    faqs: [
      { id: "faq-hours", question: "What are your hours?", answer: "Use the business hours in the profile above." },
      { id: "faq-parking", question: "Do you have parking?", answer: "Yes — free parking on site." }
    ],
    afterHoursMessage:
      "We're closed right now, but I can take a message or book you in for the next opening.",
    escalation: {
      transferTo: "",
      notifyEmail: "",
      triggers: ["angry customer", "legal or billing dispute", "emergency", "asks for the owner by name"]
    },
    appointment: {
      slotMinutes: 30,
      leadTimeHours: 2,
      maxDaysAhead: 30,
      maxPerSlot: 1,
      sendConfirmationEmail: true,
      confirmationSubject: "Your appointment with {{business}} is confirmed",
      confirmationBody:
        "Hi {{name}},\n\nYou're booked for {{service}} on {{when}}.\n\nAddress: {{address}}\nQuestions? Call {{phone}}.\n\n— {{agentName}}, {{business}}"
    },
    customInstructions: ""
  },

  reviews: {
    enabled: true,
    autoReply: false,             // when false, replies are drafted and wait for approval
    autoReplyMinRating: 4,        // auto-post only at/above this star rating
    replyTone: "grateful, specific, human — never corporate boilerplate",
    signature: "— The team at {{business}}",
    maxLength: 60,                // words
    templates: {
      "5": "Thank them by name, name the specific thing they praised, invite them back.",
      "4": "Thank them, acknowledge what they liked, ask what would have made it a 5.",
      "3": "Thank them for the honest feedback, name the gap, offer to make it right offline.",
      "2": "Apologize plainly, take ownership, give a direct contact to resolve it.",
      "1": "Apologize without excuses, do not argue facts publicly, move it to a phone call fast."
    },
    negativeAlertEmail: "",
    negativeAlertBelow: 4,        // alert the owner when a review lands below this
    requestSubject: "Quick favor, {{name}}?",
    requestBody:
      "Hi {{name}},\n\nThanks for choosing {{business}}! If we did right by you, a short Google review helps more than you'd think:\n\n{{reviewLink}}\n\nTakes about 30 seconds. Thank you!\n\n— {{business}}",
    syncIntervalMinutes: 60,
    customInstructions: ""
  }
};

// ─── Persistence ──────────────────────────────────────────────────────────────

let _config = null;
let _listeners = [];

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/** Merge a partial patch over a base, recursing into objects but replacing arrays wholesale. */
export function deepMerge(base, patch) {
  if (!isPlainObject(patch)) return patch === undefined ? base : patch;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key] = isPlainObject(value) && isPlainObject(base?.[key]) ? deepMerge(base[key], value) : value;
  }
  return out;
}

function ensureIds(config) {
  for (const faq of config.receptionist?.faqs || []) if (!faq.id) faq.id = `faq-${uuidv4().slice(0, 8)}`;
  for (const svc of config.receptionist?.services || []) if (!svc.id) svc.id = `svc-${uuidv4().slice(0, 8)}`;
  return config;
}

export function loadConfig() {
  if (_config) return _config;
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
      // Merge over defaults so configs written by older versions keep working.
      _config = ensureIds(deepMerge(DEFAULT_CONFIG, raw));
    } else {
      _config = structuredClone(DEFAULT_CONFIG);
      persist(_config);
    }
  } catch (err) {
    console.error(`[FrontDesk] Config unreadable (${err.message}) — falling back to defaults`);
    _config = structuredClone(DEFAULT_CONFIG);
  }
  return _config;
}

function persist(config) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  // Write-then-rename so a crash mid-write can't truncate a good config.
  const tmp = `${CONFIG_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(config, null, 2));
  renameSync(tmp, CONFIG_PATH);
}

/** Apply a partial patch and persist. Returns the full updated config. */
export function updateConfig(patch) {
  const next = ensureIds(deepMerge(loadConfig(), patch));
  _config = next;
  persist(next);
  _listeners.forEach(fn => { try { fn(next); } catch {} });
  return next;
}

export function resetConfig() {
  _config = structuredClone(DEFAULT_CONFIG);
  persist(_config);
  _listeners.forEach(fn => { try { fn(_config); } catch {} });
  return _config;
}

export function onConfigChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

// ─── Template rendering ───────────────────────────────────────────────────────

/** Replace {{token}} placeholders. Unknown tokens are stripped, not left visible. */
export function render(template, vars = {}) {
  if (!template) return "";
  const cfg = loadConfig();
  const base = {
    business: cfg.business.name,
    phone: cfg.business.phone,
    email: cfg.business.email,
    website: cfg.business.website,
    address: cfg.business.address,
    bookingLink: cfg.business.bookingLink,
    reviewLink: cfg.business.reviewLink,
    agentName: cfg.receptionist.agentName
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const val = vars[key] ?? base[key];
    return val === undefined || val === null ? "" : String(val);
  });
}

// ─── Hours helpers ────────────────────────────────────────────────────────────

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };

export function hoursSummary(cfg = loadConfig()) {
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    .map(d => {
      const h = cfg.business.hours?.[d];
      if (!h || h.closed) return `${DAY_LABELS[d]}: Closed`;
      return `${DAY_LABELS[d]}: ${h.open}–${h.close}`;
    })
    .join("\n");
}

/** Business-hours check for a Date, evaluated in the configured timezone. */
export function isWithinHours(date = new Date(), cfg = loadConfig()) {
  const tz = cfg.business.timezone || "UTC";
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(date);
  } catch {
    return { open: true, reason: "unknown timezone" };
  }
  const get = t => parts.find(p => p.type === t)?.value || "";
  const dayKey = DAY_KEYS[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"))] || "mon";
  const hours = cfg.business.hours?.[dayKey];
  if (!hours || hours.closed) return { open: false, day: dayKey, reason: "closed today" };

  const minutes = parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10);
  const toMin = s => {
    const [h, m] = String(s || "0:0").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const open = toMin(hours.open);
  const close = toMin(hours.close);
  return {
    open: minutes >= open && minutes < close,
    day: dayKey,
    reason: minutes < open ? "before opening" : minutes >= close ? "after closing" : "open"
  };
}

// ─── System prompt composition ────────────────────────────────────────────────

function businessBlock(cfg) {
  const b = cfg.business;
  const lines = [
    `Name: ${b.name}`,
    b.industry && `Industry: ${b.industry}`,
    b.tagline && `Tagline: ${b.tagline}`,
    b.phone && `Phone: ${b.phone}`,
    b.email && `Email: ${b.email}`,
    b.website && `Website: ${b.website}`,
    b.address && `Address: ${b.address}`,
    `Timezone: ${b.timezone}`,
    b.bookingLink && `Booking link: ${b.bookingLink}`,
    b.reviewLink && `Google review link: ${b.reviewLink}`
  ].filter(Boolean);
  return `${lines.join("\n")}\n\nHOURS:\n${hoursSummary(cfg)}`;
}

function receptionBlock(cfg) {
  const r = cfg.receptionist;
  if (!r.enabled) return "RECEPTION MODE IS DISABLED. Politely tell callers you can't take bookings right now and give them the business phone number.";

  const services = (r.services || []).length
    ? r.services.map(s =>
        `- ${s.name}${s.duration ? ` (${s.duration} min)` : ""}${s.price ? ` — ${s.price}` : ""}${s.description ? `: ${s.description}` : ""}`
      ).join("\n")
    : "- (no services configured — ask what they need and take a message)";

  const faqs = (r.faqs || []).length
    ? r.faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "(no FAQs configured)";

  return `You are "${r.agentName}", the receptionist for ${cfg.business.name}.

GREETING (open a new conversation with this, adapted naturally):
${render(r.greeting)}

TONE: ${r.tone}
STYLE: ${r.style}
LANGUAGES: ${(r.languages || ["English"]).join(", ")}

SERVICES YOU CAN BOOK:
${services}

APPROVED ANSWERS (use these verbatim in meaning — never contradict them):
${faqs}

ALWAYS COLLECT before ending a booking or message: ${(r.collectFields || []).join(", ")}.

AFTER HOURS: If the business is closed, say: "${render(r.afterHoursMessage)}"

ESCALATE (stop trying to solve it, hand off, and call take_message with urgency "high") when: ${(r.escalation?.triggers || []).join("; ") || "the caller is upset or asks for a human"}.
${r.escalation?.transferTo ? `Transfer target: ${r.escalation.transferTo}` : ""}

BOOKING RULES:
- Slot length ${r.appointment?.slotMinutes || 30} min; earliest booking ${r.appointment?.leadTimeHours || 2}h from now; up to ${r.appointment?.maxDaysAhead || 30} days ahead.
- ALWAYS call check_availability before promising a time. Never invent an opening.
- After the caller confirms, call book_appointment. Then read the confirmed date/time back to them.
- If nothing fits, call take_message so a human can follow up.

HARD RULES:
- Never invent prices, policies, or availability that aren't in this brief. If you don't know, say so and take a message.
- Never ask for card numbers, SSNs, or passwords.
- One question at a time. Keep replies short enough to be spoken aloud.
${r.customInstructions ? `\nOPERATOR INSTRUCTIONS (these override the above):\n${r.customInstructions}` : ""}`;
}

function reviewsBlock(cfg) {
  const rv = cfg.reviews;
  if (!rv.enabled) return "REVIEW MODE IS DISABLED. Do not draft or post review replies.";

  const templates = Object.entries(rv.templates || {})
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([stars, guide]) => `${stars}★ → ${guide}`)
    .join("\n");

  return `You also manage the Google Business Profile reviews for ${cfg.business.name}.

REPLY TONE: ${rv.replyTone}
MAX LENGTH: ${rv.maxLength} words. Shorter is better.
SIGN-OFF: ${render(rv.signature)}

PER-RATING PLAYBOOK:
${templates}

POSTING POLICY:
- Auto-posting is ${rv.autoReply ? "ON" : "OFF"}.${rv.autoReply ? ` Replies at ${rv.autoReplyMinRating}★ and above post automatically; anything lower is drafted for human approval.` : " Every reply you write is saved as a DRAFT for human approval — say so when you finish."}
- Reviews below ${rv.negativeAlertBelow}★ are escalations: draft the reply, then call alert_owner.
- Never dispute facts publicly, never mention refunds or legal terms, never post private customer details.
- Use the reviewer's first name when it's available. Reference the specific thing they mentioned — generic replies are worse than none.

REVIEW REQUESTS: send_review_request emails a customer the Google review link. Only send to happy customers, one per customer, never bulk-blast, and never offer anything in exchange for a review (that violates Google's policy — refuse if asked).
${rv.customInstructions ? `\nOPERATOR INSTRUCTIONS (these override the above):\n${rv.customInstructions}` : ""}`;
}

/**
 * Compose the live system prompt. Called fresh on every agent turn, so a config
 * saved from the dashboard takes effect on the very next message.
 */
export function buildFrontDeskPrompt(cfg = loadConfig()) {
  const status = isWithinHours(new Date(), cfg);
  return `You are the FRONT DESK agent for ${cfg.business.name} — one agent doing two jobs: AI RECEPTIONIST and GOOGLE REVIEW MANAGER.

You have real tools. Use them. Never describe an action you could take — take it, then report the result.
Pick the job from what's asked: a customer talking to you → reception. The operator asking about reviews/ratings/replies → reviews.

═══ BUSINESS PROFILE ═══
${businessBlock(cfg)}

Right now the business is: ${status.open ? "OPEN" : `CLOSED (${status.reason})`}. Current time: ${new Date().toISOString()}.

═══ JOB 1 — RECEPTION ═══
${receptionBlock(cfg)}

═══ JOB 2 — GOOGLE REVIEWS ═══
${reviewsBlock(cfg)}

═══ REPORTING (operator-facing turns only) ═══
When the operator (not a customer) asks you for work, end with a short status line:
**Front Desk** — bookings: N · messages: N · replies drafted/posted: N · review requests sent: N
Never show this to a customer mid-conversation.`;
}

export function getConfigStatus() {
  const cfg = loadConfig();
  return {
    businessName: cfg.business.name,
    receptionistEnabled: cfg.receptionist.enabled,
    reviewsEnabled: cfg.reviews.enabled,
    autoReply: cfg.reviews.autoReply,
    hasReviewLink: !!cfg.business.reviewLink,
    hasPlaceId: !!cfg.business.placeId,
    servicesCount: (cfg.receptionist.services || []).length,
    faqCount: (cfg.receptionist.faqs || []).length,
    configPath: CONFIG_PATH
  };
}

export { CONFIG_PATH };
