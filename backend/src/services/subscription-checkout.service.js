import BillingPayment from "../models/billing-payment.model.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscription-plan.model.js";

import { env } from "../config/env.js";
import {
  createRazorpayOrder,
  fetchRazorpayOrdersByReceipt,
} from "./razorpay.service.js";

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
      "Multiple Razorpay orders found. Manual review is required.",
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
      "Razorpay order details do not match. Manual review is required.",
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
        $in: ["creating", "unknown", "created"],
      },
      $or: [
        { razorpayOrderId: razorpayOrder.id },
        { razorpayOrderId: null },
        { razorpayOrderId: { $exists: false } },
      ],
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

  if (savedPayment) {
    return savedPayment;
  }

  // Another request or webhook may already have saved this same order.
  const latestPayment = await BillingPayment.findById(billingPayment._id);

  if (
    latestPayment?.status === "pending" &&
    latestPayment.razorpayOrderId === razorpayOrder.id
  ) {
    return latestPayment;
  }

  throw createServiceError(
    "Could not safely save the Razorpay order.",
    409,
    "PAYMENT_ORDER_SAVE_CONFLICT",
  );
}

function buildCheckout({ billingPayment, plan }) {
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
      orderId: billingPayment.razorpayOrderId,
      amount: billingPayment.amountPaise,
      currency: billingPayment.currency,
      plan: {
        code: plan.code,
        name: plan.name,
      },
      billingInterval: billingPayment.billingInterval,
    },
  };
}

export async function createSubscriptionCheckout({
  organizationId,
  planCode,
  billingInterval,
}) {
  if (!["monthly", "yearly"].includes(billingInterval)) {
    throw createServiceError(
      "Invalid billing interval",
      400,
      "INVALID_BILLING_INTERVAL",
    );
  }

  const subscription = await Subscription.findOne({
    organization: organizationId,
  }).populate("plan", "code name isActive");

  if (!subscription) {
    throw createServiceError(
      "Organization subscription was not found",
      404,
      "SUBSCRIPTION_NOT_FOUND",
    );
  }

  if (subscription.status !== "active" || !subscription.plan?.isActive) {
    throw createServiceError(
      "Current subscription is not eligible for checkout",
      409,
      "SUBSCRIPTION_NOT_ELIGIBLE",
    );
  }

  if (subscription.plan.code !== "free") {
    throw createServiceError(
      "Paid subscription changes must use the plan change process",
      409,
      "PAID_SUBSCRIPTION_ALREADY_EXISTS",
    );
  }

  const requestedPlan = await SubscriptionPlan.findOne({
    code: planCode,
    isActive: true,
  });

  if (!requestedPlan) {
    throw createServiceError(
      "Selected subscription plan was not found",
      404,
      "SUBSCRIPTION_PLAN_NOT_FOUND",
    );
  }

  if (requestedPlan.code === "free") {
    throw createServiceError(
      "Free plan does not require checkout",
      400,
      "FREE_PLAN_DOES_NOT_REQUIRE_CHECKOUT",
    );
  }

  const selectedPrice = requestedPlan.prices?.[billingInterval];

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

  // Reuse an unresolved initial checkout instead of creating another order.
  const existingPendingPayment = await BillingPayment.findOne({
    organization: organizationId,
    status: { $in: ["pending", "authorized"] },
  }).populate("plan", "code name");

  if (existingPendingPayment) {
    const canRecover =
      existingPendingPayment.paymentType === "initial" &&
      existingPendingPayment.status === "pending" &&
      ["creating", "unknown", "created"].includes(
        existingPendingPayment.orderCreationStatus,
      );

    if (!canRecover) {
      throw createServiceError(
        "A payment is already pending for this organization",
        409,
        "CHECKOUT_ALREADY_PENDING",
      );
    }

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

    return buildCheckout({
      billingPayment: savedPayment,
      plan: existingPendingPayment.plan,
    });
  }

  // Save the local payment record before calling Razorpay.
  const billingPayment = await BillingPayment.create({
    organization: organizationId,
    subscription: subscription._id,
    plan: requestedPlan._id,
    paymentType: "initial",
    amountPaise: selectedPrice.amountPaise,
    currency: selectedPrice.currency || "INR",
    billingInterval,
    status: "pending",
    orderCreationStatus: "creating",
    gateway: "razorpay",
  });

  let razorpayOrder;

  try {
    razorpayOrder = await createRazorpayOrder({
      amountPaise: billingPayment.amountPaise,
      currency: billingPayment.currency,
      receipt: billingPayment._id.toString(),
      notes: {
        billingPaymentId: billingPayment._id.toString(),
        organizationId: organizationId.toString(),
        planCode: requestedPlan.code,
        billingInterval,
        paymentType: "initial",
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
        "Could not update initial checkout state:",
        saveError.message,
      );
    });

    if (!outcomeUnknown) {
      throw error;
    }

    // The request may have reached Razorpay even though no response arrived.
    const recoveredOrder = await findExistingRazorpayOrder(billingPayment);

    if (!recoveredOrder) {
      throw error;
    }

    const savedPayment = await saveRazorpayOrder(
      billingPayment,
      recoveredOrder,
    );

    return buildCheckout({
      billingPayment: savedPayment,
      plan: requestedPlan,
    });
  }

  let savedPayment;

  try {
    savedPayment = await saveRazorpayOrder(billingPayment, razorpayOrder);
  } catch (error) {
    await BillingPayment.updateOne(
      {
        _id: billingPayment._id,
        status: "pending",
      },
      {
        $set: {
          orderCreationStatus: "unknown",
          failureReason: "RAZORPAY_ORDER_CREATED_BUT_NOT_CONFIRMED_IN_DATABASE",
        },
      },
    ).catch(() => {});

    throw error;
  }

  return buildCheckout({
    billingPayment: savedPayment,
    plan: requestedPlan,
  });
}
