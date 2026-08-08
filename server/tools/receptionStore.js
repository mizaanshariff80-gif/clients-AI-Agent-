/**
 * Reception store — appointments, messages/callbacks, and conversation logs
 * for the AI Receptionist half of the Front Desk agent.
 *
 * All wall-clock times are stored in the business's configured timezone as
 * ("YYYY-MM-DD", "HH:MM") pairs plus a derived UTC instant, so bookings stay
 * correct across DST and wherever the server happens to run.
 *
 * Persists to server/data/frontdesk.reception.json.
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { loadConfig } from "../config/frontDeskConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../data");
const STORE_PATH = join(DATA_DIR, "frontdesk.reception.json");

let _broadcast = null;
export function initReceptionStore(broadcast) { _broadcast = broadcast; }
function emit(type, data) { _broadcast?.({ type, ...data }); }

const state = {
  appointments: new Map(),
  messages: new Map(),
  conversations: new Map()
};

function load() {
  try {
    if (!existsSync(STORE_PATH)) return;
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    (raw.appointments || []).forEach(a => state.appointments.set(a.id, a));
    (raw.messages || []).forEach(m => state.messages.set(m.id, m));
    (raw.conversations || []).forEach(c => state.conversations.set(c.id, c));
  } catch (err) {
    console.error(`[Reception] Store unreadable (${err.message}) — starting empty`);
  }
}

function save() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    writeFileSync(tmp, JSON.stringify({
      appointments: [...state.appointments.values()],
      messages: [...state.messages.values()],
      // Conversation logs are for review, not an archive — keep the last 200.
      conversations: [...state.conversations.values()].slice(-200)
    }, null, 2));
    renameSync(tmp, STORE_PATH);
  } catch (err) {
    console.error(`[Reception] Save failed: ${err.message}`);
  }
}

load();

// ─── Timezone helpers ─────────────────────────────────────────────────────────

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function tzOffsetMinutes(date, tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
    return (asUTC - date.getTime()) / 60000;
  } catch {
    return 0;
  }
}

/** Convert a business-local date+time to the real UTC instant. */
export function localToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const [hh, mm] = String(timeStr).split(":").map(Number);
  const naive = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  // Offset is resolved twice so times near a DST switch land on the right side.
  const firstPass = naive - tzOffsetMinutes(new Date(naive), tz) * 60000;
  const offset = tzOffsetMinutes(new Date(firstPass), tz);
  return new Date(naive - offset * 60000);
}

/** Today's date (YYYY-MM-DD) in the business timezone. */
export function localDateString(date = new Date(), tz = "UTC") {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function dayKeyFor(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

const toMinutes = s => {
  const [h, m] = String(s || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toTimeStr = mins =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export function formatWhen(dateStr, timeStr, tz) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz, weekday: "long", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit"
    }).format(localToUtc(dateStr, timeStr, tz));
  } catch {
    return `${dateStr} ${timeStr}`;
  }
}

// ─── Availability ─────────────────────────────────────────────────────────────

/**
 * Open slots for a business-local date, honouring hours, slot length, lead
 * time, per-slot capacity, and the requested service duration.
 */
export function getAvailability(dateStr, { durationMinutes } = {}) {
  const cfg = loadConfig();
  const tz = cfg.business.timezone || "UTC";
  const appt = cfg.receptionist.appointment || {};
  const slotMinutes = appt.slotMinutes || 30;
  const duration = durationMinutes || slotMinutes;
  const maxPerSlot = appt.maxPerSlot || 1;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
    return { date: dateStr, slots: [], reason: "Invalid date — use YYYY-MM-DD." };
  }

  const hours = cfg.business.hours?.[dayKeyFor(dateStr)];
  if (!hours || hours.closed) return { date: dateStr, slots: [], reason: "Closed that day." };

  const today = localDateString(new Date(), tz);
  const maxDate = localDateString(new Date(Date.now() + (appt.maxDaysAhead || 30) * 86400000), tz);
  if (dateStr < today) return { date: dateStr, slots: [], reason: "That date is in the past." };
  if (dateStr > maxDate) return { date: dateStr, slots: [], reason: `We only book up to ${appt.maxDaysAhead || 30} days ahead.` };

  const earliest = Date.now() + (appt.leadTimeHours || 0) * 3600000;
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);

  const booked = [...state.appointments.values()].filter(
    a => a.date === dateStr && a.status !== "cancelled"
  );

  const slots = [];
  for (let m = open; m + duration <= close; m += slotMinutes) {
    const time = toTimeStr(m);
    const instant = localToUtc(dateStr, time, tz);
    if (instant.getTime() < earliest) continue;

    // A slot is taken if any live booking overlaps [m, m+duration).
    const overlapping = booked.filter(a => {
      const start = toMinutes(a.time);
      const end = start + (a.durationMinutes || slotMinutes);
      return start < m + duration && end > m;
    });
    if (overlapping.length >= maxPerSlot) continue;

    slots.push({ time, iso: instant.toISOString(), label: formatWhen(dateStr, time, tz) });
  }

  return {
    date: dateStr,
    timezone: tz,
    slotMinutes,
    durationMinutes: duration,
    slots,
    reason: slots.length ? null : "Fully booked or outside the booking window."
  };
}

