/**
 * Google review layer for the Front Desk agent.
 *
 * Three modes, picked automatically by what's configured in server/.env:
 *
 *   business_profile — full read + reply. Needs GOOGLE_CLIENT_ID,
 *                      GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN,
 *                      GOOGLE_ACCOUNT_ID, GOOGLE_LOCATION_ID.
 *   places           — read-only (Google caps the Places API at ~5 reviews).
 *                      Needs GOOGLE_PLACES_API_KEY + a Place ID in settings.
 *   local            — nothing configured. Reviews can be added by hand or
 *                      imported, and replies are stored locally instead of
 *                      posted. Everything else in the product still works.
 *
 * Reviews and drafted replies persist to server/data/frontdesk.reviews.json so
 * pending approvals survive a restart.
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../data");
const STORE_PATH = join(DATA_DIR, "frontdesk.reviews.json");

const STAR_WORDS = { STAR_RATING_UNSPECIFIED: 0, ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

let _broadcast = null;
export function initReviewStore(broadcast) { _broadcast = broadcast; }
function emit(type, data) { _broadcast?.({ type, ...data }); }

// ─── Persistence ──────────────────────────────────────────────────────────────

const state = { reviews: new Map(), requests: new Map(), lastSync: null };

function load() {
  try {
    if (!existsSync(STORE_PATH)) return;
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    (raw.reviews || []).forEach(r => state.reviews.set(r.id, r));
    (raw.requests || []).forEach(r => state.requests.set(r.id, r));
    state.lastSync = raw.lastSync || null;
  } catch (err) {
    console.error(`[Reviews] Store unreadable (${err.message}) — starting empty`);
  }
}

function save() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    writeFileSync(tmp, JSON.stringify({
      reviews: [...state.reviews.values()],
      requests: [...state.requests.values()],
      lastSync: state.lastSync
    }, null, 2));
    renameSync(tmp, STORE_PATH);
  } catch (err) {
    console.error(`[Reviews] Save failed: ${err.message}`);
  }
}

load();

// ─── Mode detection ───────────────────────────────────────────────────────────

export function getReviewMode(placeId = "") {
  const bp = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
                process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_ACCOUNT_ID &&
                process.env.GOOGLE_LOCATION_ID);
  if (bp) {
    return {
      mode: "business_profile", canRead: true, canReply: true,
      detail: "Connected to the Google Business Profile API — replies post publicly to Google."
    };
  }
  if (process.env.GOOGLE_PLACES_API_KEY && placeId) {
    return {
      mode: "places", canRead: true, canReply: false,
      detail: "Reading reviews via the Places API (up to 5 most relevant). Posting replies needs Business Profile OAuth."
    };
  }
  return {
    mode: "local", canRead: false, canReply: false,
    detail: "No Google credentials configured. Reviews can be added manually and replies are stored locally."
  };
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

let _token = { value: null, expiresAt: 0 };

async function getAccessToken() {
  if (_token.value && Date.now() < _token.expiresAt - 60_000) return _token.value;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth failed: ${data.error_description || data.error || res.status}`);

  _token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return _token.value;
}

// ─── Normalisation ────────────────────────────────────────────────────────────

function normalizeBusinessProfileReview(r) {
  return {
    id: `gbp-${r.reviewId}`,
    source: "business_profile",
    externalId: r.reviewId,
    author: r.reviewer?.displayName || "Anonymous",
    authorPhoto: r.reviewer?.profilePhotoUrl || null,
    rating: STAR_WORDS[r.starRating] ?? 0,
    text: r.comment || "",
    createdAt: r.createTime || new Date().toISOString(),
    updatedAt: r.updateTime || null,
    reply: r.reviewReply?.comment || null,
    replyStatus: r.reviewReply?.comment ? "posted" : "none",
    replyPostedAt: r.reviewReply?.updateTime || null,
    draftReply: null
  };
}

function normalizePlacesReview(r, i) {
  const text = r.text?.text || r.text || r.originalText?.text || "";
  const author = r.authorAttribution?.displayName || r.author_name || "Anonymous";
  // Places reviews carry no stable ID, so derive one that stays put across syncs.
  const key = `${author}-${r.publishTime || r.time || i}`.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 48);
  return {
    id: `places-${key}`,
    source: "places",
    externalId: null,
    author,
    authorPhoto: r.authorAttribution?.photoUri || r.profile_photo_url || null,
    rating: r.rating || 0,
    text,
    createdAt: r.publishTime || (r.time ? new Date(r.time * 1000).toISOString() : new Date().toISOString()),
    updatedAt: null,
    reply: null,
    replyStatus: "none",
    replyPostedAt: null,
    draftReply: null
  };
}

/** Keep locally drafted/posted replies when a sync refreshes a review. */
function upsert(review) {
  const existing = state.reviews.get(review.id);
  const merged = existing
    ? {
        ...existing,
        ...review,
        draftReply: review.reply ? null : existing.draftReply,
        reply: review.reply || existing.reply,
        replyStatus: review.reply ? "posted" : existing.replyStatus,
        replyPostedAt: review.replyPostedAt || existing.replyPostedAt
      }
    : review;
  state.reviews.set(merged.id, merged);
  if (!existing) emit("review_added", { review: merged });
  else emit("review_updated", { review: merged });
  return merged;
}

