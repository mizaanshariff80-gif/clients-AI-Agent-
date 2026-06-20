/**
 * Email client using nodemailer.
 * Requires in server/.env:
 *   EMAIL_USER=your@gmail.com
 *   EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (Gmail App Password)
 *   EMAIL_FROM_NAME=Your Name / Agency Name
 */

import nodemailer from "nodemailer";

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  _transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });
  return _transporter;
}

/**
 * Send an outreach email.
 * Returns { success, messageId, error? }
 */
export async function sendEmail({ to, subject, body, fromName }) {
  const t = getTransporter();
  if (!t) {
    return {
      success: false,
      error: "Email not configured. Add EMAIL_USER and EMAIL_APP_PASSWORD to server/.env"
    };
  }

  const from = `"${fromName || process.env.EMAIL_FROM_NAME || "Nexora AI"}" <${process.env.EMAIL_USER}>`;

  try {
    const info = await t.sendMail({ from, to, subject, text: body, html: body.replace(/\n/g, "<br>") });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function isEmailConfigured() {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);
}
