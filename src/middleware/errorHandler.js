import { AppError } from "../utils/appError.js";

export function notFoundHandler(_req, _res, next) {
  next(new AppError(404, "Route not found"));
}

export function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? "Internal server error" : err.message;

  if (statusCode >= 500) {
    console.error("[errorHandler]", err);
  }

  res.status(statusCode).json({
    status: "error",
    message,
  });
}