const errorMiddleware = (err, req, res, next) => {
  const statusCode =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
      ? err.statusCode
      : 500;

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
