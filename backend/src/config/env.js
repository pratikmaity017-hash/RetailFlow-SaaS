import dotenv from "dotenv";

dotenv.config();

const allowedEnvironments = ["development", "test", "production"];

const NODE_ENV = process.env.NODE_ENV || "development";
const DEV_BYPASS_FEATURE_ENTITLEMENTS_RAW =
  process.env.DEV_BYPASS_FEATURE_ENTITLEMENTS || "false";

if (
  !["true", "false"].includes(DEV_BYPASS_FEATURE_ENTITLEMENTS_RAW.toLowerCase())
) {
  throw new Error(
    "DEV_BYPASS_FEATURE_ENTITLEMENTS must be either true or false.",
  );
}

const DEV_BYPASS_FEATURE_ENTITLEMENTS =
  DEV_BYPASS_FEATURE_ENTITLEMENTS_RAW.toLowerCase() === "true";

if (DEV_BYPASS_FEATURE_ENTITLEMENTS && NODE_ENV !== "development") {
  throw new Error(
    "DEV_BYPASS_FEATURE_ENTITLEMENTS can only be enabled in development.",
  );
}
const PORT = Number(process.env.PORT || 3000);
const MONGODB_URI = process.env.MONGODB_URI?.trim();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS);
const FRONTEND_URL = (
  process.env.FRONTEND_URL || "http://localhost:5173"
).trim();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();

// Optional email configuration.
const EMAIL_HOST = process.env.EMAIL_HOST?.trim() || "";
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 465);
const EMAIL_SECURE_RAW = process.env.EMAIL_SECURE;
const EMAIL_USER = process.env.EMAIL_USER?.trim() || "";
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD?.trim() || "";
const EMAIL_FROM = process.env.EMAIL_FROM?.trim() || "";

// Razorpay configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID?.trim() || "";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET?.trim() || "";

const RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";

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
  throw new Error("JWT_SECRET must contain at least 48 characters.");
}

const JWT_EXPIRES_IN_PATTERN = /^[1-9]\d*(s|m|h|d)$/;

if (!JWT_EXPIRES_IN || !JWT_EXPIRES_IN_PATTERN.test(JWT_EXPIRES_IN)) {
  throw new Error(
    "JWT_EXPIRES_IN must be a positive integer followed by s, m, h, or d (e.g. 15m).",
  );
}

if (!Number.isInteger(REFRESH_TOKEN_TTL_DAYS) || REFRESH_TOKEN_TTL_DAYS <= 0) {
  throw new Error("REFRESH_TOKEN_TTL_DAYS must be a positive integer.");
}

if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID is required. Check your .env file.");
}

if (
  EMAIL_SECURE_RAW !== undefined &&
  !["true", "false"].includes(EMAIL_SECURE_RAW.toLowerCase())
) {
  throw new Error("EMAIL_SECURE must be either true or false.");
}

const emailSettingsProvided = [
  EMAIL_HOST,
  EMAIL_USER,
  EMAIL_APP_PASSWORD,
  EMAIL_FROM,
].some(Boolean);

if (emailSettingsProvided) {
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_APP_PASSWORD || !EMAIL_FROM) {
    throw new Error(
      "EMAIL_HOST, EMAIL_USER, EMAIL_APP_PASSWORD and EMAIL_FROM must all be configured.",
    );
  }

  if (!Number.isInteger(EMAIL_PORT) || EMAIL_PORT < 1 || EMAIL_PORT > 65535) {
    throw new Error("EMAIL_PORT must be a valid port number.");
  }
}

const EMAIL_SECURE =
  EMAIL_SECURE_RAW === undefined
    ? true
    : EMAIL_SECURE_RAW.toLowerCase() === "true";

const razorpaySettingsProvided = [
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
].some(Boolean);

if (
  NODE_ENV === "production" &&
  razorpaySettingsProvided &&
  (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !RAZORPAY_WEBHOOK_SECRET)
) {
  throw new Error(
    "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET must all be configured in production.",
  );
}

export const env = Object.freeze({
  NODE_ENV,
  DEV_BYPASS_FEATURE_ENTITLEMENTS,
  PORT,
  MONGODB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  REFRESH_TOKEN_TTL_DAYS,
  FRONTEND_URL,
  GOOGLE_CLIENT_ID,

  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_SECURE,
  EMAIL_USER,
  EMAIL_APP_PASSWORD,
  EMAIL_FROM,
  EMAIL_CONFIGURED: emailSettingsProvided,

  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
});
