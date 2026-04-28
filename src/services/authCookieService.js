import crypto from "node:crypto";
import {
  getAccessTokenTtlSeconds,
  getRefreshTokenTtlSeconds,
} from "./tokenService.js";
import { isProduction } from "../utils/env.js";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
const CSRF_COOKIE = "csrf_token";
const OAUTH_STATE_COOKIE = "oauth_state";
const PKCE_VERIFIER_COOKIE = "pkce_verifier";

function baseCookieOptions(maxAge) {
  return {
    maxAge,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
  };
}

export function getAccessCookieName() {
  return ACCESS_COOKIE;
}

export function getRefreshCookieName() {
  return REFRESH_COOKIE;
}

export function getCsrfCookieName() {
  return CSRF_COOKIE;
}

export function setOauthCookies(res, state, codeVerifier) {
  res.cookie(OAUTH_STATE_COOKIE, state, {
    ...baseCookieOptions(10 * 60 * 1000),
    httpOnly: true,
  });
  res.cookie(PKCE_VERIFIER_COOKIE, codeVerifier, {
    ...baseCookieOptions(10 * 60 * 1000),
    httpOnly: true,
  });
}

export function readOauthCookies(req) {
  return {
    state: req.cookies?.[OAUTH_STATE_COOKIE],
    codeVerifier: req.cookies?.[PKCE_VERIFIER_COOKIE],
  };
}

export function clearOauthCookies(res) {
  res.clearCookie(OAUTH_STATE_COOKIE, baseCookieOptions(10 * 60 * 1000));
  res.clearCookie(PKCE_VERIFIER_COOKIE, baseCookieOptions(10 * 60 * 1000));
}

export function issueCsrfToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function setSessionCookies(res, session) {
  res.cookie(ACCESS_COOKIE, session.accessToken, {
    ...baseCookieOptions(getAccessTokenTtlSeconds() * 1000),
    httpOnly: true,
  });
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...baseCookieOptions(getRefreshTokenTtlSeconds() * 1000),
    httpOnly: true,
  });
  res.cookie(CSRF_COOKIE, session.csrfToken, {
    ...baseCookieOptions(getRefreshTokenTtlSeconds() * 1000),
    httpOnly: false,
  });
}

export function clearSessionCookies(res) {
  const options = baseCookieOptions(getRefreshTokenTtlSeconds() * 1000);
  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, options);
  res.clearCookie(CSRF_COOKIE, options);
}
