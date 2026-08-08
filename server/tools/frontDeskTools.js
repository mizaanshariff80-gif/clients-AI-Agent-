/**
 * Tool definitions + executor for the Front Desk agent
 * (AI Receptionist + Google Review manager in one).
 *
 * Every tool reads the live config, so anything the operator edits in the
 * dashboard changes behaviour on the very next call.
 */

import { loadConfig, render, isWithinHours, hoursSummary } from "../config/frontDeskConfig.js";
import { sendEmail, isEmailConfigured } from "./emailClient.js";
import {
  getAvailability, findNextAvailable, bookAppointment, cancelAppointment,
  getAllAppointments, getUpcomingAppointments, takeMessage, getReceptionStats,
  localDateString, updateAppointment
} from "./receptionStore.js";
import {
  syncReviews, getAllReviews, getReview, saveDraftReply, postReply,
  getReviewStats, recordReviewRequest, hasRequestedReview, addLocalReview,
  getReviewMode
} from "./googleReviews.js";

export const FRONT_DESK_TOOLS = [
  // ─── Reception ──────────────────────────────────────────────────────────────
  {
    name: "get_business_info",
    description: "Get the current business profile: hours, whether it's open right now, services with prices/durations, and the approved FAQ answers. Call this before answering any question about hours, pricing, services, or policies.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "check_availability",
    description: "List the real open appointment slots for one date. ALWAYS call this before offering a time to a customer — never guess availability.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD (business timezone)" },
        service: { type: "string", description: "Service name, so the slot length matches its duration" }
      },
      required: ["date"]
    }
  },
  {
    name: "find_next_available",
    description: "Find the next few days that have open slots. Use when the customer is flexible or their requested time is taken.",
    input_schema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "Start searching from this date (YYYY-MM-DD). Defaults to today." },
        service: { type: "string", description: "Service name for correct slot length" },
        days: { type: "number", description: "How many days ahead to scan (default 14)" }
      },
      required: []
    }
  },
  {
    name: "book_appointment",
    description: "Book a confirmed appointment. Only call after the customer has agreed to a specific date and time that check_availability returned. Sends a confirmation email automatically when configured.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        service: { type: "string", description: "Must match one of the configured services when possible" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM in 24-hour business-local time" },
        notes: { type: "string", description: "Reason for visit / anything the team should know" }
      },
      required: ["name", "date", "time"]
    }
  },
  {
    name: "cancel_appointment",
    description: "Cancel an existing appointment by its ID.",
    input_schema: {
      type: "object",
      properties: { appointmentId: { type: "string" }, reason: { type: "string" } },
      required: ["appointmentId"]
    }
  },
  {
    name: "list_appointments",
    description: "List booked appointments.",
    input_schema: {
      type: "object",
      properties: { scope: { type: "string", enum: ["today", "upcoming", "all"], description: "Default: upcoming" } },
      required: []
    }
  },
  {
    name: "take_message",
    description: "Record a message or callback request for the human team. Use whenever you can't fully resolve something, the caller wants a human, or the business is closed.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        message: { type: "string", description: "What the caller wants, in their words" },
        urgency: { type: "string", enum: ["low", "normal", "high"] },
        forWhom: { type: "string", description: "Who the message is for, if named" }
      },
      required: ["name", "message"]
    }
  },

  // ─── Google reviews ─────────────────────────────────────────────────────────
  {
    name: "sync_google_reviews",
    description: "Pull the latest reviews from Google (Business Profile API or Places API, depending on what's configured). Call this before reporting on reviews so the data is current.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "list_reviews",
    description: "List reviews already loaded, with their reply status.",
    input_schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["all", "unanswered", "negative", "drafts", "posted"], description: "Default: all" },
        limit: { type: "number", description: "Max reviews to return (default 20)" }
      },
      required: []
    }
  },
  {
    name: "draft_review_reply",
    description: "Write a reply to a review. Saves it as a draft for human approval, or posts it immediately when the operator's auto-reply policy allows it. Follow the per-rating playbook and the length limit in your brief.",
    input_schema: {
      type: "object",
      properties: {
        reviewId: { type: "string" },
        replyText: { type: "string", description: "The full reply text, ready to publish" }
      },
      required: ["reviewId", "replyText"]
    }
  },
  {
    name: "post_review_reply",
    description: "Publish a reply to Google now — either an approved draft or new text. Use only when the operator explicitly asks to post/approve.",
    input_schema: {
      type: "object",
      properties: {
        reviewId: { type: "string" },
        replyText: { type: "string", description: "Optional. Omit to post the saved draft." }
      },
      required: ["reviewId"]
    }
  },
  {
    name: "send_review_request",
    description: "Email a customer asking for a Google review, using the operator's configured template. Never offer incentives in exchange for reviews.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Customer email" },
        name: { type: "string", description: "Customer first name" },
        customNote: { type: "string", description: "Optional extra line to personalise the request" }
      },
      required: ["to", "name"]
    }
  },
  {
    name: "log_review",
    description: "Manually record a review that didn't come from the Google sync (e.g. read out over the phone, or pasted by the operator).",
    input_schema: {
      type: "object",
      properties: {
        author: { type: "string" },
        rating: { type: "number", description: "1-5" },
        text: { type: "string" }
      },
      required: ["author", "rating"]
    }
  },
  {
    name: "review_stats",
    description: "Get the review scorecard: total, average rating, star distribution, unanswered count, drafts pending.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "alert_owner",
    description: "Email the owner about something that needs a human: a negative review, an escalation, or an urgent message.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
        severity: { type: "string", enum: ["info", "warning", "urgent"] }
      },
      required: ["subject", "body"]
    }
  }
];

