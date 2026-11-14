import app from "./src/app.js";
import { env } from "./src/config/env.js";
import connectDB from "./src/config/database.js";
import mongoose from "mongoose";

let server;
let isShuttingDown = false;

async function startServer() {
  try {
    await connectDB();

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
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

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
