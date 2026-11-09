import mongoose from "mongoose";
import { Router } from "express";

const router = Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "RetailFlow API is running",
    timestamp: new Date().toISOString(),
  });
});

router.get("/ready", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  if (!databaseConnected) {
    return res.status(503).json({
      success: false,
      status: "not_ready",
      message: "Database connection is not available",
    });
  }

  return res.status(200).json({
    success: true,
    status: "ready",
    message: "RetailFlow API is ready",
  });
});
export default router;
