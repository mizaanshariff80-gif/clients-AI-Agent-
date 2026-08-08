# Front Desk — Google Review Agent + AI Receptionist

Two jobs, one agent, one dashboard tab. It answers your customers (books
appointments, answers questions, takes messages) **and** manages your Google
Business Profile reviews (drafts replies, posts them, requests new ones).

**Everything it says and does is editable from the dashboard at any time.**
Open **Front Desk → Settings**, change what you want, hit **Save changes** — the
very next customer conversation and review reply use the new settings. No
restart, no redeploy, no code.

---

## Quick start

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > server/.env
npm start
```

Open http://localhost:3001 → **Front Desk**.

It works immediately with zero Google or email setup: log a review by hand, talk
to the receptionist in the customer simulator, and watch it book real
appointments. Connect Google and email when you're ready for it to go live.

---

## The three tabs

### Google Reviews
Your review scorecard, star distribution, and every review with its reply state.

- **Sync from Google** pulls your latest reviews.
- **Draft reply with AI** writes a reply following your per-star playbook, then
  parks it as a draft.
- **Approve & publish** posts it (or saves it locally if Google isn't connected).
- Edit any draft before approving — the agent proposes, you decide.
- **Ask a customer for a review** sends your request email with your review link.

By default **nothing posts publicly without your approval.** Turn on auto-posting
in Settings when you trust it, and set the star floor (e.g. auto-post 5★ only,
draft everything below).

### Reception
- **Talk to your receptionist as a customer** — the simulator hits the exact
  endpoint a website widget or phone bridge would. Bookings made here are real.
- **Appointments** — everything booked, with cancel.
- **Messages** — callbacks the agent took when it couldn't resolve something.
  Urgent ones email you immediately.
- **Transcripts** — every conversation, so you can see what it actually said.

### Settings
Where you edit everything:

| Section | What you control |
|---|---|
| Business profile | Name, industry, phone, email, address, timezone, booking link, Google review link, Place ID |
| Opening hours | Per-day open/close/closed — the agent will not book outside them |
| AI Receptionist | Name, greeting, tone, speaking style, languages, what it must collect, after-hours message |
| Services | What can be booked, duration (drives real slot lengths), price, description |
| Approved answers | Your FAQ. The agent answers from these and won't contradict them |
| Booking rules | Slot length, minimum notice, how far ahead, bookings per slot, confirmation email + template |
| Escalation | Who to transfer to, who to email, and what triggers a handoff |
| Google review replies | Tone, sign-off, max length, sync interval, auto-post policy, negative-review alerts |
| Reply playbook | Direction for each star rating, 1★ through 5★ |
| Review request email | Subject and body, with `{{name}}`, `{{business}}`, `{{reviewLink}}` placeholders |
| Advanced | Model choice, free-text instructions that override everything, and a live view of the exact brief the agent receives |

Settings save to `server/data/frontdesk.config.json`. **Reset to defaults**
restores the originals without touching your reviews or appointments.

---

## Connecting Google

Three modes, picked automatically from what's in `server/.env`:

| Mode | Needs | Can do |
|---|---|---|
| `local` | nothing | Log reviews by hand, draft and store replies locally |
| `places` | `GOOGLE_PLACES_API_KEY` + a Place ID in Settings | Read up to 5 reviews. **Cannot post replies** — that's a Google limitation, not ours |
| `business_profile` | the five `GOOGLE_*` vars below | Read all reviews **and publish replies to Google** |

For full read + reply:

1. Create a Google Cloud project and enable the **My Business Account
   Management** and **My Business Business Information** APIs. (Google gates
   these — you request access with the form in their docs, and approval can take
   a few days.)
2. Create OAuth credentials and get a refresh token for the
   `https://www.googleapis.com/auth/business.manage` scope.
3. Put them in `server/.env`:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_ACCOUNT_ID=...      # from accounts.list
GOOGLE_LOCATION_ID=...     # from locations.list
```

The Reviews tab shows which mode you're in at all times.

---

## Connecting email

Appointment confirmations, review requests, and owner alerts go out over Gmail:

```bash
EMAIL_USER=you@gmail.com
EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # Gmail App Password, not your login
EMAIL_FROM_NAME=Your Business
```

Without it, everything still works — the agent just tells you it couldn't send.

---

## Putting the receptionist on your website

One endpoint, one conversation id per visitor:

```js
const res = await fetch("https://your-server/api/receptionist/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    conversationId: sessionId,   // keep this stable for the whole conversation
    message: "Do you have anything Thursday afternoon?",
    channel: "web"               // or "sms", "phone" — shows up in transcripts
  })
});
const { reply } = await res.json();
```

The same endpoint backs a phone bridge (Twilio → speech-to-text → this →
text-to-speech) or an SMS gateway. Every conversation lands in the Transcripts
tab.

---

## What the agent can actually do

Fifteen live tools, not descriptions of tools:

**Reception** — `get_business_info`, `check_availability`, `find_next_available`,
`book_appointment`, `cancel_appointment`, `list_appointments`, `take_message`

**Reviews** — `sync_google_reviews`, `list_reviews`, `draft_review_reply`,
`post_review_reply`, `send_review_request`, `log_review`, `review_stats`,
`alert_owner`

It always checks real availability before offering a time, so it can't promise a
slot that doesn't exist or double-book one.

---

## Guardrails worth knowing

- **Replies need your approval** unless you explicitly turn on auto-posting.
- **Negative reviews escalate.** Anything below your threshold emails you with
  the drafted reply attached, rather than going out silently.
- **The agent won't invent policies.** Prices, hours, and answers come from your
  Settings; when it doesn't know, it takes a message.
- **No review incentives.** Offering anything in exchange for a review violates
  Google's policy, and the agent refuses to do it.
- **One review request per customer** — duplicates are blocked.
- **Never asks for card numbers, SSNs, or passwords.**

---

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/frontdesk/config` | Current settings + defaults |
| PUT | `/api/frontdesk/config` | Partial update — send only what changed |
| POST | `/api/frontdesk/config/reset` | Back to defaults |
| GET | `/api/frontdesk/prompt` | The exact brief the agent receives |
| GET | `/api/frontdesk/status` | Connection state, hours, live counters |
| GET | `/api/frontdesk/reviews` | Reviews, stats, mode, sent requests |
| POST | `/api/frontdesk/reviews/sync` | Pull from Google now |
| POST | `/api/frontdesk/reviews/:id/generate` | AI-draft a reply |
| PUT/DELETE | `/api/frontdesk/reviews/:id/draft` | Save / discard a draft |
| POST | `/api/frontdesk/reviews/:id/post` | Publish a reply |
| GET | `/api/frontdesk/reception` | Appointments, messages, transcripts |
| GET | `/api/frontdesk/availability?date=YYYY-MM-DD` | Open slots |
| POST/PUT/DELETE | `/api/frontdesk/appointments[/:id]` | Book / edit / cancel |
| POST | `/api/receptionist/chat` | Customer-facing conversation |

The agent is also reachable over A2A at `http://localhost:3015` like every other
agent, and the CEO orchestrator routes customer-facing and review work to it.

---

## Where your data lives

```
server/data/frontdesk.config.json      your settings
server/data/frontdesk.reviews.json     reviews, drafts, sent requests
server/data/frontdesk.reception.json   appointments, messages, transcripts
```

Plain JSON, gitignored, written atomically. Back them up by copying them.
