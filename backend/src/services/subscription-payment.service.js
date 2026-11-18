import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import BillingPayment from "../models/billing-payment.model.js";
import Subscription from "../models/subscription.model.js";

import {
  fetchRazorpayPayment,
  fetchRazorpayOrderPayments,
  fetchRazorpayOrdersByReceipt,
  fetchRazorpayOrder,
} from "./razorpay.service.js";

import { verifyRazorpayPaymentSignature } from "../utils/razorpay-signature.js";
import { processCancelledRenewalRefund } from "./subscription-refund.service.js";

function createServiceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

const MAX_RECONCILIATION_ATTEMPTS = 8;

const RECONCILIATION_BASE_DELAY_MS = 60 * 1000; // 1 minute
const RECONCILIATION_MAX_DELAY_MS = 60 * 60 * 1000; // 1 hour
const RECONCILIATION_CLAIM_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const PERMANENT_RECONCILIATION_ERRORS = new Set([
  "BILLING_PAYMENT_NOT_FOUND",
  "SUBSCRIPTION_NOT_FOUND",
  "INVALID_CAPTURED_PAYMENT_STATE",
  "INVALID_BILLING_PAYMENT_TYPE",
  "INVALID_BILLING_INTERVAL",
  "INITIAL_PAYMENT_SUBSCRIPTION_MISMATCH",
  "PLAN_CHANGE_SUBSCRIPTION_MISMATCH",
  "PLAN_CHANGE_SUBSCRIPTION_NOT_ACTIVE",
  "PLAN_CHANGE_CANCELLATION_SCHEDULED",
  "PLAN_CHANGE_ALREADY_PENDING",
  "PLAN_CHANGE_PERIOD_EXPIRED",
  "SAME_SUBSCRIPTION_PLAN",
  "PENDING_CHANGE_PLAN_NOT_FOUND",
  "PENDING_PLAN_CHANGE_NOT_DUE",
  "PENDING_PLAN_CHANGE_PAYMENT_MISMATCH",
  "RENEWAL_PAYMENT_PLAN_MISMATCH",
]);

function isPermanentReconciliationError(error) {
  return PERMANENT_RECONCILIATION_ERRORS.has(error?.code);
}

async function reconcileRazorpayOrder(billingPayment) {
  if (
    !["initial", "renewal", "plan_change"].includes(
      billingPayment.paymentType,
    ) ||
    billingPayment.status !== "pending" ||
    !["creating", "unknown"].includes(billingPayment.orderCreationStatus)
  ) {
    throw createServiceError(
      "This payment is not eligible for order reconciliation",
      409,
      "ORDER_RECONCILIATION_NOT_ALLOWED",
    );
  }

  const receipt = billingPayment._id.toString();

  const orders = await fetchRazorpayOrdersByReceipt(receipt);

  const matchingOrders = orders.filter((order) => order.receipt === receipt);

  if (matchingOrders.length > 1) {
    throw createServiceError(
      "Multiple Razorpay orders found. Manual review is required.",
      409,
      "MULTIPLE_RAZORPAY_ORDERS_FOUND",
    );
  }

  if (matchingOrders.length === 0) {
    throw createServiceError(
      "Razorpay order is not yet visible. Try recovery again later.",
      503,
      "RAZORPAY_ORDER_RECONCILIATION_PENDING",
    );
  }

  const order = matchingOrders[0];
  await billingPayment.populate("plan", "code");
  const expectedNotes = {
    billingPaymentId: receipt,
    organizationId: billingPayment.organization?.toString(),
    planCode: billingPayment.plan?.code,
    billingInterval: billingPayment.billingInterval,
    paymentType: billingPayment.paymentType,
  };

  const notesMismatch = Object.entries(expectedNotes).some(
    ([key, value]) => !value || order.notes?.[key] !== String(value),
  );

  if (
    order.receipt !== receipt ||
    order.amount !== billingPayment.amountPaise ||
    order.currency !== billingPayment.currency ||
    notesMismatch
  ) {
    throw createServiceError(
      "Razorpay order details do not match. Manual review is required.",
      409,
      "RAZORPAY_ORDER_DETAILS_MISMATCH",
    );
  }

  const savedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: billingPayment._id,
      status: "pending",
      orderCreationStatus: {
        $in: ["creating", "unknown"],
      },
      $or: [{ razorpayOrderId: null }, { razorpayOrderId: { $exists: false } }],
    },
    {
      $set: {
        razorpayOrderId: order.id,
        orderCreationStatus: "created",
        failureReason: null,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!savedPayment) {
    const latestPayment = await BillingPayment.findById(billingPayment._id);

    if (
      latestPayment?.razorpayOrderId === order.id &&
      latestPayment.status === "pending"
    ) {
      return latestPayment.razorpayOrderId;
    }

    throw createServiceError(
      "Payment state changed during reconciliation. Try recovery again.",
      409,
      "RENEWAL_PAYMENT_STATE_CHANGED",
    );
  }

  return savedPayment.razorpayOrderId;
}

function calculatePeriodEnd(startDate, billingInterval) {
  if (!["monthly", "yearly"].includes(billingInterval)) {
    throw createServiceError(
      "Invalid billing interval",
      400,
      "INVALID_BILLING_INTERVAL",
    );
  }

  const originalDate = new Date(startDate);
  const originalDay = originalDate.getUTCDate();

  const targetYear =
    originalDate.getUTCFullYear() + (billingInterval === "yearly" ? 1 : 0);

  const targetMonth =
    originalDate.getUTCMonth() + (billingInterval === "monthly" ? 1 : 0);

  const normalizedTarget = new Date(Date.UTC(targetYear, targetMonth, 1));

  const lastDayOfTargetMonth = new Date(
    Date.UTC(
      normalizedTarget.getUTCFullYear(),
      normalizedTarget.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();

  const endDate = new Date(originalDate);

  endDate.setUTCDate(1);
  endDate.setUTCFullYear(
    normalizedTarget.getUTCFullYear(),
    normalizedTarget.getUTCMonth(),
    1,
  );

  endDate.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));

  return endDate;
}

