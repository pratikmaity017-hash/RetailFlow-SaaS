import dotenv from "dotenv";

dotenv.config();

const allowedEnvironments = ["development", "test", "production"];

const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT || 3000);
const MONGODB_URI = process.env.MONGODB_URI?.trim();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS);

if (!allowedEnvironments.includes(NODE_ENV)) {
  throw new Error(
    `Invalid NODE_ENV: ${NODE_ENV}. Must be development, test, or production.`,
  );
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required. Check your .env file.");
}

if (!JWT_SECRET || JWT_SECRET.length < 48) {
  throw new Error("JWT_SECRET must contain at least 64 characters.");
}

if (!JWT_EXPIRES_IN) {
  throw new Error("JWT_EXPIRES_IN is required. Check your .env file.");
}
if (!Number.isInteger(REFRESH_TOKEN_TTL_DAYS) || REFRESH_TOKEN_TTL_DAYS <= 0) {
  throw new Error("REFRESH_TOKEN_TTL_DAYS must be a positive integer.");
}

export const env = Object.freeze({
  NODE_ENV,
  PORT,
  MONGODB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  REFRESH_TOKEN_TTL_DAYS,
});
