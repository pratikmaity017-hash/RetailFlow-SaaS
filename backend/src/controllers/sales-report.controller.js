import { getSalesReport } from "../services/sales-report.service.js";

export async function getSalesReportController(req, res, next) {
  try {
    const report = await getSalesReport({
      organizationId: req.organization.id,
      from: req.validatedQuery.from,
      to: req.validatedQuery.to,
      groupBy: req.validatedQuery.groupBy,
    });

    return res.status(200).json({
      success: true,
      message: "Sales report retrieved successfully",
      data: report,
    });
  } catch (error) {
    return next(error);
  }
}
