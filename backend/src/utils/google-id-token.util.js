import { OAuth2Client } from "google-auth-library";

import { env } from "../config/env.js";
import { createServiceError } from "./service-error.util.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export async function verifyGoogleIdToken(idToken) {
  if (typeof idToken !== "string" || !idToken.trim()) {
    throw createServiceError(
      401,
      "INVALID_GOOGLE_TOKEN",
      "Google sign-in could not be verified.",
    );
  }

  let payload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    payload = ticket.getPayload();
  } catch {
    throw createServiceError(
      401,
      "INVALID_GOOGLE_TOKEN",
      "Google sign-in could not be verified.",
    );
  }

  const validIssuers = ["accounts.google.com", "https://accounts.google.com"];

  if (
    !payload ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    !validIssuers.includes(payload.iss) ||
    typeof payload.email !== "string" ||
    !payload.email.trim() ||
    payload.email_verified !== true
  ) {
    throw createServiceError(
      401,
      "INVALID_GOOGLE_TOKEN",
      "Google sign-in could not be verified.",
    );
  }

  return {
    providerSubject: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name:
      typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim()
        : payload.email.split("@")[0],
  };
}
