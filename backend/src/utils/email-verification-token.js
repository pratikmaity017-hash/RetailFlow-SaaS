import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

export function generateEmailVerificationToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashEmailVerificationToken(token) {
  if (typeof token !== "string" || token.length !== 43) {
    throw new Error("Invalid email verification token.");
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}
