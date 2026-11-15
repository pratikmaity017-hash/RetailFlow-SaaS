import mongoose from "mongoose";

import BillingPayment from "../models/billing-payment.model.js";
import Subscription from "../models/subscription.model.js";

import {
  fetchRazorpayPayment,
  fetchRazorpayOrderPayments,
  fetchRazorpayOrdersByReceipt,
  fetchRazorpayOrder,
} from "./razorpay.service.js";

import { verifyRazorpayPaymentSignature } from "../utils/razorpay-signature.js";

function createServiceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function reconcileRazorpayOrder(billingPayment) {
  if (
    !["initial", "renewal"].includes(billingPayment.paymentType) ||
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

async function activateSubscription({
  organizationId,
  billingPayment,
  paymentId,
}) {
  const session = await mongoose.startSession();

  let result;

  try {
    await session.withTransaction(async () => {
      const currentPayment = await BillingPayment.findOne({
        _id: billingPayment._id,
        organization: organizationId,
      }).session(session);

      if (!currentPayment) {
        throw createServiceError(
          "Payment record was not found",
          404,
          "BILLING_PAYMENT_NOT_FOUND",
        );
      }

      if (currentPayment.status === "captured") {
        if (currentPayment.razorpayPaymentId !== paymentId) {
          throw createServiceError(
            "Payment has already been completed with another payment",
            409,
            "PAYMENT_ALREADY_COMPLETED",
          );
        }

        result = {
          alreadyVerified: true,
          paymentId: currentPayment._id,
          subscriptionId: currentPayment.subscription,
          status: "captured",
        };

        return;
      }

      if (!["pending", "authorized"].includes(currentPayment.status)) {
        throw createServiceError(
          "Payment is no longer eligible for verification",
          409,
          "PAYMENT_NOT_VERIFIABLE",
        );
      }

      const subscription = await Subscription.findOne({
        _id: currentPayment.subscription,
        organization: organizationId,
      })
        .populate("plan", "code")
        .session(session);

      if (!subscription) {
        throw createServiceError(
          "Organization subscription was not found",
          404,
          "SUBSCRIPTION_NOT_FOUND",
        );
      }

      if (!["initial", "renewal"].includes(currentPayment.paymentType)) {
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

      // Renewal must belong to the subscription's current plan.
      if (
        currentPayment.paymentType === "renewal" &&
        String(currentPayment.plan) !== String(subscription.plan?._id)
      ) {
        throw createServiceError(
          "Renewal payment plan does not match the current subscription plan",
          409,
          "RENEWAL_PAYMENT_PLAN_MISMATCH",
        );
      }

      const now = new Date();

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

      currentPayment.status = "captured";
      currentPayment.razorpayPaymentId = paymentId;
      currentPayment.paidAt = now;
      currentPayment.failureReason = null;

      await currentPayment.save({ session });

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

      result = {
        alreadyVerified: false,
        paymentId: currentPayment._id,
        subscriptionId: subscription._id,
        paymentType: currentPayment.paymentType || "initial",
        status: "captured",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      };
    });
  } finally {
    await session.endSession();
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
        "This order has already been completed with another payment",
        409,
        "PAYMENT_ALREADY_COMPLETED",
      );
    }

    return {
      alreadyVerified: true,
      paymentId: billingPayment._id,
      subscriptionId: billingPayment.subscription,
      status: "captured",
    };
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

  return activateSubscription({
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

  if (billingPayment.status === "captured") {
    return {
      alreadyVerified: true,
      paymentId: billingPayment._id,
      subscriptionId: billingPayment.subscription,
      status: "captured",
    };
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

  return activateSubscription({
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
    !["initial", "renewal"].includes(billingPayment.paymentType) ||
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

  return activateSubscription({
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