// ─── Fetching ─────────────────────────────────────────────────────────────────

async function fetchBusinessProfileReviews() {
  const token = await getAccessToken();
  const url = `https://mybusiness.googleapis.com/v4/accounts/${process.env.GOOGLE_ACCOUNT_ID}/locations/${process.env.GOOGLE_LOCATION_ID}/reviews?pageSize=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Business Profile API: ${data.error?.message || res.status}`);
  return (data.reviews || []).map(normalizeBusinessProfileReview);
}

async function fetchPlacesReviews(placeId) {
  const key = process.env.GOOGLE_PLACES_API_KEY;

  // Places API (New) first — it returns richer review objects.
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "reviews,rating,userRatingCount,displayName" }
  });
  if (res.ok) {
    const data = await res.json();
    return (data.reviews || []).map(normalizePlacesReview);
  }

  // Fall back to the legacy Place Details endpoint for older API-key setups.
  const legacy = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=reviews,rating,user_ratings_total&key=${key}`
  );
  const legacyData = await legacy.json();
  if (legacyData.status && legacyData.status !== "OK") {
    throw new Error(`Places API: ${legacyData.error_message || legacyData.status}`);
  }
  return (legacyData.result?.reviews || []).map(normalizePlacesReview);
}

/** Pull the latest reviews from whichever Google source is configured. */
export async function syncReviews(placeId = "") {
  const mode = getReviewMode(placeId);
  if (!mode.canRead) {
    return { ok: false, mode: mode.mode, error: mode.detail, synced: 0, reviews: getAllReviews() };
  }
  try {
    const fetched = mode.mode === "business_profile"
      ? await fetchBusinessProfileReviews()
      : await fetchPlacesReviews(placeId);

    const known = new Set(state.reviews.keys());
    const newOnes = fetched.filter(r => !known.has(r.id));
    fetched.forEach(upsert);
    state.lastSync = new Date().toISOString();
    save();
    emit("reviews_synced", { count: fetched.length, newCount: newOnes.length, lastSync: state.lastSync });
    return { ok: true, mode: mode.mode, synced: fetched.length, newReviews: newOnes, reviews: getAllReviews() };
  } catch (err) {
    return { ok: false, mode: mode.mode, error: err.message, synced: 0, reviews: getAllReviews() };
  }
}

// ─── Replies ──────────────────────────────────────────────────────────────────

export function saveDraftReply(reviewId, text) {
  const review = state.reviews.get(reviewId);
  if (!review) return { ok: false, error: `Review ${reviewId} not found` };
  review.draftReply = text;
  review.replyStatus = "draft";
  review.draftedAt = new Date().toISOString();
  save();
  emit("review_updated", { review });
  return { ok: true, review };
}

/** Post a reply to Google. Falls back to storing it locally when we can't post. */
export async function postReply(reviewId, text) {
  const review = state.reviews.get(reviewId);
  if (!review) return { ok: false, error: `Review ${reviewId} not found` };

  const comment = text || review.draftReply;
  if (!comment) return { ok: false, error: "No reply text to post" };

  const mode = getReviewMode();
  if (mode.canReply && review.source === "business_profile" && review.externalId) {
    try {
      const token = await getAccessToken();
      const url = `https://mybusiness.googleapis.com/v4/accounts/${process.env.GOOGLE_ACCOUNT_ID}/locations/${process.env.GOOGLE_LOCATION_ID}/reviews/${review.externalId}/reply`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);

      review.reply = comment;
      review.draftReply = null;
      review.replyStatus = "posted";
      review.replyPostedAt = new Date().toISOString();
      save();
      emit("review_updated", { review });
      return { ok: true, posted: true, review };
    } catch (err) {
      review.draftReply = comment;
      review.replyStatus = "draft";
      review.lastError = err.message;
      save();
      emit("review_updated", { review });
      return { ok: false, posted: false, error: `Google rejected the reply (${err.message}). Saved as a draft.`, review };
    }
  }

  // No posting path available — keep it as an approved local reply.
  review.reply = comment;
  review.draftReply = null;
  review.replyStatus = "approved_local";
  review.replyPostedAt = new Date().toISOString();
  save();
  emit("review_updated", { review });
  return {
    ok: true,
    posted: false,
    review,
    note: `Saved locally. ${mode.mode === "business_profile" ? "This review didn't come from the Business Profile API, so it can't be posted." : "Connect the Google Business Profile API to post replies to Google automatically."}`
  };
}