async function persistCapturedPayment({
  organizationId,
  billingPayment,
  paymentId,
}) {
  const now = new Date();

  const updatedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: billingPayment._id,
      organization: organizationId,
      status: { $in: ["pending", "authorized"] },
      $or: [
        { razorpayPaymentId: null },
        { razorpayPaymentId: { $exists: false } },
        { razorpayPaymentId: paymentId },
      ],
    },
    {
      $set: {
        status: "captured",
        razorpayPaymentId: paymentId,
        paidAt: now,
        failureReason: null,
        reconciliation: {
          status: "pending",
          reason: "Captured payment is awaiting subscription application",
          requiredAt: now,
          resolvedAt: null,
        },
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (updatedPayment) {
    return updatedPayment;
  }

  const existingPayment = await BillingPayment.findOne({
    _id: billingPayment._id,
    organization: organizationId,
  });

  if (
    existingPayment?.status === "captured" &&
    existingPayment.razorpayPaymentId === paymentId
  ) {
    return existingPayment;
  }

  throw createServiceError(
    "Payment state changed during capture persistence",
    409,
    "PAYMENT_CAPTURE_PERSISTENCE_CONFLICT",
  );
}

async function claimPaymentReconciliation(billingPaymentId) {
  const now = new Date();
  const claimToken = randomUUID();

  const claimedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: billingPaymentId,
      status: "captured",
      "reconciliation.status": "pending",
      "reconciliation.manualReviewRequired": { $ne: true },
      $and: [
        {
          $or: [
            { "reconciliation.nextAttemptAt": null },
            { "reconciliation.nextAttemptAt": { $exists: false } },
            { "reconciliation.nextAttemptAt": { $lte: now } },
          ],
        },
        {
          $or: [
            { "reconciliation.claimToken": null },
            { "reconciliation.claimToken": { $exists: false } },
            { "reconciliation.claimExpiresAt": null },
            { "reconciliation.claimExpiresAt": { $exists: false } },
            { "reconciliation.claimExpiresAt": { $lte: now } },
          ],
        },
      ],
    },
    {
      $set: {
        "reconciliation.claimToken": claimToken,
        "reconciliation.claimExpiresAt": new Date(
          now.getTime() + RECONCILIATION_CLAIM_DURATION_MS,
        ),
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!claimedPayment) {
    return null;
  }

  return {
    billingPayment: claimedPayment,
    claimToken,
  };
}

async function extendPaymentReconciliationClaim({
  billingPaymentId,
  claimToken,
}) {
  const now = new Date();

  const updatedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: billingPaymentId,
      status: "captured",
      "reconciliation.status": "pending",
      "reconciliation.claimToken": claimToken,
      "reconciliation.claimExpiresAt": { $gt: now },
    },
    {
      $set: {
        "reconciliation.claimExpiresAt": new Date(
          now.getTime() + RECONCILIATION_CLAIM_DURATION_MS,
        ),
      },
    },
    { returnDocument: "after" },
  );

  return Boolean(updatedPayment);
}

function startPaymentReconciliationHeartbeat({ billingPaymentId, claimToken }) {
  let stopped = false;
  let heartbeatRunning = false;
  let leaseLost = false;

  const interval = setInterval(async () => {
    if (stopped || heartbeatRunning || leaseLost) {
      return;
    }

    heartbeatRunning = true;

    try {
      const extended = await extendPaymentReconciliationClaim({
        billingPaymentId,
        claimToken,
      });

      if (!extended) {
        leaseLost = true;

        console.error(
          `[Payment Reconciliation] Claim lease lost: ${billingPaymentId}`,
        );
      }
    } catch (error) {
      console.error(
        `[Payment Reconciliation] Heartbeat failed: ${billingPaymentId}`,
        error,
      );
    } finally {
      heartbeatRunning = false;
    }
  }, 60 * 1000);

  interval.unref?.();

  return {
    stop() {
      stopped = true;
      clearInterval(interval);
    },

    hasLostLease() {
      return leaseLost;
    },
  };
}

async function releasePaymentReconciliationClaim({
  billingPaymentId,
  claimToken,
}) {
  await BillingPayment.updateOne(
    {
      _id: billingPaymentId,
      status: "captured",
      "reconciliation.claimToken": claimToken,
    },
    {
      $set: {
        "reconciliation.claimToken": null,
        "reconciliation.claimExpiresAt": null,
      },
    },
  );
}