// ─── Executor ─────────────────────────────────────────────────────────────────

const json = obj => JSON.stringify(obj, null, 2);

async function sendConfirmation(appointment) {
  const cfg = loadConfig();
  const settings = cfg.receptionist.appointment || {};
  if (!settings.sendConfirmationEmail || !appointment.email) return null;
  if (!isEmailConfigured()) return { sent: false, reason: "email not configured" };

  const vars = {
    name: appointment.name,
    service: appointment.service,
    when: appointment.when,
    date: appointment.date,
    time: appointment.time
  };
  const result = await sendEmail({
    to: appointment.email,
    subject: render(settings.confirmationSubject, vars),
    body: render(settings.confirmationBody, vars),
    fromName: cfg.business.name
  });
  updateAppointment(appointment.id, {
    confirmationEmail: { sent: result.success, at: new Date().toISOString(), error: result.error || null }
  });
  return { sent: result.success, reason: result.error || null };
}

async function notifyOwner(subject, body, severity = "info") {
  const cfg = loadConfig();
  const to = cfg.reviews.negativeAlertEmail || cfg.receptionist.escalation?.notifyEmail || cfg.business.email;
  if (!to) return { sent: false, reason: "No alert email configured in settings" };
  if (!isEmailConfigured()) return { sent: false, reason: "Email transport not configured in server/.env" };
  const result = await sendEmail({
    to,
    subject: `[${severity.toUpperCase()}] ${subject}`,
    body,
    fromName: `${cfg.business.name} Front Desk`
  });
  return { sent: result.success, to, reason: result.error || null };
}

