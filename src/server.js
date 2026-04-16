import app from "./app.js";
import { connectDatabase } from "./config/database.js";

const PORT = process.env.PORT || 3200;

async function startServer() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT}`);
    console.log(`[server] Health check  -> http://localhost:${PORT}/`);
    console.log(`[server] Create profile -> POST http://localhost:${PORT}/api/profiles`);
  });
}

startServer().catch((err) => {
  console.error("[server] Failed to start application", err);
  process.exit(1);
});