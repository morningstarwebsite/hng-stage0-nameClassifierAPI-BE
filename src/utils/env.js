import { AppError } from "./appError.js";

export function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new AppError(500, `Missing required environment variable: ${name}`);
  }

  return value;
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