async function markPaymentReconciliationPending({
  organizationId,
  billingPaymentId,
  paymentId,
  error,
}) {
  const now = new Date();

  const reason = String(
    error?.message || "Subscription activation requires reconciliation",
  ).slice(0, 500);

  const errorCode = String(
    error?.code || "PAYMENT_RECONCILIATION_FAILED",
  ).slice(0, 100);

  const updatedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: billingPaymentId,
      organization: organizationId,
      status: "captured",
      razorpayPaymentId: paymentId,
      "reconciliation.status": { $ne: "resolved" },
    },
    [
      {
        $set: {
          "reconciliation.status": "pending",

          "reconciliation.reason": reason,

          // Preserve the original reconciliation start time.
          "reconciliation.requiredAt": {
            $ifNull: ["$reconciliation.requiredAt", now],
          },

          "reconciliation.attemptCount": {
            $add: [{ $ifNull: ["$reconciliation.attemptCount", 0] }, 1],
          },

          "reconciliation.lastAttemptAt": now,

          "reconciliation.lastErrorCode": errorCode,

          "reconciliation.manualReviewRequired": isPermanentReconciliationError(
            { code: errorCode },
          ) || {
            $gte: [
              {
                $add: [{ $ifNull: ["$reconciliation.attemptCount", 0] }, 1],
              },
              MAX_RECONCILIATION_ATTEMPTS,
            ],
          },

          "reconciliation.nextAttemptAt": {
            $cond: [
              {
                $or: [
                  isPermanentReconciliationError({ code: errorCode }),
                  {
                    $gte: [
                      {
                        $add: [
                          { $ifNull: ["$reconciliation.attemptCount", 0] },
                          1,
                        ],
                      },
                      MAX_RECONCILIATION_ATTEMPTS,
                    ],
                  },
                ],
              },
              null,
              {
                $let: {
                  vars: {
                    nextAttempt: {
                      $add: [
                        { $ifNull: ["$reconciliation.attemptCount", 0] },
                        1,
                      ],
                    },
                  },
                  in: {
                    $add: [
                      now,
                      {
                        $min: [
                          {
                            $multiply: [
                              RECONCILIATION_BASE_DELAY_MS,
                              {
                                $pow: [2, { $subtract: ["$$nextAttempt", 1] }],
                              },
                            ],
                          },
                          RECONCILIATION_MAX_DELAY_MS,
                        ],
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    ],
    {
      returnDocument: "after",
    },
  );

  if (updatedPayment) {
    return updatedPayment;
  }

  const existingPayment = await BillingPayment.findOne({
    _id: billingPaymentId,
    organization: organizationId,
  });

  if (
    existingPayment?.status === "captured" &&
    existingPayment.razorpayPaymentId === paymentId &&
    existingPayment.reconciliation?.status === "resolved"
  ) {
    return existingPayment;
  }

  throw createServiceError(
    "Unable to mark captured payment for reconciliation",
    500,
    "PAYMENT_RECONCILIATION_UPDATE_FAILED",
  );
}

async function activateSubscription({
  organizationId,
  billingPayment,
  paymentId,
  claimToken,
}) {
  // Step 1: Persist captured payment outside the subscription transaction.
  const persistedPayment = await persistCapturedPayment({
    organizationId,
    billingPayment,
    paymentId,
  });

  // Already applied successfully: do not apply it again.
  if (
    ["resolved", "not_required"].includes(
      persistedPayment.reconciliation?.status,
    )
  ) {
    return {
      alreadyVerified: true,
      paymentId: persistedPayment._id,
      subscriptionId: persistedPayment.subscription,
      status: "captured",
      reconciliationStatus:
        persistedPayment.reconciliation?.status || "not_required",
    };
  }

  const session = await mongoose.startSession();

  let result;

  try {
    try {
      await session.withTransaction(async () => {
        if (!claimToken) {
          const error = new Error("PAYMENT_RECONCILIATION_CLAIM_LOST");
          error.code = "PAYMENT_RECONCILIATION_CLAIM_LOST";
          throw error;
        }

        const ownedClaim = await BillingPayment.findOne({
          _id: billingPayment._id,
          status: "captured",
          "reconciliation.status": "pending",
          "reconciliation.claimToken": claimToken,
          "reconciliation.claimExpiresAt": {
            $gt: new Date(),
          },
        }).session(session);

        if (!ownedClaim) {
          const error = new Error("PAYMENT_RECONCILIATION_CLAIM_LOST");
          error.code = "PAYMENT_RECONCILIATION_CLAIM_LOST";
          throw error;
        }

        const currentPayment = await BillingPayment.findOne({
          _id: persistedPayment._id,
          organization: organizationId,
        }).session(session);

        if (!currentPayment) {
          throw createServiceError(
            "Payment record was not found",
            404,
            "BILLING_PAYMENT_NOT_FOUND",
          );
        }

        if (
          currentPayment.status !== "captured" ||
          currentPayment.razorpayPaymentId !== paymentId
        ) {
          throw createServiceError(
            "Captured payment state is invalid",
            409,
            "INVALID_CAPTURED_PAYMENT_STATE",
          );
        }

        // Another request may have completed the activation.
        if (currentPayment.reconciliation?.status === "resolved") {
          result = {
            alreadyVerified: true,
            paymentId: currentPayment._id,
            subscriptionId: currentPayment.subscription,
            status: "captured",
            reconciliationStatus: "resolved",
          };

          return;
        }

        const subscription = await Subscription.findOne({
          _id: currentPayment.subscription,
          organization: organizationId,
        })
          .populate("plan", "code")
          .populate("pendingChange.plan", "code")
          .session(session);

        if (!subscription) {
          throw createServiceError(
            "Organization subscription was not found",
            404,
            "SUBSCRIPTION_NOT_FOUND",
          );
        }

        if (
          currentPayment.paymentType === "renewal" &&
          subscription.lastPaymentAt &&
          currentPayment.createdAt <= subscription.lastPaymentAt
        ) {
          throw createServiceError(
            "This renewal payment is stale because the subscription was already renewed.",
            409,
            "STALE_RENEWAL_PAYMENT",
          );
        }

        if (
          !["initial", "renewal", "plan_change"].includes(
            currentPayment.paymentType,
          )
        ) {
          throw createServiceError(
            "Invalid billing payment type",
            409,
            "INVALID_BILLING_PAYMENT_TYPE",
          );
        }

        if (!["monthly", "yearly"].includes(currentPayment.billingInterval)) {
          throw createServiceError(
            "Invalid billing interval",
            409,
            "INVALID_BILLING_INTERVAL",
          );
        }

        // Initial checkout must still belong to a Free subscription.
        if (
          currentPayment.paymentType === "initial" &&
          subscription.plan?.code !== "free"
        ) {
          throw createServiceError(
            "Initial payment cannot replace an existing paid subscription",
            409,
            "INITIAL_PAYMENT_SUBSCRIPTION_MISMATCH",
          );
        }

        const now = new Date();
        const isPlanChange = currentPayment.paymentType === "plan_change";

        if (isPlanChange) {
          if (subscription.plan?.code === "free") {
            throw createServiceError(
              "Plan change payment requires an existing paid subscription",
              409,
              "PLAN_CHANGE_SUBSCRIPTION_MISMATCH",
            );
          }

          if (subscription.status !== "active") {
            throw createServiceError(
              "Subscription is no longer active",
              409,
              "PLAN_CHANGE_SUBSCRIPTION_NOT_ACTIVE",
            );
          }

          if (subscription.cancelAtPeriodEnd) {
            throw createServiceError(
              "Subscription cancellation is scheduled",
              409,
              "PLAN_CHANGE_CANCELLATION_SCHEDULED",
            );
          }

          if (subscription.pendingChange) {
            throw createServiceError(
              "Another plan change is already scheduled",
              409,
              "PLAN_CHANGE_ALREADY_PENDING",
            );
          }

          if (
            !subscription.currentPeriodEnd ||
            subscription.currentPeriodEnd <= now
          ) {
            throw createServiceError(
              "Current subscription period is no longer valid",
              409,
              "PLAN_CHANGE_PERIOD_EXPIRED",
            );
          }

          if (
            String(currentPayment.plan) === String(subscription.plan?._id) &&
            currentPayment.billingInterval === subscription.billingInterval
          ) {
            throw createServiceError(
              "Requested plan is already active",
              409,
              "SAME_SUBSCRIPTION_PLAN",
            );
          }
        }

        if (currentPayment.paymentType === "renewal") {
          if (subscription.pendingChange) {
            const pendingChange = subscription.pendingChange;

            if (!pendingChange.plan) {
              throw createServiceError(
                "Scheduled subscription plan was not found",
                409,
                "PENDING_CHANGE_PLAN_NOT_FOUND",
              );
            }

            if (!pendingChange.effectiveAt || pendingChange.effectiveAt > now) {
              throw createServiceError(
                "Scheduled plan change is not effective yet",
                409,
                "PENDING_PLAN_CHANGE_NOT_DUE",
              );
            }

            if (
              String(currentPayment.plan) !== String(pendingChange.plan._id) ||
              currentPayment.billingInterval !== pendingChange.billingInterval
            ) {
              throw createServiceError(
                "Payment does not match the scheduled subscription plan change",
                409,
                "PENDING_PLAN_CHANGE_PAYMENT_MISMATCH",
              );
            }
          } else if (
            String(currentPayment.plan) !== String(subscription.plan?._id)
          ) {
            throw createServiceError(
              "Renewal payment plan does not match the current subscription plan",
              409,
              "RENEWAL_PAYMENT_PLAN_MISMATCH",
            );
          }
        }

        const isRenewal = currentPayment.paymentType === "renewal";

        let periodStart = now;

        if (
          isRenewal &&
          subscription.currentPeriodEnd &&
          subscription.currentPeriodEnd > now
        ) {
          periodStart = new Date(subscription.currentPeriodEnd);
        }

        const periodEnd = calculatePeriodEnd(
          periodStart,
          currentPayment.billingInterval,
        );

        const resolveClaimedPayment = async () => {
          const resolvedAt = new Date();

          const updateResult = await BillingPayment.updateOne(
            {
              _id: currentPayment._id,
              organization: organizationId,
              status: "captured",
              razorpayPaymentId: paymentId,
              "reconciliation.status": "pending",
              "reconciliation.claimToken": claimToken,
              "reconciliation.claimExpiresAt": {
                $gt: resolvedAt,
              },
            },
            {
              $set: {
                "reconciliation.status": "resolved",
                "reconciliation.reason": null,
                "reconciliation.resolvedAt": resolvedAt,
              },
              $unset: {
                "reconciliation.claimToken": "",
                "reconciliation.claimExpiresAt": "",
              },
            },
            { session },
          );

          if (updateResult.modifiedCount !== 1) {
            const error = new Error("PAYMENT_RECONCILIATION_CLAIM_LOST");
            error.code = "PAYMENT_RECONCILIATION_CLAIM_LOST";
            throw error;
          }
        };

        // A paid plan change is prepaid and scheduled.
        // Do not replace the current subscription immediately.
        if (isPlanChange) {
          const effectiveAt = new Date(subscription.currentPeriodEnd);

          subscription.pendingChange = {
            plan: currentPayment.plan,
            billingInterval: currentPayment.billingInterval,
            effectiveAt,
            billingPayment: currentPayment._id,
          };

          await subscription.save({ session });
          await resolveClaimedPayment();

          result = {
            alreadyVerified: false,
            paymentId: currentPayment._id,
            subscriptionId: subscription._id,
            paymentType: "plan_change",
            status: "captured",
            planChangeScheduled: true,
            currentPlan: subscription.plan,
            upcomingPlan: currentPayment.plan,
            effectiveAt,
            reconciliationStatus: "resolved",
          };

          return;
        }

        // Existing initial checkout and renewal behaviour remains unchanged.
        subscription.plan = currentPayment.plan;
        subscription.status = "active";
        subscription.billingInterval = currentPayment.billingInterval;
        subscription.currentPeriodStart = periodStart;
        subscription.currentPeriodEnd = periodEnd;
        subscription.nextBillingAt = periodEnd;
        subscription.gracePeriodEndsAt = null;
        subscription.cancelAtPeriodEnd = false;
        subscription.canceledAt = null;
        subscription.pendingChange = null;
        subscription.lastPaymentAt = now;

        await subscription.save({ session });
        await resolveClaimedPayment();

        result = {
          alreadyVerified: false,
          paymentId: currentPayment._id,
          subscriptionId: subscription._id,
          paymentType: currentPayment.paymentType || "initial",
          status: "captured",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          reconciliationStatus: "resolved",
        };
      });
    } catch (error) {
      // Preserve the existing stale-renewal refund handling.
      if (error.code === "STALE_RENEWAL_PAYMENT") {
        throw error;
      }

      if (error.code === "PAYMENT_RECONCILIATION_CLAIM_LOST") {
        return {
          alreadyVerified: false,
          paymentId: billingPayment._id,
          subscriptionId: billingPayment.subscription,
          status: "captured",
          reconciliationRequired: true,
          reconciliationStatus: "pending",
          claimInProgress: true,
        };
      }

      // Payment is already captured. Do not roll it back or mark it failed.
      const reconciliationPayment = await markPaymentReconciliationPending({
        organizationId,
        billingPaymentId: persistedPayment._id,
        paymentId,
        error,
      });

      if (reconciliationPayment.reconciliation?.status === "resolved") {
        return {
          alreadyVerified: true,
          paymentId: reconciliationPayment._id,
          subscriptionId: reconciliationPayment.subscription,
          status: "captured",
          reconciliationStatus: "resolved",
        };
      }

      return {
        alreadyVerified: false,
        paymentId: reconciliationPayment._id,
        subscriptionId: reconciliationPayment.subscription,
        status: "captured",
        reconciliationRequired: true,
        reconciliationStatus: "pending",
      };
    }
  } finally {
    await session.endSession();
  }

  return result;
}

async function markStaleRenewalForRefund({ billingPayment, paymentId }) {
  const updatedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: billingPayment._id,
      organization: billingPayment.organization,
      paymentType: "renewal",
      $or: [
        {
          status: { $in: ["pending", "authorized"] },
          $or: [
            { razorpayPaymentId: null },
            { razorpayPaymentId: { $exists: false } },
            { razorpayPaymentId: paymentId },
          ],
        },
        {
          status: "captured",
          razorpayPaymentId: paymentId,
        },
      ],
    },
    {
      $set: {
        status: "refund_pending",
        razorpayPaymentId: paymentId,
        paidAt: billingPayment.paidAt || new Date(),
        refundStatus: "pending",
        failureReason: "STALE_RENEWAL_PAYMENT_CAPTURED",
        "reconciliation.claimToken": null,
        "reconciliation.claimExpiresAt": null,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!updatedPayment) {
    const latestPayment = await BillingPayment.findById(billingPayment._id);

    if (
      ["refund_pending", "refunded"].includes(latestPayment?.status) &&
      latestPayment.razorpayPaymentId === paymentId
    ) {
      return {
        verified: true,
        subscriptionActivated: false,
        refundRequired: latestPayment.status !== "refunded",
        refundStatus: latestPayment.status,
        paymentId,
        billingPaymentId: latestPayment._id,
      };
    }

    throw createServiceError(
      "Stale renewal payment changed during refund processing.",
      409,
      "STALE_RENEWAL_REFUND_CONFLICT",
    );
  }

  return {
    verified: true,
    subscriptionActivated: false,
    refundRequired: true,
    refundStatus: "pending",
    paymentId,
    billingPaymentId: updatedPayment._id,
  };
}

async function activateOrHandleStaleRenewal({
  organizationId,
  billingPayment,
  paymentId,
}) {
  // Ensure the captured payment is persisted before acquiring a claim.
  const persistedPayment = await persistCapturedPayment({
    organizationId,
    billingPayment,
    paymentId,
  });

  // Already completed: no new claim is necessary.
  if (
    ["resolved", "not_required"].includes(
      persistedPayment.reconciliation?.status,
    )
  ) {
    return activateSubscription({
      organizationId,
      billingPayment: persistedPayment,
      paymentId,
    });
  }

  const claim = await claimPaymentReconciliation(persistedPayment._id);

  if (!claim) {
    const latestPayment = await BillingPayment.findById(persistedPayment._id);

    if (!latestPayment) {
      return {
        alreadyVerified: false,
        paymentId: persistedPayment._id,
        reconciliationRequired: false,
        claimInProgress: false,
      };
    }

    const reconciliation = latestPayment.reconciliation;
    const now = new Date();

    if (reconciliation?.status === "resolved") {
      return {
        alreadyVerified: true,
        paymentId: latestPayment._id,
        subscriptionId: latestPayment.subscription,
        status: latestPayment.status,
        reconciliationStatus: "resolved",
      };
    }

    const claimInProgress = Boolean(
      reconciliation?.claimToken &&
      reconciliation?.claimExpiresAt &&
      reconciliation.claimExpiresAt > now,
    );

    const retryScheduled = Boolean(
      reconciliation?.nextAttemptAt && reconciliation.nextAttemptAt > now,
    );

    return {
      alreadyVerified: false,
      paymentId: latestPayment._id,
      subscriptionId: latestPayment.subscription,
      status: latestPayment.status,
      reconciliationRequired: latestPayment.status === "captured",
      reconciliationStatus: reconciliation?.status || "pending",
      claimInProgress,
      retryScheduled,
      manualReviewRequired: reconciliation?.manualReviewRequired === true,
    };
  }

  const { billingPayment: claimedPayment, claimToken } = claim;

  const heartbeat = startPaymentReconciliationHeartbeat({
    billingPaymentId: claimedPayment._id,
    claimToken,
  });

  try {
    try {
      return await activateSubscription({
        organizationId,
        billingPayment: claimedPayment,
        paymentId,
        claimToken,
      });
    } catch (error) {
      if (
        error.code !== "STALE_RENEWAL_PAYMENT" ||
        claimedPayment.paymentType !== "renewal"
      ) {
        throw error;
      }

      const result = await markStaleRenewalForRefund({
        billingPayment: claimedPayment,
        paymentId,
      });

      if (result.refundRequired) {
        const refundResult = await processCancelledRenewalRefund({
          billingPaymentId: result.billingPaymentId,
        });

        return {
          ...result,
          refundResult,
        };
      }

      return result;
    }
  } finally {
    heartbeat.stop();

    await releasePaymentReconciliationClaim({
      billingPaymentId: claimedPayment._id,
      claimToken,
    });
  }
}

export async function recoverPendingPaymentReconciliations({
  batchSize = 10,
} = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new Error("INVALID_RECONCILIATION_BATCH_SIZE");
  }

  const now = new Date();

  const pendingPayments = await BillingPayment.find({
    status: "captured",
    "reconciliation.status": "pending",
    "reconciliation.manualReviewRequired": { $ne: true },
    razorpayPaymentId: { $exists: true, $ne: null },
    $and: [
      {
        $or: [
          { "reconciliation.nextAttemptAt": null },
          { "reconciliation.nextAttemptAt": { $exists: false } },
          { "reconciliation.nextAttemptAt": { $lte: now } },
        ],
      },
      {
        $or: [
          { "reconciliation.claimToken": null },
          { "reconciliation.claimToken": { $exists: false } },
          { "reconciliation.claimExpiresAt": null },
          { "reconciliation.claimExpiresAt": { $exists: false } },
          { "reconciliation.claimExpiresAt": { $lte: now } },
        ],
      },
    ],
  })
    .sort({
      "reconciliation.requiredAt": 1,
      createdAt: 1,
    })
    .limit(batchSize);

  const result = {
    checked: pendingPayments.length,
    processed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const billingPayment of pendingPayments) {
    try {
      const recoveryResult = await activateOrHandleStaleRenewal({
        organizationId: billingPayment.organization,
        billingPayment,
        paymentId: billingPayment.razorpayPaymentId,
      });

      if (
        recoveryResult.claimInProgress ||
        recoveryResult.retryScheduled ||
        recoveryResult.manualReviewRequired
      ) {
        result.skipped++;
        continue;
      }

      if (recoveryResult.reconciliationStatus === "resolved") {
        result.processed++;
        continue;
      }

      if (
        recoveryResult.reconciliationRequired ||
        recoveryResult.refundRequired
      ) {
        result.failed++;
        continue;
      }

      result.skipped++;
    } catch (error) {
      result.failed++;

      console.error(
        `[Payment Reconciliation] Failed for ${billingPayment._id}:`,
        error,
      );
    }
  }

  return result;
}

export async function verifySubscriptionPayment({
  organizationId,
  orderId,
  paymentId,
  signature,
}) {
  if (!orderId || !paymentId || !signature) {
    throw createServiceError(
      "Payment verification details are required",
      400,
      "PAYMENT_DETAILS_REQUIRED",
    );
  }

  const billingPayment = await BillingPayment.findOne({
    organization: organizationId,
    razorpayOrderId: orderId,
  });

  if (!billingPayment) {
    throw createServiceError(
      "Payment order was not found",
      404,
      "BILLING_PAYMENT_NOT_FOUND",
    );
  }

  const isSignatureValid = verifyRazorpayPaymentSignature({
    orderId,
    paymentId,
    signature,
  });

  if (!isSignatureValid) {
    throw createServiceError(
      "Payment signature verification failed",
      400,
      "INVALID_PAYMENT_SIGNATURE",
    );
  }

  if (billingPayment.status === "captured") {
    if (billingPayment.razorpayPaymentId !== paymentId) {
      throw createServiceError(
        "Payment has already been completed with another payment",
        409,
        "PAYMENT_ALREADY_COMPLETED",
      );
    }

    return activateOrHandleStaleRenewal({
      organizationId,
      billingPayment,
      paymentId,
    });
  }

  if (!["pending", "authorized"].includes(billingPayment.status)) {
    throw createServiceError(
      "This payment cannot be verified",
      409,
      "PAYMENT_NOT_VERIFIABLE",
    );
  }

  const razorpayPayment = await fetchRazorpayPayment(paymentId);

  if (razorpayPayment.orderId !== orderId) {
    throw createServiceError(
      "Payment does not belong to this order",
      400,
      "PAYMENT_ORDER_MISMATCH",
    );
  }

  if (
    razorpayPayment.amount !== billingPayment.amountPaise ||
    razorpayPayment.currency !== billingPayment.currency
  ) {
    throw createServiceError(
      "Payment amount or currency does not match the order",
      400,
      "PAYMENT_AMOUNT_MISMATCH",
    );
  }

  if (
    razorpayPayment.status !== "captured" ||
    razorpayPayment.captured !== true
  ) {
    throw createServiceError(
      "Payment has not been captured yet",
      409,
      "PAYMENT_NOT_CAPTURED",
    );
  }

  return activateOrHandleStaleRenewal({
    organizationId,
    billingPayment,
    paymentId,
  });
}

export async function recoverSubscriptionPayment({
  organizationId,
  orderId,
  billingPaymentId,
}) {
  if (!orderId && !billingPaymentId) {
    throw createServiceError(
      "Razorpay order ID or billing payment ID is required",
      400,
      "PAYMENT_RECOVERY_DETAILS_REQUIRED",
    );
  }

  const billingPayment = billingPaymentId
    ? await BillingPayment.findOne({
        _id: billingPaymentId,
        organization: organizationId,
      })
    : await BillingPayment.findOne({
        organization: organizationId,
        razorpayOrderId: orderId,
      });

  if (!billingPayment) {
    throw createServiceError(
      "Payment record was not found",
      404,
      "BILLING_PAYMENT_NOT_FOUND",
    );
  }

  if (orderId && orderId !== billingPayment.razorpayOrderId) {
    throw createServiceError(
      "The supplied order ID does not belong to this billing payment",
      400,
      "PAYMENT_ORDER_MISMATCH",
    );
  }

  if (billingPayment.status === "captured") {
    if (orderId && billingPayment.razorpayOrderId !== orderId) {
      throw createServiceError(
        "Razorpay order does not match the billing payment",
        409,
        "RAZORPAY_ORDER_MISMATCH",
      );
    }

    if (!billingPayment.razorpayPaymentId) {
      throw createServiceError(
        "Captured payment is missing its Razorpay payment ID",
        409,
        "CAPTURED_PAYMENT_ID_MISSING",
      );
    }

    return activateOrHandleStaleRenewal({
      organizationId,
      billingPayment,
      paymentId: billingPayment.razorpayPaymentId,
    });
  }

  if (!["pending", "authorized"].includes(billingPayment.status)) {
    throw createServiceError(
      "This payment cannot be recovered",
      409,
      "PAYMENT_NOT_RECOVERABLE",
    );
  }

  let savedOrderId = billingPayment.razorpayOrderId;

  if (!savedOrderId) {
    savedOrderId = await reconcileRazorpayOrder(billingPayment);
  }

  if (orderId && orderId !== savedOrderId) {
    throw createServiceError(
      "The supplied order ID does not belong to this billing payment",
      400,
      "PAYMENT_ORDER_MISMATCH",
    );
  }

  const razorpayPayments = await fetchRazorpayOrderPayments(savedOrderId);

  const matchingPayments = razorpayPayments.filter(
    (payment) =>
      payment.orderId === savedOrderId &&
      payment.amount === billingPayment.amountPaise &&
      payment.currency === billingPayment.currency &&
      payment.status === "captured" &&
      payment.captured === true,
  );

  if (matchingPayments.length === 0) {
    throw createServiceError(
      "No captured payment was found for this order",
      409,
      "CAPTURED_PAYMENT_NOT_FOUND",
    );
  }

  if (matchingPayments.length > 1) {
    throw createServiceError(
      "Multiple captured payments were found. Manual review is required",
      409,
      "MULTIPLE_CAPTURED_PAYMENTS",
    );
  }

  const capturedPayment = matchingPayments[0];

  return activateOrHandleStaleRenewal({
    organizationId,
    billingPayment,
    paymentId: capturedPayment.id,
  });
}

export async function reconcileWebhookRazorpayOrder(orderId) {
  if (!orderId || typeof orderId !== "string") {
    throw createServiceError(
      "Valid Razorpay order ID is required",
      400,
      "INVALID_RAZORPAY_ORDER_ID",
    );
  }

  // First check whether the order is already linked.
  const existingPayment = await BillingPayment.findOne({
    razorpayOrderId: orderId,
  });

  if (existingPayment) {
    return {
      reconciled: false,
      billingPaymentId: existingPayment._id,
    };
  }

  // Fetch the order directly from Razorpay.
  const razorpayOrder = await fetchRazorpayOrder(orderId);

  const receipt = razorpayOrder.receipt;

  if (!receipt) {
    throw createServiceError(
      "Razorpay order has no receipt. Manual review is required.",
      409,
      "RAZORPAY_ORDER_RECEIPT_MISSING",
    );
  }

  const billingPayment = await BillingPayment.findById(receipt);
  if (billingPayment) {
    await billingPayment.populate("plan", "code");
  }
  if (!billingPayment) {
    throw createServiceError(
      "Billing payment for this Razorpay receipt was not found",
      404,
      "BILLING_PAYMENT_NOT_FOUND",
    );
  }

  // Only reconcile uncertain renewal order creation.
  if (
    !["initial", "renewal", "plan_change"].includes(
      billingPayment.paymentType,
    ) ||
    billingPayment.status !== "pending" ||
    !["creating", "unknown"].includes(billingPayment.orderCreationStatus)
  ) {
    throw createServiceError(
      "Billing payment is not eligible for webhook reconciliation",
      409,
      "ORDER_RECONCILIATION_NOT_ALLOWED",
    );
  }

  // Verify that this order belongs to this exact billing payment.
  const expectedNotes = {
    billingPaymentId: billingPayment._id.toString(),
    organizationId: billingPayment.organization?.toString(),
    planCode: billingPayment.plan?.code,
    billingInterval: billingPayment.billingInterval,
    paymentType: billingPayment.paymentType,
  };

  const notesMismatch = Object.entries(expectedNotes).some(
    ([key, value]) => !value || razorpayOrder.notes?.[key] !== String(value),
  );

  if (
    razorpayOrder.receipt !== billingPayment._id.toString() ||
    razorpayOrder.amount !== billingPayment.amountPaise ||
    razorpayOrder.currency !== billingPayment.currency ||
    notesMismatch
  ) {
    throw createServiceError(
      "Razorpay order details do not match",
      409,
      "RAZORPAY_ORDER_DETAILS_MISMATCH",
    );
  }
  const savedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: billingPayment._id,
      status: "pending",
      orderCreationStatus: {
        $in: ["creating", "unknown"],
      },
      $or: [{ razorpayOrderId: null }, { razorpayOrderId: { $exists: false } }],
    },
    {
      $set: {
        razorpayOrderId: orderId,
        orderCreationStatus: "created",
        failureReason: null,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!savedPayment) {
    // Another process may have completed reconciliation.
    const latestPayment = await BillingPayment.findById(billingPayment._id);

    if (latestPayment?.razorpayOrderId === orderId) {
      return {
        reconciled: true,
        billingPaymentId: latestPayment._id,
      };
    }

    throw createServiceError(
      "Billing payment changed during webhook reconciliation",
      409,
      "ORDER_RECONCILIATION_CONFLICT",
    );
  }

  return {
    reconciled: true,
    billingPaymentId: savedPayment._id,
  };
}

export async function processCapturedPaymentFromWebhook({
  orderId,
  paymentId,
  amount,
  currency,
}) {
  if (!orderId || !paymentId) {
    throw createServiceError(
      "Webhook payment details are incomplete",
      400,
      "WEBHOOK_PAYMENT_DETAILS_INVALID",
    );
  }

  const billingPayment = await BillingPayment.findOne({
    razorpayOrderId: orderId,
  });

  if (!billingPayment) {
    throw createServiceError(
      "Billing payment for this Razorpay order was not found",
      404,
      "BILLING_PAYMENT_NOT_FOUND",
    );
  }

  if (
    amount !== billingPayment.amountPaise ||
    currency !== billingPayment.currency
  ) {
    throw createServiceError(
      "Webhook payment amount or currency does not match",
      400,
      "WEBHOOK_PAYMENT_AMOUNT_MISMATCH",
    );
  }

  const razorpayPayment = await fetchRazorpayPayment(paymentId);

  if (
    razorpayPayment.orderId !== orderId ||
    razorpayPayment.amount !== billingPayment.amountPaise ||
    razorpayPayment.currency !== billingPayment.currency ||
    razorpayPayment.status !== "captured" ||
    razorpayPayment.captured !== true
  ) {
    throw createServiceError(
      "Razorpay payment could not be verified as captured",
      400,
      "WEBHOOK_PAYMENT_VERIFICATION_FAILED",
    );
  }

  // Cancellation is not finalized while the payment is reserved.
  // Fail this webhook delivery so Razorpay can retry after the
  // cancellation transaction commits or restores the payment.
  if (
    billingPayment.paymentType === "renewal" &&
    billingPayment.status === "cancellation_pending"
  ) {
    throw createServiceError(
      "Renewal cancellation is still being finalized. Retry this webhook later.",
      409,
      "RENEWAL_CANCELLATION_IN_PROGRESS",
    );
  }

  const wasCancelledRenewal =
    billingPayment.paymentType === "renewal" &&
    (billingPayment.status === "refund_pending" ||
      billingPayment.status === "refunded" ||
      (billingPayment.status === "failed" &&
        billingPayment.failureReason ===
          "RENEWAL_CHECKOUT_ABANDONED_BY_SUBSCRIPTION_CANCELLATION"));

  if (wasCancelledRenewal) {
    if (
      billingPayment.status === "refund_pending" ||
      billingPayment.status === "refunded"
    ) {
      if (billingPayment.razorpayPaymentId !== paymentId) {
        throw createServiceError(
          "A different payment is already recorded for this cancelled order",
          409,
          "CANCELLED_ORDER_PAYMENT_MISMATCH",
        );
      }

      return {
        verified: true,
        subscriptionActivated: false,
        refundRequired: billingPayment.status !== "refunded",
        refundStatus: billingPayment.status,
        paymentId,
        billingPaymentId: billingPayment._id,
      };
    }

    const updatedPayment = await BillingPayment.findOneAndUpdate(
      {
        _id: billingPayment._id,
        status: "failed",
        paymentType: "renewal",
        failureReason:
          "RENEWAL_CHECKOUT_ABANDONED_BY_SUBSCRIPTION_CANCELLATION",
      },
      {
        $set: {
          status: "refund_pending",
          razorpayPaymentId: paymentId,
          paidAt: new Date(),
          refundStatus: "pending",
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!updatedPayment) {
      throw createServiceError(
        "Cancelled renewal payment changed during processing",
        409,
        "CANCELLED_RENEWAL_PAYMENT_CONFLICT",
      );
    }

    return {
      verified: true,
      subscriptionActivated: false,
      refundRequired: true,
      refundStatus: "pending",
      paymentId,
      billingPaymentId: updatedPayment._id,
    };
  }

  return activateOrHandleStaleRenewal({
    organizationId: billingPayment.organization,
    billingPayment,
    paymentId,
  });
}

export async function processFailedPaymentFromWebhook({
  orderId,
  paymentId,
  amount,
  currency,
}) {
  if (!orderId || !paymentId) {
    throw createServiceError(
      "Webhook failed payment details are incomplete",
      400,
      "WEBHOOK_PAYMENT_DETAILS_INVALID",
    );
  }

  const billingPayment = await BillingPayment.findOne({
    razorpayOrderId: orderId,
  });

  if (!billingPayment) {
    throw createServiceError(
      "Billing payment for this Razorpay order was not found",
      404,
      "BILLING_PAYMENT_NOT_FOUND",
    );
  }

  if (billingPayment.status === "captured") {
    return {
      verified: false,
      ignored: true,
      reason: "BILLING_PAYMENT_ALREADY_CAPTURED",
    };
  }

  if (
    amount !== billingPayment.amountPaise ||
    currency !== billingPayment.currency
  ) {
    throw createServiceError(
      "Failed payment amount or currency does not match",
      400,
      "WEBHOOK_PAYMENT_AMOUNT_MISMATCH",
    );
  }

  const razorpayPayment = await fetchRazorpayPayment(paymentId);

  if (
    razorpayPayment.orderId !== orderId ||
    razorpayPayment.amount !== billingPayment.amountPaise ||
    razorpayPayment.currency !== billingPayment.currency ||
    razorpayPayment.status !== "failed" ||
    razorpayPayment.captured === true
  ) {
    throw createServiceError(
      "Razorpay payment could not be verified as failed",
      400,
      "WEBHOOK_FAILED_PAYMENT_VERIFICATION_FAILED",
    );
  }

  return {
    verified: true,
    paymentId,
    orderId,
    status: "failed",
    billingPaymentId: billingPayment._id,
  };
}
