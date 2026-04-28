import {
  getAccessCookieName,
  getCsrfCookieName,
  getRefreshCookieName,
} from "../services/authCookieService.js";
import { AppError } from "../utils/appError.js";

const protectedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireCsrfForSession(req, _res, next) {
  if (!protectedMethods.has(req.method)) {
    return next();
  }

  const hasSessionCookie = Boolean(
    req.cookies?.[getAccessCookieName()] || req.cookies?.[getRefreshCookieName()],
  );

  if (!hasSessionCookie) {
    return next();
  }

  const headerToken = req.get("X-CSRF-Token");
  const cookieToken = req.cookies?.[getCsrfCookieName()];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return next(new AppError(403, "Invalid CSRF token"));
  }

  next();
}
