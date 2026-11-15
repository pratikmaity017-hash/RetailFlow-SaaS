import mongoose from "mongoose";

import BillingPayment from "../models/billing-payment.model.js";
import Subscription from "../models/subscription.model.js";

import { createServiceError } from "../utils/service-error.util.js";

import {
  fetchRazorpayOrder,
  fetchRazorpayOrderPayments,
} from "./razorpay.service.js";

import {
  acquireSubscriptionOperationLock,
  startSubscriptionOperationLockHeartbeat,
  releaseSubscriptionOperationLock,
} from "../utils/subscription-operation-lock.util.js";

const CANCELLATION_FAILURE_REASON =
  "RENEWAL_CHECKOUT_ABANDONED_BY_SUBSCRIPTION_CANCELLATION";

export async function cancelOrganizationSubscription({ organizationId }) {
  const lock = await acquireSubscriptionOperationLock({
    organizationId,
    operation: "cancellation",
  });

  const heartbeat = startSubscriptionOperationLockHeartbeat(lock);

  try {
    const subscription = await Subscription.findOne({
      _id: lock.subscriptionId,
      organization: organizationId,
    }).populate("plan", "code name");

    await heartbeat.assertOwnership();

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

    const pendingRenewal = await BillingPayment.findOne({
      organization: organizationId,
      paymentType: "renewal",
      status: {
        $in: ["pending", "authorized", "cancellation_pending"],
      },
    });

    await heartbeat.assertOwnership();

    if (pendingRenewal) {
      if (
        pendingRenewal.status === "authorized" ||
        !pendingRenewal.razorpayOrderId
      ) {
        throw createServiceError(
          409,
          "RENEWAL_PAYMENT_REQUIRES_REVIEW",
          "An existing renewal payment must be resolved before cancellation. Its Razorpay order is not safely identifiable.",
        );
      }

      if (pendingRenewal.status === "pending") {
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
          {
            returnDocument: "after",
          },
        );

        if (!reservedPayment) {
          throw createServiceError(
            409,
            "RENEWAL_PAYMENT_STATE_CHANGED",
            "Renewal payment changed. Please refresh and try again",
          );
        }
      }

      let safeToAbandon = false;

      try {
        await heartbeat.assertOwnership();

        const [order, payments] = await Promise.all([
          fetchRazorpayOrder(pendingRenewal.razorpayOrderId),
          fetchRazorpayOrderPayments(pendingRenewal.razorpayOrderId),
        ]);

        await heartbeat.assertOwnership();

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
            $set: {
              status: "pending",
            },
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
            $set: {
              status: "pending",
            },
          },
        );

        throw createServiceError(
          409,
          "RENEWAL_PAYMENT_REQUIRES_REVIEW",
          "A payment attempt exists for the renewal order. Resolve it before cancellation",
        );
      }
    }

    await heartbeat.assertOwnership();

    const canceledAt = new Date();
    const session = await mongoose.startSession();

    let updatedSubscription;

    try {
      await session.withTransaction(async () => {
        // Verify that the subscription has not changed since it was read.
        const currentSubscription = await Subscription.findOne({
          _id: subscription._id,
          organization: organizationId,
          status: "active",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }).session(session);

        if (!currentSubscription) {
          throw createServiceError(
            409,
            "SUBSCRIPTION_CANCELLATION_CONFLICT",
            "Subscription changed. Please refresh and try again",
          );
        }

        // Only finalize abandonment in the same transaction that
        // schedules subscription cancellation.
        if (pendingRenewal) {
          const abandonedPayment = await BillingPayment.findOneAndUpdate(
            {
              _id: pendingRenewal._id,
              organization: organizationId,
              status: "cancellation_pending",
              paymentType: "renewal",
            },
            {
              $set: {
                status: "failed",
                failureReason: CANCELLATION_FAILURE_REASON,
              },
            },
            {
              returnDocument: "after",
              session,
            },
          );

          if (!abandonedPayment) {
            throw createServiceError(
              409,
              "RENEWAL_PAYMENT_STATE_CHANGED",
              "Renewal payment changed. Cancellation was not completed",
            );
          }
        }

        currentSubscription.cancelAtPeriodEnd = true;
        currentSubscription.canceledAt = canceledAt;

        // Cancellation takes priority over any scheduled plan change.
        currentSubscription.pendingChange = null;

        await currentSubscription.save({ session });

        updatedSubscription = currentSubscription;
      });
    } finally {
      await session.endSession();
    }

    return {
      cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
      canceledAt: updatedSubscription.canceledAt,
      currentPeriodEnd: updatedSubscription.currentPeriodEnd,
      alreadyCancelled: false,
    };
  } finally {
    heartbeat.stop();
    await releaseSubscriptionOperationLock(lock);
  }
}

export async function resumeOrganizationSubscription({ organizationId }) {
  // Resume and cancellation use the same lock to prevent concurrent changes.
  const lock = await acquireSubscriptionOperationLock({
    organizationId,
    operation: "cancellation",
  });

  const heartbeat = startSubscriptionOperationLockHeartbeat(lock);

  try {
    await heartbeat.assertOwnership();

    const now = new Date();

    const updatedSubscription = await Subscription.findOneAndUpdate(
      {
        _id: lock.subscriptionId,
        organization: organizationId,
        status: "active",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: {
          $gt: now,
        },
      },
      {
        $set: {
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      },
      {
        returnDocument: "after",
      },
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
  } finally {
    heartbeat.stop();
    await releaseSubscriptionOperationLock(lock);
  }
}
