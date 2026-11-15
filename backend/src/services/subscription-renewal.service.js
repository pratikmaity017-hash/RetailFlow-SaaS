import BillingPayment from "../models/billing-payment.model.js";
import Subscription from "../models/subscription.model.js";

import { env } from "../config/env.js";
import {
  createRazorpayOrder,
  fetchRazorpayOrdersByReceipt,
} from "./razorpay.service.js";

import {
  acquireSubscriptionOperationLock,
  startSubscriptionOperationLockHeartbeat,
  releaseSubscriptionOperationLock,
} from "../utils/subscription-operation-lock.util.js";

function createServiceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function findExistingRazorpayOrder(billingPayment) {
  const receipt = billingPayment._id.toString();

  const orders = await fetchRazorpayOrdersByReceipt(receipt);

  const matchingOrders = orders.filter((order) => order.receipt === receipt);

  if (matchingOrders.length > 1) {
    throw createServiceError(
      "Multiple Razorpay orders found for this billing payment. Manual review is required.",
      409,
      "MULTIPLE_RAZORPAY_ORDERS_FOUND",
    );
  }

  if (matchingOrders.length === 0) {
    return null;
  }

  const order = matchingOrders[0];

  if (
    order.amount !== billingPayment.amountPaise ||
    order.currency !== billingPayment.currency ||
    order.notes?.billingPaymentId !== receipt
  ) {
    throw createServiceError(
      "Razorpay order details do not match the billing payment. Manual review is required.",
      409,
      "RAZORPAY_ORDER_DETAILS_MISMATCH",
    );
  }

  return order;
}

async function saveRazorpayOrder(billingPayment, razorpayOrder) {
  const savedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: billingPayment._id,
      status: "pending",
      orderCreationStatus: {
        $in: ["creating", "unknown"],
      },
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
    throw createServiceError(
      "Could not safely save the recovered Razorpay order.",
      409,
      "RENEWAL_PAYMENT_STATE_CHANGED",
    );
  }

  return savedPayment;
}

function buildRenewalCheckout({
  billingPayment,
  razorpayOrder,
  plan,
  billingInterval,
}) {
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

      billingInterval,
      paymentType: "renewal",
    },
  };
}

export async function createSubscriptionRenewal({
  organizationId,
  billingInterval,
}) {
  if (!["monthly", "yearly"].includes(billingInterval)) {
    throw createServiceError(
      "Invalid billing interval",
      400,
      "INVALID_BILLING_INTERVAL",
    );
  }

  const lock = await acquireSubscriptionOperationLock({
    organizationId,
    operation: "renewal",
  });

  const heartbeat = startSubscriptionOperationLockHeartbeat(lock);

  try {
    const subscription = await Subscription.findOne({
      _id: lock.subscriptionId,
      organization: organizationId,
    }).populate("plan", "code name isActive prices");

    await heartbeat.assertOwnership();

    if (!subscription) {
      throw createServiceError(
        "Organization subscription was not found",
        404,
        "SUBSCRIPTION_NOT_FOUND",
      );
    }

    if (!subscription.plan) {
      throw createServiceError(
        "Current subscription plan was not found",
        404,
        "SUBSCRIPTION_PLAN_NOT_FOUND",
      );
    }

    if (subscription.cancelAtPeriodEnd) {
      throw createServiceError(
        "Subscription cancellation is already scheduled. Resume the subscription before renewing.",
        409,
        "SUBSCRIPTION_CANCELLATION_SCHEDULED",
      );
    }

    if (subscription.plan.code === "free") {
      throw createServiceError(
        "Free plan does not require renewal",
        400,
        "FREE_PLAN_RENEWAL_NOT_REQUIRED",
      );
    }

    if (!subscription.plan.isActive) {
      throw createServiceError(
        "Current subscription plan is no longer available",
        409,
        "SUBSCRIPTION_PLAN_INACTIVE",
      );
    }

    if (!["active", "past_due", "expired"].includes(subscription.status)) {
      throw createServiceError(
        "Subscription is not eligible for renewal",
        409,
        "SUBSCRIPTION_NOT_ELIGIBLE_FOR_RENEWAL",
      );
    }

    if (!subscription.currentPeriodEnd) {
      throw createServiceError(
        "Subscription period end date is not configured",
        409,
        "SUBSCRIPTION_PERIOD_NOT_CONFIGURED",
      );
    }

    const selectedPrice = subscription.plan.prices?.[billingInterval];

    if (
      !selectedPrice ||
      !Number.isSafeInteger(selectedPrice.amountPaise) ||
      selectedPrice.amountPaise <= 0
    ) {
      throw createServiceError(
        "Selected plan price is not configured",
        400,
        "PLAN_PRICE_NOT_CONFIGURED",
      );
    }

    const existingPendingPayment = await BillingPayment.findOne({
      organization: organizationId,
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

    if (existingPendingPayment) {
      if (
        existingPendingPayment.paymentType === "renewal" &&
        (String(existingPendingPayment.plan) !==
          String(subscription.plan._id) ||
          existingPendingPayment.billingInterval !== billingInterval)
      ) {
        throw createServiceError(
          "A pending renewal checkout already exists with different billing details. Recover or resolve it before starting another renewal.",
          409,
          "PENDING_RENEWAL_DETAILS_MISMATCH",
        );
      }
      const canRecoverOrder =
        existingPendingPayment.paymentType === "renewal" &&
        existingPendingPayment.status === "pending" &&
        ["creating", "unknown"].includes(
          existingPendingPayment.orderCreationStatus,
        );

      if (canRecoverOrder) {
        const recoveredOrder = await findExistingRazorpayOrder(
          existingPendingPayment,
        );

        if (!recoveredOrder) {
          throw createServiceError(
            "Razorpay order is not yet visible. This payment remains pending and requires reconciliation.",
            503,
            "RAZORPAY_ORDER_RECONCILIATION_PENDING",
          );
        }

        const savedPayment = await saveRazorpayOrder(
          existingPendingPayment,
          recoveredOrder,
        );

        await heartbeat.assertOwnership();

        return buildRenewalCheckout({
          billingPayment: savedPayment,
          razorpayOrder: recoveredOrder,
          plan: subscription.plan,
          billingInterval: savedPayment.billingInterval,
        });
      }

      throw createServiceError(
        "A payment is already pending for this organization",
        409,
        "CHECKOUT_ALREADY_PENDING",
      );
    }

    const [billingPayment] = await BillingPayment.create([
      {
        organization: organizationId,
        subscription: subscription._id,
        plan: subscription.plan._id,
        paymentType: "renewal",
        amountPaise: selectedPrice.amountPaise,
        currency: selectedPrice.currency || "INR",
        billingInterval,
        status: "pending",
        orderCreationStatus: "creating",
        gateway: "razorpay",
      },
    ]);

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
          planCode: subscription.plan.code,
          billingInterval,
          paymentType: "renewal",
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
                  failureReason: error.code || "PAYMENT_ORDER_CREATION_FAILED",
                }),
          },
        },
      ).catch((saveError) => {
        console.error(
          "Could not update renewal order creation state:",
          saveError.message,
        );
      });

      throw error;
    }

    try {
      await saveRazorpayOrder(billingPayment, razorpayOrder);
    } catch (error) {
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

      throw error;
    }

    await heartbeat.assertOwnership();

    return buildRenewalCheckout({
      billingPayment,
      razorpayOrder,
      plan: subscription.plan,
      billingInterval,
    });
  } finally {
    heartbeat.stop();
    await releaseSubscriptionOperationLock(lock);
  }
}
