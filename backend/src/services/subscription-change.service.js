import BillingPayment from "../models/billing-payment.model.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscription-plan.model.js";

import { env } from "../config/env.js";
import { createRazorpayOrder, fetchRazorpayOrder } from "./razorpay.service.js";
import { createServiceError } from "../utils/service-error.util.js";

import {
  acquireSubscriptionOperationLock,
  startSubscriptionOperationLockHeartbeat,
  releaseSubscriptionOperationLock,
} from "../utils/subscription-operation-lock.util.js";

function buildPlanChangeCheckout({ billingPayment, razorpayOrder, plan }) {
  return {
    payment: {
      id: billingPayment._id,
      type: billingPayment.paymentType,
      amountPaise: billingPayment.amountPaise,
      currency: billingPayment.currency,
      status: billingPayment.status,
    },

    checkout: {
      keyId: env.RAZORPAY_KEY_ID,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      plan: {
        code: plan.code,
        name: plan.name,
      },
      billingInterval: billingPayment.billingInterval,
      paymentType: "plan_change",
    },
  };
}

export async function requestSubscriptionPlanChange({
  organizationId,
  planCode,
  billingInterval,
}) {
  if (!["monthly", "yearly"].includes(billingInterval)) {
    throw createServiceError(
      400,
      "INVALID_BILLING_INTERVAL",
      "Billing interval must be monthly or yearly",
    );
  }

  const lock = await acquireSubscriptionOperationLock({
    organizationId,
    operation: "plan_change",
  });

  const heartbeat = startSubscriptionOperationLockHeartbeat(lock);

  try {
    const subscription = await Subscription.findOne({
      _id: lock.subscriptionId,
      organization: organizationId,
    }).populate("plan");

    await heartbeat.assertOwnership();

    if (!subscription || !subscription.plan) {
      throw createServiceError(
        404,
        "SUBSCRIPTION_NOT_FOUND",
        "Organization subscription was not found",
      );
    }

    if (subscription.plan.code === "free") {
      throw createServiceError(
        400,
        "FREE_PLAN_CHANGE_REQUIRES_CHECKOUT",
        "Upgrading from Free plan requires the payment checkout process",
      );
    }

    if (subscription.status !== "active") {
      throw createServiceError(
        400,
        "SUBSCRIPTION_NOT_ACTIVE",
        "Only active subscriptions can change plans",
      );
    }

    if (subscription.cancelAtPeriodEnd) {
      throw createServiceError(
        400,
        "SUBSCRIPTION_CANCELLATION_SCHEDULED",
        "Cannot change plan while subscription cancellation is scheduled",
      );
    }

    if (subscription.pendingChange) {
      throw createServiceError(
        409,
        "PLAN_CHANGE_ALREADY_PENDING",
        "A subscription plan change is already scheduled",
      );
    }

    if (
      !subscription.currentPeriodEnd ||
      subscription.currentPeriodEnd <= new Date()
    ) {
      throw createServiceError(
        400,
        "INVALID_BILLING_PERIOD",
        "A valid future billing period end date is required",
      );
    }

    const requestedPlan = await SubscriptionPlan.findOne({
      code: planCode,
      isActive: true,
    });

    if (!requestedPlan) {
      throw createServiceError(
        404,
        "SUBSCRIPTION_PLAN_NOT_FOUND",
        "Requested subscription plan is unavailable",
      );
    }

    const selectedPrice = requestedPlan.prices?.[billingInterval];

    if (
      !selectedPrice ||
      !Number.isSafeInteger(selectedPrice.amountPaise) ||
      selectedPrice.amountPaise <= 0
    ) {
      throw createServiceError(
        400,
        "PLAN_PRICE_UNAVAILABLE",
        "Requested billing interval is not configured for this plan",
      );
    }

    if (
      subscription.plan._id.equals(requestedPlan._id) &&
      subscription.billingInterval === billingInterval
    ) {
      throw createServiceError(
        400,
        "SAME_SUBSCRIPTION_PLAN",
        "You are already subscribed to this plan and billing interval",
      );
    }

    const unresolvedPayment = await BillingPayment.findOne({
      subscription: subscription._id,
      status: {
        $in: [
          "pending",
          "authorized",
          "cancellation_pending",
          "refund_pending",
        ],
      },
    });

    await heartbeat.assertOwnership();

    if (unresolvedPayment) {
      const isSamePlanChange =
        unresolvedPayment.paymentType === "plan_change" &&
        String(unresolvedPayment.plan) === String(requestedPlan._id) &&
        unresolvedPayment.billingInterval === billingInterval;

      // Reuse the existing Razorpay order for the same pending plan change.
      if (
        isSamePlanChange &&
        unresolvedPayment.status === "pending" &&
        unresolvedPayment.orderCreationStatus === "created" &&
        unresolvedPayment.razorpayOrderId
      ) {
        const razorpayOrder = await fetchRazorpayOrder(
          unresolvedPayment.razorpayOrderId,
        );

        await heartbeat.assertOwnership();

        const expectedNotes = {
          billingPaymentId: unresolvedPayment._id.toString(),
          organizationId: organizationId.toString(),
          planCode: requestedPlan.code,
          billingInterval,
          paymentType: "plan_change",
        };

        const notesMismatch = Object.entries(expectedNotes).some(
          ([key, value]) =>
            !value || razorpayOrder.notes?.[key] !== String(value),
        );

        if (
          razorpayOrder.id !== unresolvedPayment.razorpayOrderId ||
          razorpayOrder.receipt !== unresolvedPayment._id.toString() ||
          razorpayOrder.amount !== unresolvedPayment.amountPaise ||
          razorpayOrder.currency !== unresolvedPayment.currency ||
          notesMismatch
        ) {
          throw createServiceError(
            409,
            "RAZORPAY_ORDER_DETAILS_MISMATCH",
            "Existing Razorpay order details do not match. Manual review is required.",
          );
        }

        if (
          razorpayOrder.status !== "created" ||
          razorpayOrder.amountDue !== unresolvedPayment.amountPaise ||
          razorpayOrder.amountPaid !== 0
        ) {
          throw createServiceError(
            409,
            "PAYMENT_ORDER_NOT_CHECKOUT_READY",
            "Existing payment order is not available for another checkout attempt. Recover the payment first.",
          );
        }

        return buildPlanChangeCheckout({
          billingPayment: unresolvedPayment,
          razorpayOrder,
          plan: requestedPlan,
        });
      }

      throw createServiceError(
        409,
        "UNRESOLVED_PAYMENT_EXISTS",
        "Resolve the existing payment before changing the subscription plan",
      );
    }

    // Save the local payment record before creating the Razorpay order.
    let billingPayment;

    try {
      [billingPayment] = await BillingPayment.create([
        {
          organization: organizationId,
          subscription: subscription._id,
          plan: requestedPlan._id,
          paymentType: "plan_change",
          amountPaise: selectedPrice.amountPaise,
          currency: selectedPrice.currency || "INR",
          billingInterval,
          status: "pending",
          orderCreationStatus: "creating",
          gateway: "razorpay",
        },
      ]);
    } catch (error) {
      if (error.code === 11000) {
        throw createServiceError(
          409,
          "PLAN_CHANGE_PAYMENT_ALREADY_PENDING",
          "A payment is already being processed for this subscription",
        );
      }

      throw error;
    }

    let razorpayOrder;

    try {
      await heartbeat.assertOwnership();

      razorpayOrder = await createRazorpayOrder({
        amountPaise: billingPayment.amountPaise,
        currency: billingPayment.currency,
        receipt: billingPayment._id.toString(),
        notes: {
          billingPaymentId: billingPayment._id.toString(),
          organizationId: organizationId.toString(),
          planCode: requestedPlan.code,
          billingInterval,
          paymentType: "plan_change",
        },
      });
    } catch (error) {
      const outcomeUnknown = error.outcomeUnknown === true;

      await BillingPayment.updateOne(
        {
          _id: billingPayment._id,
          status: "pending",
          orderCreationStatus: "creating",
        },
        {
          $set: {
            orderCreationStatus: outcomeUnknown ? "unknown" : "failed",
            ...(outcomeUnknown
              ? {
                  failureReason: "RAZORPAY_ORDER_CREATION_OUTCOME_UNKNOWN",
                }
              : {
                  status: "failed",
                  failureReason:
                    error.code || "PLAN_CHANGE_ORDER_CREATION_FAILED",
                }),
          },
        },
      ).catch((saveError) => {
        console.error(
          "Could not update plan change payment state:",
          saveError.message,
        );
      });

      throw error;
    }

    const savedPayment = await BillingPayment.findOneAndUpdate(
      {
        _id: billingPayment._id,
        status: "pending",
        orderCreationStatus: "creating",
      },
      {
        $set: {
          razorpayOrderId: razorpayOrder.id,
          orderCreationStatus: "created",
          failureReason: null,
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!savedPayment) {
      await BillingPayment.updateOne(
        {
          _id: billingPayment._id,
          status: "pending",
        },
        {
          $set: {
            orderCreationStatus: "unknown",
            failureReason:
              "RAZORPAY_ORDER_CREATED_BUT_NOT_CONFIRMED_IN_DATABASE",
          },
        },
      ).catch(() => {});

      throw createServiceError(
        409,
        "PLAN_CHANGE_ORDER_SAVE_FAILED",
        "Payment order was created but could not be confirmed. Please recover the payment before retrying.",
      );
    }

    await heartbeat.assertOwnership();

    return buildPlanChangeCheckout({
      billingPayment: savedPayment,
      razorpayOrder,
      plan: requestedPlan,
    });
  } finally {
    heartbeat.stop();
    await releaseSubscriptionOperationLock(lock);
  }
}
