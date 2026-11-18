import { listAuditLogs } from "../services/audit-log-query.service.js";

export async function listAuditLogsController(req, res, next) {
  try {
    const result = await listAuditLogs({
      organizationId: req.organization.id,
      query: req.validatedQuery,
    });

    return res.status(200).json({
      success: true,
      message: "Audit logs retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
