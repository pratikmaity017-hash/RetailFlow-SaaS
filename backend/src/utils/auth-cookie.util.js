import { env } from "../config/env.js";

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
};

export function setRefreshTokenCookie(res, refreshToken) {
  res.cookie("refreshToken", refreshToken, {
    ...refreshCookieOptions,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie("refreshToken", refreshCookieOptions);
}

export function isWebClient(req) {
  return req.get("X-Client-Type") === "web";
}
