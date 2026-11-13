import nodemailer from "nodemailer";

import { env } from "../config/env.js";

let transporter;

function getTransporter() {
  if (!env.EMAIL_CONFIGURED) {
    throw new Error("Email service is not configured.");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_SECURE,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_APP_PASSWORD,
      },
    });
  }

  return transporter;
}

export async function sendEmail({ to, subject, text, html }) {
  if (!to || !subject || (!text && !html)) {
    throw new Error("Recipient, subject, and email content are required.");
  }

  const mailer = getTransporter();

  const result = await mailer.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
  };
}

export async function verifyEmailConnection() {
  const mailer = getTransporter();

  await mailer.verify();

  return true;
}
