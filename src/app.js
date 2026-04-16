import express from "express";
import cors from "cors";
import profileRouter from "./routes/profileRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api", profileRouter);

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "HNG Stage 1 profile intelligence API is running" });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;