import { env } from "../config/env.js";

const errorMiddleware = (err, req, res, next) => {
  const statusCode =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
      ? err.statusCode
      : 500;

  // Log unexpected errors during development.
  if (env.NODE_ENV === "development" && statusCode === 500) {
    console.error("\n========== UNEXPECTED SERVER ERROR ==========");
    console.error("Method:", req.method);
    console.error("URL:", req.originalUrl);
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
    console.error("Stack:", err.stack);
    console.error("=============================================\n");
  }

  const isClientError = statusCode >= 400 && statusCode < 500;

  return res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message: isClientError ? err.message : "An unexpected error occurred.",
    },
  });
};

export default errorMiddleware;
