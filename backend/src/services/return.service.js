import mongoose from "mongoose";
import { randomBytes } from "node:crypto";

import Sale from "../models/sale.model.js";
import SaleItem from "../models/sale-item.model.js";
import Return from "../models/return.model.js";
import ReturnItem from "../models/return-item.model.js";
import Inventory from "../models/inventory.model.js";
import StockMovement from "../models/stock-movement.model.js";
import { createAuditLog } from "./audit-log.service.js";

const ACTIVE_RETURN_STATUSES = ["pending", "approved", "completed"];

function createServiceError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function generateReturnNumber() {
  return `RET-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function calculateRefundAmount(
  saleItem,
  previousQuantity,
  previousRefund,
  quantity,
) {
  const cumulativeQuantity = previousQuantity + quantity;

  const cumulativeRefund =
    cumulativeQuantity >= saleItem.quantity
      ? saleItem.lineTotalPaise
      : Math.round(
          (saleItem.lineTotalPaise * cumulativeQuantity) / saleItem.quantity,
        );

  return {
    amount: cumulativeRefund - previousRefund,
    cumulativeQuantity,
  };
}

export async function createReturn({
  organizationId,
  saleId,
  reason,
  notes = "",
  items,
  userId,
}) {
  const session = await mongoose.startSession();
  let createdReturn;

  try {
    await session.withTransaction(async () => {
      // Incrementing this counter serializes return creation for the same sale.
      const sale = await Sale.findOneAndUpdate(
        {
          _id: saleId,
          organization: organizationId,
          status: "completed",
        },
        { $inc: { returnRevision: 1 } },
        { returnDocument: "after", session },
      );

      if (!sale) {
        throw createServiceError(
          404,
          "SALE_NOT_FOUND",
          "Completed sale not found",
        );
      }

      const requestedSaleItemIds = items.map((item) => item.saleItemId);

      const saleItems = await SaleItem.find({
        _id: { $in: requestedSaleItemIds },
        organization: organizationId,
        sale: sale._id,
      }).session(session);

      if (saleItems.length !== items.length) {
        throw createServiceError(
          400,
          "INVALID_RETURN_ITEMS",
          "One or more sale items do not belong to this sale",
        );
      }

      const activeReturns = await Return.find({
        organization: organizationId,
        sale: sale._id,
        status: { $in: ACTIVE_RETURN_STATUSES },
      })
        .select("_id totalRefundPaise")
        .session(session);

      const activeReturnIds = activeReturns.map((item) => item._id);

      const previousTotalRefundPaise = activeReturns.reduce(
        (total, item) => total + item.totalRefundPaise,
        0,
      );

      if (!Number.isSafeInteger(previousTotalRefundPaise)) {
        throw createServiceError(
          409,
          "INVALID_REFUND_TOTAL",
          "The existing return refund total is invalid",
        );
      }

      const previousReturnItems = activeReturnIds.length
        ? await ReturnItem.find({
            organization: organizationId,
            return: { $in: activeReturnIds },
          }).session(session)
        : [];

      const previousBySaleItem = new Map();

      for (const item of previousReturnItems) {
        const key = item.saleItem.toString();
        const current = previousBySaleItem.get(key) ?? {
          quantity: 0,
          refundPaise: 0,
        };

        current.quantity += item.quantity;
        current.refundPaise += item.refundAmountPaise;

        previousBySaleItem.set(key, current);
      }

      const saleItemById = new Map(
        saleItems.map((item) => [item._id.toString(), item]),
      );

      let totalQuantity = 0;
      let totalRefundPaise = 0;

      const returnItems = [];

      for (const requestedItem of items) {
        const saleItem = saleItemById.get(requestedItem.saleItemId);
        const previous = previousBySaleItem.get(requestedItem.saleItemId) ?? {
          quantity: 0,
          refundPaise: 0,
        };

        const remainingQuantity = saleItem.quantity - previous.quantity;

        if (requestedItem.quantity > remainingQuantity + 1e-7) {
          throw createServiceError(
            409,
            "RETURN_QUANTITY_EXCEEDED",
            `Return quantity exceeds the remaining quantity for SKU ${saleItem.sku}`,
          );
        }

        const { amount, cumulativeQuantity } = calculateRefundAmount(
          saleItem,
          previous.quantity,
          previous.refundPaise,
          requestedItem.quantity,
        );

        if (
          !Number.isSafeInteger(amount) ||
          amount < 0 ||
          !Number.isSafeInteger(totalRefundPaise + amount)
        ) {
          throw createServiceError(
            400,
            "INVALID_REFUND_AMOUNT",
            "Calculated refund amount is invalid",
          );
        }

        totalQuantity += requestedItem.quantity;
        totalRefundPaise += amount;

        returnItems.push({
          organization: organizationId,
          saleItem: saleItem._id,
          product: saleItem.product,
          variant: saleItem.variant,
          productName: saleItem.productName,
          sku: saleItem.sku,
          quantity: requestedItem.quantity,
          unitPricePaise: saleItem.unitPricePaise,
          refundAmountPaise: amount,
          restock: requestedItem.restock ?? true,
        });
      }

      if (!Number.isFinite(totalQuantity) || totalQuantity <= 0) {
        throw createServiceError(
          400,
          "INVALID_RETURN_QUANTITY",
          "Total return quantity is invalid",
        );
      }

      if (totalRefundPaise > 0 && sale.amountPaidPaise <= 0) {
        throw createServiceError(
          409,
          "SALE_NOT_PAID",
          "A refund cannot be created before payment is received",
        );
      }

      const cumulativeRefundPaise = previousTotalRefundPaise + totalRefundPaise;

      if (
        !Number.isSafeInteger(cumulativeRefundPaise) ||
        cumulativeRefundPaise > sale.amountPaidPaise
      ) {
        throw createServiceError(
          409,
          "REFUND_EXCEEDS_AMOUNT_PAID",
          "Total return refunds cannot exceed the payment received for this sale",
        );
      }

      [createdReturn] = await Return.create(
        [
          {
            organization: organizationId,
            sale: sale._id,
            returnNumber: generateReturnNumber(),
            status: "pending",
            reason,
            totalQuantity,
            totalRefundPaise,
            refundStatus: totalRefundPaise > 0 ? "pending" : "not_required",
            notes,
            createdBy: userId,
          },
        ],
        { session },
      );

      await ReturnItem.create(
        returnItems.map((item) => ({
          ...item,
          return: createdReturn._id,
        })),
        { session },
      );

      await createAuditLog({
        organizationId,
        actorId: userId,
        action: "return.created",
        resourceType: "return",
        resourceId: createdReturn._id,
        description: "Return request created successfully",
        metadata: {
          returnNumber: createdReturn.returnNumber,
          saleId: String(sale._id),
          totalQuantity,
          totalRefundPaise,
          itemCount: returnItems.length,
          reason,
        },
        session,
      });
    });

    return createdReturn;
  } catch (error) {
    if (error.code === 11000) {
      throw createServiceError(
        409,
        "RETURN_NUMBER_CONFLICT",
        "Could not generate a unique return number. Please retry.",
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

export async function approveReturn({
  organizationId,
  returnId,
  userId,
  notes,
}) {
  const session = await mongoose.startSession();
  let approvedReturn;

  try {
    await session.withTransaction(async () => {
      const returnRecord = await Return.findOneAndUpdate(
        {
          _id: returnId,
          organization: organizationId,
          status: "pending",
        },
        {
          $set: {
            status: "approved",
            processedBy: userId,
            processedAt: new Date(),
            ...(notes !== undefined ? { notes } : {}),
          },
        },
        { returnDocument: "after", session },
      );

      if (!returnRecord) {
        throw createServiceError(
          404,
          "PENDING_RETURN_NOT_FOUND",
          "Pending return not found",
        );
      }

      const returnItems = await ReturnItem.find({
        organization: organizationId,
        return: returnRecord._id,
      }).session(session);

      for (const item of returnItems) {
        if (!item.restock) continue;

        const inventory = await Inventory.findOneAndUpdate(
          {
            organization: organizationId,
            product: item.product,
            variant: item.variant,
            quantity: {
              $lte: 999999999 - item.quantity,
            },
          },
          {
            $inc: {
              quantity: item.quantity,
            },
            $set: { updatedBy: userId },
          },
          { returnDocument: "after", session },
        );

        if (!inventory) {
          const existingInventory = await Inventory.exists({
            organization: organizationId,
            product: item.product,
            variant: item.variant,
          }).session(session);

          if (!existingInventory) {
            throw createServiceError(
              409,
              "INVENTORY_NOT_FOUND",
              `Inventory record not found for SKU ${item.sku}`,
            );
          }

          throw createServiceError(
            409,
            "STOCK_QUANTITY_LIMIT_EXCEEDED",
            `Stock quantity limit exceeded for SKU ${item.sku}`,
          );
        }

        const previousQuantity = inventory.quantity - item.quantity;

        await StockMovement.create(
          [
            {
              organization: organizationId,
              product: item.product,
              variant: item.variant,
              type: "stock_in",
              quantity: item.quantity,
              previousQuantity,
              newQuantity: inventory.quantity,
              reason: `Customer return ${returnRecord.returnNumber}`,
              performedBy: userId,
            },
          ],
          { session },
        );
      }

      if (returnRecord.totalRefundPaise === 0) {
        returnRecord.status = "completed";
        returnRecord.refundStatus = "not_required";
      } else {
        returnRecord.refundStatus = "pending";
      }

      await returnRecord.save({ session });

      await createAuditLog({
        organizationId,
        actorId: userId,
        action: "return.approved",
        resourceType: "return",
        resourceId: returnRecord._id,
        description: "Return approved successfully",
        metadata: {
          returnNumber: returnRecord.returnNumber,
          totalQuantity: returnRecord.totalQuantity,
          totalRefundPaise: returnRecord.totalRefundPaise,
          refundStatus: returnRecord.refundStatus,
        },
        session,
      });

      approvedReturn = returnRecord;
    });

    return approvedReturn;
  } finally {
    await session.endSession();
  }
}

export async function rejectReturn({
  organizationId,
  returnId,
  userId,
  notes,
}) {
  const session = await mongoose.startSession();
  let rejectedReturn;

  try {
    await session.withTransaction(async () => {
      const returnRecord = await Return.findOneAndUpdate(
        {
          _id: returnId,
          organization: organizationId,
          status: "pending",
        },
        {
          $set: {
            status: "rejected",
            refundStatus: "not_required",
            processedBy: userId,
            processedAt: new Date(),
            ...(notes !== undefined ? { notes } : {}),
          },
        },
        { returnDocument: "after", runValidators: true, session },
      );

      if (!returnRecord) {
        throw createServiceError(
          404,
          "PENDING_RETURN_NOT_FOUND",
          "Pending return not found",
        );
      }

      await createAuditLog({
        organizationId,
        actorId: userId,
        action: "return.rejected",
        resourceType: "return",
        resourceId: returnRecord._id,
        description: "Return rejected successfully",
        metadata: {
          returnNumber: returnRecord.returnNumber,
          totalQuantity: returnRecord.totalQuantity,
          totalRefundPaise: returnRecord.totalRefundPaise,
        },
        session,
      });

      rejectedReturn = returnRecord;
    });

    return rejectedReturn;
  } finally {
    await session.endSession();
  }
}
