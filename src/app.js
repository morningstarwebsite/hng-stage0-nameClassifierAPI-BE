import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./routes/authRoutes.js";
import profileRouter from "./routes/profileRoutes.js";
import { requireApiVersion } from "./middleware/apiVersion.js";
import { authenticateRequest } from "./middleware/authentication.js";
import { requireCsrfForSession } from "./middleware/csrfProtection.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";
import { requestLogger } from "./middleware/requestLogger.js";

const app = express();
const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyGenerator: (req) => `${req.ip}:${req.path}`,
});
const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (req) => req.user?.id || req.ip,
});

app.set("trust proxy", 1);
app.use(requestLogger);
app.use(cors({ origin: "*" }));
app.use(cookieParser());
app.use(express.json());

app.use("/auth", authRateLimiter, requireCsrfForSession, authRouter);
app.use("/api", requireApiVersion, authenticateRequest, apiRateLimiter, requireCsrfForSession, profileRouter);

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Insighta Labs+ Stage 3 profile intelligence API is running" });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;