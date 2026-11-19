import { getInternalProfitReportingData } from "../services/internal-profit-reporting.service.js";

export async function getInternalProfitReportingController(req, res, next) {
  try {
    const report = await getInternalProfitReportingData({
      organizationId: req.params.organizationId,
      from: req.validatedQuery.from,
      to: req.validatedQuery.to,
    });

    return res.status(200).json({
      success: true,
      message: "Profit reporting data retrieved successfully",
      data: report,
    });
  } catch (error) {
    return next(error);
  }
}
