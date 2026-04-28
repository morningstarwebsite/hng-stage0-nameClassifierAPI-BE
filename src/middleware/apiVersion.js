import { AppError } from "../utils/appError.js";

export function requireApiVersion(req, _res, next) {
  const version = req.get("X-API-Version");

  if (!version) {
    return next(new AppError(400, "API version header required"));
  }

  if (version !== "1") {
    return next(new AppError(400, "Unsupported API version"));
  }

  next();
}
