import mongoose from "mongoose";

import BillingPayment from "../models/billing-payment.model.js";
import Subscription from "../models/subscription.model.js";

import {
  fetchRazorpayPayment,
  fetchRazorpayOrderPayments,
} from "./razorpay.service.js";

import { verifyRazorpayPaymentSignature } from "../utils/razorpay-signature.js";

function createServiceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function calculatePeriodEnd(startDate, billingInterval) {
  const endDate = new Date(startDate);

  if (billingInterval === "monthly") {
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  } else if (billingInterval === "yearly") {
    endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
  }

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
      }).session(session);

      if (!subscription) {
        throw createServiceError(
          "Organization subscription was not found",
          404,
          "SUBSCRIPTION_NOT_FOUND",
        );
      }

      const now = new Date();
      const periodEnd = calculatePeriodEnd(now, currentPayment.billingInterval);

      currentPayment.status = "captured";
      currentPayment.razorpayPaymentId = paymentId;
      currentPayment.paidAt = now;
      currentPayment.failureReason = null;

      await currentPayment.save({ session });

      subscription.plan = currentPayment.plan;
      subscription.status = "active";
      subscription.billingInterval = currentPayment.billingInterval;
      subscription.currentPeriodStart = now;
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
        status: "captured",
        currentPeriodStart: now,
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

export async function recoverSubscriptionPayment({ organizationId, orderId }) {
  if (!orderId) {
    throw createServiceError(
      "Razorpay order ID is required",
      400,
      "ORDER_ID_REQUIRED",
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

  // Retrieve payment history directly from Razorpay.
  const razorpayPayments = await fetchRazorpayOrderPayments(orderId);

  // Only captured payments matching the expected amount and currency qualify.
  const matchingPayments = razorpayPayments.filter(
    (payment) =>
      payment.orderId === orderId &&
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
