import { AppError } from "../utils/appError.js";

export function createRateLimiter({ windowMs, maxRequests, keyGenerator, message = "Rate limit exceeded" }) {
  const buckets = new Map();

  return function rateLimiter(req, _res, next) {
    const key = keyGenerator(req);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (bucket.count >= maxRequests) {
      return next(new AppError(429, message));
    }

    bucket.count += 1;
    next();
  };
}
