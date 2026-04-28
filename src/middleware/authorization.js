import { AppError } from "../utils/appError.js";
import { userHasAnyRole } from "../services/authorizationService.js";

export function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) {
      return next(new AppError(401, "Authentication required"));
    }

    if (!userHasAnyRole(req.user, roles)) {
      return next(new AppError(403, "Insufficient permissions"));
    }

    next();
  };
}
