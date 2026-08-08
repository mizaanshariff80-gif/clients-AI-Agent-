export interface DayHours { open: string; close: string; closed: boolean }

export interface Service {
  id: string;
  name: string;
  duration: number;
  price: string;
  description: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export interface FrontDeskConfig {
  model: string;
  business: {
    name: string;
    industry: string;
    tagline: string;
    phone: string;
    email: string;
    website: string;
    address: string;
    timezone: string;
    bookingLink: string;
    reviewLink: string;
    placeId: string;
    hours: Record<string, DayHours>;
  };
  receptionist: {
    enabled: boolean;
    agentName: string;
    greeting: string;
    tone: string;
    style: string;
    languages: string[];
    collectFields: string[];
    services: Service[];
    faqs: Faq[];
    afterHoursMessage: string;
    escalation: { transferTo: string; notifyEmail: string; triggers: string[] };
    appointment: {
      slotMinutes: number;
      leadTimeHours: number;
      maxDaysAhead: number;
      maxPerSlot: number;
      sendConfirmationEmail: boolean;
      confirmationSubject: string;
      confirmationBody: string;
    };
    customInstructions: string;
  };
  reviews: {
    enabled: boolean;
    autoReply: boolean;
    autoReplyMinRating: number;
    replyTone: string;
    signature: string;
    maxLength: number;
    templates: Record<string, string>;
    negativeAlertEmail: string;
    negativeAlertBelow: number;
    requestSubject: string;
    requestBody: string;
    syncIntervalMinutes: number;
    customInstructions: string;
  };
}

export interface Review {
  id: string;
  source: string;
  author: string;
  authorPhoto: string | null;
  rating: number;
  text: string;
  createdAt: string;
  reply: string | null;
  draftReply: string | null;
  replyStatus: "none" | "draft" | "posted" | "approved_local";
  replyPostedAt?: string | null;
  lastError?: string;
}

export interface ReviewStats {
  total: number;
  average: number;
  distribution: Record<string, number>;
  unanswered: number;
  draftsPending: number;
  posted: number;
  negative: number;
  requestsSent: number;
  lastSync: string | null;
}

export interface ReviewMode {
  mode: "business_profile" | "places" | "local";
  canRead: boolean;
  canReply: boolean;
  detail: string;
}

export interface Appointment {
  id: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  date: string;
  time: string;
  when: string;
  durationMinutes?: number;
  notes: string;
  status: string;
  source: string;
  startsAt: string;
  createdAt: string;
  confirmationEmail?: { sent: boolean; error: string | null } | null;
}

export interface ReceptionMessage {
  id: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  urgency: "low" | "normal" | "high";
  status: "open" | "handled";
  createdAt: string;
}

export interface Conversation {
  id: string;
  channel: string;
  startedAt: string;
  lastAt?: string;
  turns: { role: string; content: string; at: string }[];
}

export interface ReceptionStats {
  appointmentsTotal: number;
  appointmentsToday: number;
  appointmentsUpcoming: number;
  cancelled: number;
  messagesOpen: number;
  messagesUrgent: number;
  conversations: number;
}

export interface FrontDeskStatus {
  businessName: string;
  receptionistEnabled: boolean;
  reviewsEnabled: boolean;
  autoReply: boolean;
  hasReviewLink: boolean;
  hasPlaceId: boolean;
  google: ReviewMode;
  emailConfigured: boolean;
  emailUser: string | null;
  openNow: { open: boolean; reason: string };
  today: string;
  reception: ReceptionStats;
  reviews: ReviewStats;
}

export const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" }
];
