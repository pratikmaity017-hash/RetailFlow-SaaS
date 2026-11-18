import mongoose from "mongoose";

import Sale from "../models/sale.model.js";
import Return from "../models/return.model.js";
import Refund from "../models/refund.model.js";
import { createAuditLog } from "./audit-log.service.js";

function createServiceError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export async function processRefund({
  organizationId,
  returnId,
  userId,
  refundData,
}) {
  if (
    !mongoose.isValidObjectId(organizationId) ||
    !mongoose.isValidObjectId(returnId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw createServiceError(
      400,
      "INVALID_REFUND_REFERENCE",
      "Invalid organization, return, or user ID",
    );
  }

  const allowedMethods = ["cash", "upi", "card", "bank_transfer", "other"];

  if (!allowedMethods.includes(refundData.method)) {
    throw createServiceError(
      400,
      "INVALID_REFUND_METHOD",
      "Invalid refund method",
    );
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // 1. Find an approved return awaiting refund.
      const returnRecord = await Return.findOne({
        _id: returnId,
        organization: organizationId,
        status: "approved",
        refundStatus: "pending",
        totalRefundPaise: { $gt: 0 },
      }).session(session);

      if (!returnRecord) {
        throw createServiceError(
          409,
          "RETURN_NOT_REFUNDABLE",
          "Return is not eligible for refund processing",
        );
      }

      // 2. Acquire the Sale-level lock.
      // This serializes refund processing for returns belonging to
      // the same sale.
      const sale = await Sale.findOneAndUpdate(
        {
          _id: returnRecord.sale,
          organization: organizationId,
          status: "completed",
        },
        {
          $inc: {
            returnRevision: 1,
          },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!sale) {
        throw createServiceError(
          409,
          "SALE_NOT_REFUNDABLE",
          "The associated sale is not eligible for refund processing",
        );
      }

      // 3. Validate the amount actually received.
      if (
        !Number.isSafeInteger(sale.amountPaidPaise) ||
        sale.amountPaidPaise <= 0
      ) {
        throw createServiceError(
          409,
          "NO_PAYMENT_RECEIVED",
          "No payment has been received for this sale",
        );
      }

      // 4. Calculate all previously processed refunds for this sale.
      const previousRefunds = await Refund.find({
        organization: organizationId,
        sale: sale._id,
        status: "processed",
      })
        .select("amountPaise")
        .session(session)
        .lean();

      const totalPreviouslyRefundedPaise = previousRefunds.reduce(
        (total, refund) => total + refund.amountPaise,
        0,
      );

      if (!Number.isSafeInteger(totalPreviouslyRefundedPaise)) {
        throw createServiceError(
          409,
          "INVALID_REFUND_TOTAL",
          "The existing refund total is invalid",
        );
      }

      // 5. Ensure cumulative refunds never exceed received payments.
      const cumulativeRefundPaise =
        totalPreviouslyRefundedPaise + returnRecord.totalRefundPaise;

      if (
        !Number.isSafeInteger(cumulativeRefundPaise) ||
        cumulativeRefundPaise > sale.amountPaidPaise
      ) {
        throw createServiceError(
          409,
          "REFUND_EXCEEDS_AMOUNT_PAID",
          "The refund amount exceeds the total payment received for this sale",
        );
      }

      // 6. Atomically complete the return and mark its refund processed.
      const updatedReturn = await Return.findOneAndUpdate(
        {
          _id: returnRecord._id,
          organization: organizationId,
          status: "approved",
          refundStatus: "pending",
        },
        {
          $set: {
            status: "completed",
            refundStatus: "processed",
          },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!updatedReturn) {
        throw createServiceError(
          409,
          "RETURN_NOT_REFUNDABLE",
          "Return is no longer eligible for refund processing",
        );
      }

      // 7. Create the refund record in the same transaction.
      const [refund] = await Refund.create(
        [
          {
            organization: organizationId,
            return: updatedReturn._id,
            sale: sale._id,
            amountPaise: updatedReturn.totalRefundPaise,
            method: refundData.method,
            status: "processed",
            reference: refundData.reference || null,
            notes: refundData.notes || null,
            processedBy: userId,
            processedAt: new Date(),
          },
        ],
        { session },
      );

      await createAuditLog({
        organizationId,
        actorId: userId,
        action: "refund.processed",
        resourceType: "refund",
        resourceId: refund._id,
        description: "Customer refund recorded successfully",
        metadata: {
          returnId: String(updatedReturn._id),
          saleId: String(sale._id),
          amountPaise: refund.amountPaise,
          method: refund.method,
          status: refund.status,
        },
        session,
      });

      result = {
        refund,
        return: updatedReturn,
      };
    });

    return result;
  } catch (error) {
    if (error.code === 11000) {
      throw createServiceError(
        409,
        "REFUND_ALREADY_EXISTS",
        "A refund has already been recorded for this return",
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
}