export async function executeFrontDeskTool(name, input = {}) {
  const cfg = loadConfig();
  const tz = cfg.business.timezone || "UTC";

  try {
    switch (name) {
      // ── Reception ──────────────────────────────────────────────────────────
      case "get_business_info": {
        const status = isWithinHours(new Date(), cfg);
        return json({
          business: {
            name: cfg.business.name,
            phone: cfg.business.phone,
            email: cfg.business.email,
            address: cfg.business.address,
            website: cfg.business.website,
            bookingLink: cfg.business.bookingLink,
            timezone: tz
          },
          openNow: status.open,
          openStatusReason: status.reason,
          today: localDateString(new Date(), tz),
          hours: hoursSummary(cfg),
          services: cfg.receptionist.services || [],
          faqs: cfg.receptionist.faqs || []
        });
      }

      case "check_availability": {
        const service = (cfg.receptionist.services || []).find(
          s => s.name?.toLowerCase() === String(input.service || "").toLowerCase()
        );
        const result = getAvailability(input.date, { durationMinutes: service?.duration });
        if (!result.slots.length) {
          result.alternatives = findNextAvailable(input.date, 14, { durationMinutes: service?.duration });
        }
        return json(result);
      }

      case "find_next_available": {
        const service = (cfg.receptionist.services || []).find(
          s => s.name?.toLowerCase() === String(input.service || "").toLowerCase()
        );
        return json({
          timezone: tz,
          options: findNextAvailable(input.fromDate, input.days || 14, { durationMinutes: service?.duration })
        });
      }

      case "book_appointment": {
        const result = bookAppointment({ ...input, source: "front_desk_agent" });
        if (!result.ok) return json(result);
        const confirmation = await sendConfirmation(result.appointment);
        return json({
          ok: true,
          appointment: result.appointment,
          confirmationEmail: confirmation || { sent: false, reason: "not requested" },
          say: `Booked: ${result.appointment.service} for ${result.appointment.name} on ${result.appointment.when}.`
        });
      }

      case "cancel_appointment":
        return json(cancelAppointment(input.appointmentId));

      case "list_appointments": {
        const scope = input.scope || "upcoming";
        const today = localDateString(new Date(), tz);
        const list = scope === "all" ? getAllAppointments()
          : scope === "today" ? getAllAppointments().filter(a => a.date === today && a.status !== "cancelled")
          : getUpcomingAppointments();
        return json({ scope, count: list.length, appointments: list.slice(0, 40) });
      }

      case "take_message": {
        const record = takeMessage({ ...input, source: "front_desk_agent" });
        let alert = null;
        if (record.urgency === "high") {
          alert = await notifyOwner(
            `Urgent message from ${record.name}`,
            `${record.message}\n\nContact: ${record.phone || record.email || "not provided"}\nTaken: ${record.createdAt}`,
            "urgent"
          );
        }
        return json({ ok: true, message: record, ownerAlert: alert });
      }

      // ── Reviews ────────────────────────────────────────────────────────────
      case "sync_google_reviews": {
        const result = await syncReviews(cfg.business.placeId);
        return json({
          ...result,
          reviews: undefined,
          stats: getReviewStats(),
          newReviews: (result.newReviews || []).map(r => ({ id: r.id, author: r.author, rating: r.rating, text: r.text }))
        });
      }

      case "list_reviews": {
        const limit = input.limit || 20;
        const filters = {
          unanswered: r => r.replyStatus === "none",
          negative: r => r.rating > 0 && r.rating <= 3,
          drafts: r => r.replyStatus === "draft",
          posted: r => r.replyStatus === "posted" || r.replyStatus === "approved_local"
        };
        const predicate = filters[input.filter] || (() => true);
        const list = getAllReviews().filter(predicate).slice(0, limit);
        return json({
          mode: getReviewMode(cfg.business.placeId).mode,
          filter: input.filter || "all",
          count: list.length,
          reviews: list.map(r => ({
            id: r.id, author: r.author, rating: r.rating, text: r.text,
            createdAt: r.createdAt, replyStatus: r.replyStatus,
            reply: r.reply, draftReply: r.draftReply
          }))
        });
      }

      case "draft_review_reply": {
        const review = getReview(input.reviewId);
        if (!review) return `Review ${input.reviewId} not found. Call list_reviews for valid IDs.`;

        const policy = cfg.reviews;
        const shouldAutoPost = policy.autoReply && review.rating >= (policy.autoReplyMinRating || 5);

        if (shouldAutoPost) {
          const posted = await postReply(input.reviewId, input.replyText);
          return json({
            action: posted.posted ? "posted_to_google" : "saved_locally",
            autoReplyPolicy: `auto-post at ${policy.autoReplyMinRating}★+`,
            review: { id: review.id, author: review.author, rating: review.rating },
            reply: input.replyText,
            note: posted.note || posted.error || null
          });
        }

        saveDraftReply(input.reviewId, input.replyText);
        let alert = null;
        if (review.rating > 0 && review.rating < (policy.negativeAlertBelow || 4)) {
          alert = await notifyOwner(
            `${review.rating}★ review from ${review.author}`,
            `"${review.text}"\n\nDrafted reply awaiting your approval:\n${input.replyText}`,
            "warning"
          );
        }
        return json({
          action: "saved_as_draft",
          awaitingApproval: true,
          review: { id: review.id, author: review.author, rating: review.rating },
          reply: input.replyText,
          ownerAlert: alert
        });
      }

      case "post_review_reply": {
        const result = await postReply(input.reviewId, input.replyText);
        return json({
          ok: result.ok,
          postedToGoogle: !!result.posted,
          note: result.note || result.error || null,
          review: result.review ? { id: result.review.id, replyStatus: result.review.replyStatus, reply: result.review.reply } : null
        });
      }

      case "send_review_request": {
        if (!cfg.business.reviewLink) {
          return "No Google review link is configured. The operator needs to set it in Front Desk → Settings → Business before requests can be sent.";
        }
        if (hasRequestedReview(input.to)) {
          return `A review request was already sent to ${input.to}. Don't send a second one.`;
        }
        const vars = { name: input.name, reviewLink: cfg.business.reviewLink };
        const subject = render(cfg.reviews.requestSubject, vars);
        const body = render(cfg.reviews.requestBody, vars) + (input.customNote ? `\n\n${input.customNote}` : "");

        if (!isEmailConfigured()) {
          const record = recordReviewRequest({ to: input.to, name: input.name, subject, body, status: "not_sent", error: "Email not configured" });
          return json({ ok: false, error: "Email transport not configured (EMAIL_USER / EMAIL_APP_PASSWORD in server/.env). Request logged but not sent.", draft: record });
        }

        const result = await sendEmail({ to: input.to, subject, body, fromName: cfg.business.name });
        const record = recordReviewRequest({
          to: input.to, name: input.name, subject, body,
          messageId: result.messageId,
          status: result.success ? "sent" : "failed",
          error: result.error || null
        });
        return json({ ok: result.success, request: record, error: result.error || null });
      }

      case "log_review":
        return json({ ok: true, review: addLocalReview(input) });

      case "review_stats":
        return json({ mode: getReviewMode(cfg.business.placeId), ...getReviewStats() });

      case "alert_owner":
        return json(await notifyOwner(input.subject, input.body, input.severity || "info"));

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Tool error (${name}): ${err.message}`;
  }
}

/** Combined counters used for the agent's operator-facing status line. */
export function getFrontDeskStats() {
  return { reception: getReceptionStats(), reviews: getReviewStats() };
}