export function discardDraft(reviewId) {
  const review = state.reviews.get(reviewId);
  if (!review) return { ok: false, error: "Review not found" };
  review.draftReply = null;
  review.replyStatus = review.reply ? "posted" : "none";
  save();
  emit("review_updated", { review });
  return { ok: true, review };
}

// ─── Manual / imported reviews ────────────────────────────────────────────────

export function addLocalReview({ author, rating, text, createdAt, source = "manual" }) {
  const review = {
    id: `local-${uuidv4().slice(0, 8)}`,
    source,
    externalId: null,
    author: author || "Anonymous",
    authorPhoto: null,
    rating: Number(rating) || 0,
    text: text || "",
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: null,
    reply: null,
    replyStatus: "none",
    replyPostedAt: null,
    draftReply: null
  };
  state.reviews.set(review.id, review);
  save();
  emit("review_added", { review });
  return review;
}

export function deleteReview(id) {
  const existed = state.reviews.delete(id);
  if (existed) { save(); emit("review_deleted", { id }); }
  return existed;
}

// ─── Review requests ──────────────────────────────────────────────────────────

export function recordReviewRequest({ to, name, subject, body, messageId, status = "sent", error = null }) {
  const record = {
    id: `req-${uuidv4().slice(0, 8)}`,
    to, name, subject, body, messageId, status, error,
    sentAt: new Date().toISOString()
  };
  state.requests.set(record.id, record);
  save();
  emit("review_request_sent", { request: record });
  return record;
}

export function getReviewRequests() {
  return [...state.requests.values()].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function hasRequestedReview(email) {
  const target = String(email || "").toLowerCase();
  return [...state.requests.values()].some(r => String(r.to).toLowerCase() === target && r.status === "sent");
}

// ─── Reads & stats ────────────────────────────────────────────────────────────

export function getAllReviews() {
  return [...state.reviews.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function getReview(id) { return state.reviews.get(id); }

export function getReviewStats() {
  const all = getAllReviews();
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of all) {
    if (r.rating >= 1 && r.rating <= 5) distribution[r.rating]++;
    sum += r.rating || 0;
  }
  return {
    total: all.length,
    average: all.length ? Number((sum / all.length).toFixed(2)) : 0,
    distribution,
    unanswered: all.filter(r => r.replyStatus === "none").length,
    draftsPending: all.filter(r => r.replyStatus === "draft").length,
    posted: all.filter(r => r.replyStatus === "posted").length,
    negative: all.filter(r => r.rating > 0 && r.rating <= 3).length,
    requestsSent: state.requests.size,
    lastSync: state.lastSync
  };
}

export function getLastSync() { return state.lastSync; }
