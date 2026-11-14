export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    req.body = result.data;

    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Query validation failed",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    req.validatedQuery = result.data;
    next();
  };
}

export function validateParams(schema, paramName) {
  return (req, res, next) => {
    const value = paramName ? req.params[paramName] : req.params;

    const result = schema.safeParse(value);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Parameter validation failed",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join(".") || paramName || "params",
          message: issue.message,
        })),
      });
    }

    next();
  };
}
