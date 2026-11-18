import {
  createReturn,
  approveReturn,
  rejectReturn,
} from "../services/return.service.js";

export async function createReturnController(req, res, next) {
  try {
    const result = await createReturn({
      organizationId: req.organization.id,
      userId: req.auth.userId,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Return created successfully",
      data: {
        return: result,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function approveReturnController(req, res, next) {
  try {
    const result = await approveReturn({
      organizationId: req.organization.id,
      returnId: req.params.returnId,
      userId: req.auth.userId,
      notes: req.body.notes,
    });

    return res.status(200).json({
      success: true,
      message: "Return approved successfully",
      data: {
        return: result,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectReturnController(req, res, next) {
  try {
    const result = await rejectReturn({
      organizationId: req.organization.id,
      returnId: req.params.returnId,
      userId: req.auth.userId,
      notes: req.body.notes,
    });

    return res.status(200).json({
      success: true,
      message: "Return rejected successfully",
      data: {
        return: result,
      },
    });
  } catch (error) {
    next(error);
  }
}
