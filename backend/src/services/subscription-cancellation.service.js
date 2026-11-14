import BillingPayment from "../models/billing-payment.model.js";
import Subscription from "../models/subscription.model.js";

import { createServiceError } from "../utils/service-error.util.js";

import {
  fetchRazorpayOrder,
  fetchRazorpayOrderPayments,
} from "./razorpay.service.js";

const CANCELLATION_FAILURE_REASON =
  "RENEWAL_CHECKOUT_ABANDONED_BY_SUBSCRIPTION_CANCELLATION";

export async function cancelOrganizationSubscription({ organizationId }) {
  const subscription = await Subscription.findOne({
    organization: organizationId,
  }).populate("plan", "code name");

  if (!subscription) {
    throw createServiceError(
      404,
      "SUBSCRIPTION_NOT_FOUND",
      "Subscription not found",
    );
  }

  if (subscription.plan?.code === "free") {
    throw createServiceError(
      400,
      "FREE_PLAN_CANCELLATION_NOT_REQUIRED",
      "Free plan does not require cancellation",
    );
  }

  if (subscription.status !== "active" || !subscription.currentPeriodEnd) {
    throw createServiceError(
      409,
      "SUBSCRIPTION_NOT_ACTIVE",
      "Only an active paid subscription can be cancelled",
    );
  }

  const now = new Date();

  if (subscription.currentPeriodEnd <= now) {
    throw createServiceError(
      409,
      "SUBSCRIPTION_PERIOD_ALREADY_ENDED",
      "The current subscription period has already ended",
    );
  }

  if (subscription.cancelAtPeriodEnd) {
    return {
      cancelAtPeriodEnd: true,
      canceledAt: subscription.canceledAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      alreadyCancelled: true,
    };
  }

  // Only unresolved renewal payments need special handling.
  const pendingRenewal = await BillingPayment.findOne({
    organization: organizationId,
    paymentType: "renewal",
    status: { $in: ["pending", "authorized"] },
  });

  if (pendingRenewal) {
    if (
      pendingRenewal.status !== "pending" ||
      !pendingRenewal.razorpayOrderId
    ) {
      throw createServiceError(
        409,
        "RENEWAL_PAYMENT_REQUIRES_REVIEW",
        "An existing renewal payment must be resolved before cancellation",
      );
    }

    // Atomically reserve the payment while checking Razorpay.
    const reservedPayment = await BillingPayment.findOneAndUpdate(
      {
        _id: pendingRenewal._id,
        status: "pending",
      },
      {
        $set: {
          status: "cancellation_pending",
        },
      },
      { new: true },
    );

    if (!reservedPayment) {
      throw createServiceError(
        409,
        "RENEWAL_PAYMENT_STATE_CHANGED",
        "Renewal payment changed. Please refresh and try again",
      );
    }

    let safeToAbandon = false;

    try {
      const [order, payments] = await Promise.all([
        fetchRazorpayOrder(pendingRenewal.razorpayOrderId),
        fetchRazorpayOrderPayments(pendingRenewal.razorpayOrderId),
      ]);

      safeToAbandon =
        order.status === "created" &&
        order.attempts === 0 &&
        order.amountPaid === 0 &&
        payments.length === 0;
    } catch (error) {
      await BillingPayment.updateOne(
        {
          _id: pendingRenewal._id,
          status: "cancellation_pending",
        },
        {
          $set: { status: "pending" },
        },
      );

      throw error;
    }

    if (!safeToAbandon) {
      await BillingPayment.updateOne(
        {
          _id: pendingRenewal._id,
          status: "cancellation_pending",
        },
        {
          $set: { status: "pending" },
        },
      );

      throw createServiceError(
        409,
        "RENEWAL_PAYMENT_REQUIRES_REVIEW",
        "A payment attempt exists for the renewal order. Resolve it before cancellation",
      );
    }

    const abandonedPayment = await BillingPayment.findOneAndUpdate(
      {
        _id: pendingRenewal._id,
        status: "cancellation_pending",
      },
      {
        $set: {
          status: "failed",
          failureReason: CANCELLATION_FAILURE_REASON,
        },
      },
      { new: true },
    );

    if (!abandonedPayment) {
      throw createServiceError(
        409,
        "RENEWAL_PAYMENT_STATE_CHANGED",
        "Renewal payment changed. Please refresh and try again",
      );
    }
  }

  const canceledAt = new Date();

  const updatedSubscription = await Subscription.findOneAndUpdate(
    {
      _id: subscription._id,
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { $gt: canceledAt },
    },
    {
      $set: {
        cancelAtPeriodEnd: true,
        canceledAt,
      },
    },
    { new: true },
  );

  if (!updatedSubscription) {
    throw createServiceError(
      409,
      "SUBSCRIPTION_CANCELLATION_CONFLICT",
      "Subscription changed. Please refresh and try again",
    );
  }

  return {
    cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
    canceledAt: updatedSubscription.canceledAt,
    currentPeriodEnd: updatedSubscription.currentPeriodEnd,
    alreadyCancelled: false,
  };
}

export async function resumeOrganizationSubscription({ organizationId }) {
  const now = new Date();

  const updatedSubscription = await Subscription.findOneAndUpdate(
    {
      organization: organizationId,
      status: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { $gt: now },
    },
    {
      $set: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    },
    { new: true },
  );

  if (!updatedSubscription) {
    throw createServiceError(
      409,
      "SUBSCRIPTION_CANCELLATION_NOT_REVERSIBLE",
      "Cancellation cannot be reversed. The subscription may already have ended",
    );
  }

  return {
    cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
    canceledAt: updatedSubscription.canceledAt,
    currentPeriodEnd: updatedSubscription.currentPeriodEnd,
  };
}
