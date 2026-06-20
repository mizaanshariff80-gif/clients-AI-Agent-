/**
 * In-memory lead store with email tracking and follow-up scheduling.
 * Emits events so the dashboard can show live updates.
 */

import { v4 as uuidv4 } from "uuid";

const leads = new Map();      // id → lead
const emails = new Map();     // id → email record
const followups = new Map();  // id → followup record
const timers = new Map();     // id → NodeJS.Timeout

let _broadcast = null;
export function initLeadStore(broadcast) { _broadcast = broadcast; }

function emit(type, data) { _broadcast?.({ type, ...data }); }

// ─── Leads ────────────────────────────────────────────────────────────────────

export function addLead(lead) {
  const id = lead.id || uuidv4();
  const record = {
    ...lead,
    id,
    status: "new",           // new | contacted | replied | booked | disqualified
    emailStatus: "not_sent", // not_sent | sent | bounced | follow_up_scheduled | replied
    addedAt: new Date().toISOString()
  };
  leads.set(id, record);
  emit("lead_added", { lead: record });
  return record;
}

export function updateLeadStatus(id, status) {
  const l = leads.get(id);
  if (l) { l.status = status; emit("lead_updated", { lead: l }); }
  return l;
}

export function getAllLeads() { return [...leads.values()]; }
export function getLead(id) { return leads.get(id); }
export function clearLeads() { leads.clear(); }

// ─── Email Tracking ───────────────────────────────────────────────────────────

export function recordEmail({ leadId, to, subject, body, messageId }) {
  const id = uuidv4();
  const record = {
    id, leadId, to, subject, body, messageId,
    sentAt: new Date().toISOString(),
    opened: false, replied: false
  };
  emails.set(id, record);

  const lead = leads.get(leadId);
  if (lead) {
    lead.emailStatus = "sent";
    lead.lastContactedAt = record.sentAt;
    emit("lead_updated", { lead });
  }
  emit("email_sent", { email: record });
  return record;
}

export function getAllEmails() { return [...emails.values()]; }

// ─── Follow-up Scheduling ─────────────────────────────────────────────────────

/**
 * Schedule a follow-up email for a lead.
 * @param {string} leadId
 * @param {number} delayDays - how many days from now
 * @param {string} subject
 * @param {string} body
 * @param {function} sendFn - async function to call when timer fires
 */
export function scheduleFollowup({ leadId, delayDays = 3, subject, body, sendFn }) {
  const id = uuidv4();
  const fireAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000);

  const record = {
    id, leadId, subject, body, delayDays,
    scheduledFor: fireAt.toISOString(),
    status: "pending"  // pending | sent | cancelled
  };
  followups.set(id, record);

  const lead = leads.get(leadId);
  if (lead) {
    lead.emailStatus = "follow_up_scheduled";
    lead.followupAt = fireAt.toISOString();
    emit("lead_updated", { lead });
  }
  emit("followup_scheduled", { followup: record });

  // Schedule the actual send
  const ms = fireAt.getTime() - Date.now();
  const timer = setTimeout(async () => {
    record.status = "sent";
    record.firedAt = new Date().toISOString();
    emit("followup_fired", { followup: record });
    if (sendFn) await sendFn(record);
  }, Math.max(ms, 0));

  timers.set(id, timer);
  return record;
}

export function cancelFollowup(id) {
  const timer = timers.get(id);
  if (timer) { clearTimeout(timer); timers.delete(id); }
  const record = followups.get(id);
  if (record) { record.status = "cancelled"; emit("followup_cancelled", { followup: record }); }
  return record;
}

export function getAllFollowups() { return [...followups.values()]; }

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getPipelineStats() {
  const allLeads = getAllLeads();
  return {
    total: allLeads.length,
    new: allLeads.filter(l => l.status === "new").length,
    contacted: allLeads.filter(l => l.status === "contacted").length,
    replied: allLeads.filter(l => l.status === "replied").length,
    booked: allLeads.filter(l => l.status === "booked").length,
    emailsSent: getAllEmails().length,
    followupsPending: getAllFollowups().filter(f => f.status === "pending").length
  };
}
