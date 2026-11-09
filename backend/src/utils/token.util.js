import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";

// Generate a short-lived JWT access token.
export function generateAccessToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// Verify an access token.
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
}

// Generate a cryptographically secure refresh token.
export function generateRefreshToken() {
  return crypto.randomBytes(64).toString("base64url");
}

// Hash refresh tokens before storing them in MongoDB.
export function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
