import app from "./src/app.js";
import { env } from "./src/config/env.js";
import connectDB from "./src/config/database.js";
import mongoose from "mongoose";
import { startWebhookRecoveryWorker } from "./src/workers/webhook-recovery.worker.js";

let server;
let isShuttingDown = false;
let stopWebhookRecoveryWorker;

async function startServer() {
  try {
    await connectDB();

    stopWebhookRecoveryWorker = startWebhookRecoveryWorker();

    const PORT = Number(process.env.PORT) || env.PORT || 3000;

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server startup failed:", err.message);
    process.exit(1);
  }
}

const shutdown = async (signal) => {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log(`${signal} received. Starting graceful shutdown...`);

  try {
    // 1. Stop webhook recovery worker.
    if (stopWebhookRecoveryWorker) {
      await stopWebhookRecoveryWorker();
      stopWebhookRecoveryWorker = null;
    }

    // 2. Close HTTP server and wait for active connections.
    if (server) {
      await new Promise((resolve, reject) => {
        const forceCloseTimer = setTimeout(() => {
          console.warn(
            "Graceful shutdown timeout reached. Force-closing HTTP connections.",
          );

          server.closeAllConnections?.();
        }, 10_000);

        server.close((error) => {
          clearTimeout(forceCloseTimer);

          if (error) {
            reject(error);
            return;
          }

          resolve();
        });

        // Close idle keep-alive connections.
        server.closeIdleConnections?.();
      });
    }

    console.log("HTTP server closed.");

    console.log("Disconnecting MongoDB...");

    // 3. Disconnect MongoDB.
    await mongoose.disconnect();

    console.log("MongoDB disconnected.");
    console.log("Server shutdown complete.");

    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error.message);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
