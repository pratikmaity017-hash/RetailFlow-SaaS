import app from "./src/app.js";
import { env } from "./src/config/env.js";
import connectDB from "./src/config/database.js";
import mongoose from "mongoose";

async function startServer() {
  try {
    await connectDB();

    app.listen(env.PORT, () => {
      console.log(`sever is running on port ${env.PORT}`);
    });
  } catch (err) {
    console.error("Server startup failed:", err.message);
    process.exit(1);
  }
}

startServer();

let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log(`${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    try {
      await mongoose.disconnect();

      console.log("MongoDB disconnected.");
      console.log("Server shutdown complete.");

      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error.message);
      process.exit(1);
    }
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
