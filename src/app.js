// Creates and configures the Express application.
// No listen() call here — that lives in server.js.

import express from "express";
import cors from "cors";
import classifyRouter from "./routes/classifyRoutes.js";

const app = express();

//  Middleware 

// CORS: allow all origins as required by the assessment spec
app.use(cors({ origin: "*" }));

// Parse incoming JSON bodies (not strictly needed for GET-only, but good practice)
app.use(express.json());

// Routes 

app.use("/api", classifyRouter);

// Health check (useful for Railway / deployment verification) 

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "HNG Stage 0 API is running" });
});

// 404 handler 

app.use((_req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

// Global error handler
// Express calls this when next(err) is invoked anywhere in the app.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[global error handler]", err);
  res.status(500).json({ status: "error", message: "Internal server error" });
});

export default app;