/** Scan forward from a date for the next N days that have any opening. */
export function findNextAvailable(fromDate, days = 14, opts = {}) {
  const cfg = loadConfig();
  const tz = cfg.business.timezone || "UTC";
  const start = fromDate || localDateString(new Date(), tz);
  const [y, m, d] = start.split("-").map(Number);
  const results = [];

  for (let i = 0; i < days && results.length < 5; i++) {
    const cursor = new Date(Date.UTC(y, m - 1, d + i));
    const dateStr = cursor.toISOString().slice(0, 10);
    const { slots } = getAvailability(dateStr, opts);
    if (slots.length) results.push({ date: dateStr, slots: slots.slice(0, 6) });
  }
  return results;
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export function bookAppointment({ name, phone, email, service, date, time, notes, durationMinutes, source = "receptionist" }) {
  const cfg = loadConfig();
  const tz = cfg.business.timezone || "UTC";
  const slotMinutes = cfg.receptionist.appointment?.slotMinutes || 30;
  const matched = (cfg.receptionist.services || []).find(
    s => s.name?.toLowerCase() === String(service || "").toLowerCase()
  );
  const duration = durationMinutes || matched?.duration || slotMinutes;

  const { slots, reason } = getAvailability(date, { durationMinutes: duration });
  if (!slots.some(s => s.time === time)) {
    return {
      ok: false,
      error: reason || `${time} on ${date} isn't available.`,
      alternatives: findNextAvailable(date, 14, { durationMinutes: duration })
    };
  }

  const appointment = {
    id: `apt-${uuidv4().slice(0, 8)}`,
    name: name || "Unknown",
    phone: phone || "",
    email: email || "",
    service: matched?.name || service || "Appointment",
    date, time,
    durationMinutes: duration,
    startsAt: localToUtc(date, time, tz).toISOString(),
    when: formatWhen(date, time, tz),
    notes: notes || "",
    status: "confirmed",
    source,
    confirmationEmail: null,
    createdAt: new Date().toISOString()
  };

  state.appointments.set(appointment.id, appointment);
  save();
  emit("appointment_booked", { appointment });
  return { ok: true, appointment };
}

export function updateAppointment(id, updates) {
  const appointment = state.appointments.get(id);
  if (!appointment) return { ok: false, error: "Appointment not found" };
  Object.assign(appointment, updates);
  if (updates.date || updates.time) {
    const tz = loadConfig().business.timezone || "UTC";
    appointment.startsAt = localToUtc(appointment.date, appointment.time, tz).toISOString();
    appointment.when = formatWhen(appointment.date, appointment.time, tz);
  }
  save();
  emit("appointment_updated", { appointment });
  return { ok: true, appointment };
}

export function cancelAppointment(id) {
  return updateAppointment(id, { status: "cancelled", cancelledAt: new Date().toISOString() });
}

export function getAllAppointments() {
  return [...state.appointments.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function getUpcomingAppointments() {
  const now = Date.now();
  return getAllAppointments().filter(a => a.status !== "cancelled" && new Date(a.startsAt).getTime() >= now);
}

// ─── Messages / callbacks ─────────────────────────────────────────────────────

export function takeMessage({ name, phone, email, message, urgency = "normal", forWhom, source = "receptionist" }) {
  const record = {
    id: `msg-${uuidv4().slice(0, 8)}`,
    name: name || "Unknown",
    phone: phone || "",
    email: email || "",
    message: message || "",
    urgency,                 // low | normal | high
    forWhom: forWhom || "",
    status: "open",          // open | handled
    source,
    createdAt: new Date().toISOString()
  };
  state.messages.set(record.id, record);
  save();
  emit("message_taken", { message: record });
  return record;
}

export function resolveMessage(id) {
  const record = state.messages.get(id);
  if (!record) return { ok: false, error: "Message not found" };
  record.status = "handled";
  record.handledAt = new Date().toISOString();
  save();
  emit("message_updated", { message: record });
  return { ok: true, message: record };
}

export function getAllMessages() {
  return [...state.messages.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Conversations ────────────────────────────────────────────────────────────

export function getOrCreateConversation(id, meta = {}) {
  const key = id || `conv-${uuidv4().slice(0, 8)}`;
  let conversation = state.conversations.get(key);
  if (!conversation) {
    conversation = {
      id: key,
      channel: meta.channel || "web",
      startedAt: new Date().toISOString(),
      turns: [],
      outcome: null,
      ...meta
    };
    state.conversations.set(key, conversation);
    emit("conversation_started", { conversation });
  }
  return conversation;
}

export function appendTurn(conversationId, role, content) {
  const conversation = getOrCreateConversation(conversationId);
  conversation.turns.push({ role, content, at: new Date().toISOString() });
  conversation.lastAt = new Date().toISOString();
  save();
  emit("conversation_turn", { conversationId: conversation.id, role, content });
  return conversation;
}

export function setConversationOutcome(conversationId, outcome) {
  const conversation = state.conversations.get(conversationId);
  if (conversation) { conversation.outcome = outcome; save(); }
  return conversation;
}

export function getConversation(id) { return state.conversations.get(id); }

export function getAllConversations() {
  return [...state.conversations.values()].sort((a, b) =>
    String(b.lastAt || b.startedAt).localeCompare(String(a.lastAt || a.startedAt))
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getReceptionStats() {
  const appointments = getAllAppointments();
  const messages = getAllMessages();
  const todayStr = localDateString(new Date(), loadConfig().business.timezone || "UTC");
  return {
    appointmentsTotal: appointments.filter(a => a.status !== "cancelled").length,
    appointmentsToday: appointments.filter(a => a.date === todayStr && a.status !== "cancelled").length,
    appointmentsUpcoming: getUpcomingAppointments().length,
    cancelled: appointments.filter(a => a.status === "cancelled").length,
    messagesOpen: messages.filter(m => m.status === "open").length,
    messagesUrgent: messages.filter(m => m.status === "open" && m.urgency === "high").length,
    conversations: state.conversations.size
  };
}
