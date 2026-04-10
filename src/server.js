// Entry point: imports the configured Express app and starts the HTTP server.

import app from "./app.js";

const PORT = process.env.PORT || 3200;

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
  console.log(`[server] Health check → http://localhost:${PORT}/`);
  console.log(`[server] Classify     → http://localhost:${PORT}/api/classify?name=James`);
}); 