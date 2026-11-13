import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

export function generateOrganizationInvitationToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashOrganizationInvitationToken(token) {
  if (typeof token !== "string" || token.length !== 43) {
    throw new Error("Invalid organization invitation token.");
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}
