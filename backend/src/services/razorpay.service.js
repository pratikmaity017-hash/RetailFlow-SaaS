import { env } from "../config/env.js";

const RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1";

function getRazorpayAuthorization() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    const error = new Error("Razorpay is not configured");
    error.statusCode = 503;
    error.code = "PAYMENT_GATEWAY_NOT_CONFIGURED";
    throw error;
  }

  const credentials = Buffer.from(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");

  return `Basic ${credentials}`;
}

export async function createRazorpayOrder({
  amountPaise,
  currency = "INR",
  receipt,
  notes = {},
}) {
  const response = await fetch(`${RAZORPAY_API_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      Authorization: getRazorpayAuthorization(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency,
      receipt,
      notes,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Razorpay order creation failed:", {
      status: response.status,
      code: result?.error?.code,
    });

    const error = new Error("Unable to create payment order");
    error.statusCode = 502;
    error.code = "PAYMENT_ORDER_CREATION_FAILED";
    throw error;
  }

  return {
    id: result.id,
    amount: result.amount,
    currency: result.currency,
    status: result.status,
  };
}

export async function fetchRazorpayPayment(paymentId) {
  const response = await fetch(
    `${RAZORPAY_API_BASE_URL}/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
      headers: {
        Authorization: getRazorpayAuthorization(),
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    },
  );

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Razorpay payment fetch failed:", {
      status: response.status,
      code: result?.error?.code,
    });

    const error = new Error("Unable to verify Razorpay payment");
    error.statusCode = 502;
    error.code = "PAYMENT_VERIFICATION_FAILED";
    throw error;
  }

  return {
    id: result.id,
    orderId: result.order_id,
    amount: result.amount,
    currency: result.currency,
    status: result.status,
    captured: result.captured,
  };
}

export async function fetchRazorpayOrderPayments(orderId) {
  if (!orderId || typeof orderId !== "string") {
    const error = new Error("Valid Razorpay order ID is required");
    error.statusCode = 400;
    error.code = "INVALID_RAZORPAY_ORDER_ID";
    throw error;
  }

  const response = await fetch(
    `${RAZORPAY_API_BASE_URL}/orders/${encodeURIComponent(orderId)}/payments`,
    {
      method: "GET",
      headers: {
        Authorization: getRazorpayAuthorization(),
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    },
  );

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Razorpay order payments fetch failed:", {
      status: response.status,
      code: result?.error?.code,
    });

    const error = new Error("Unable to retrieve order payments");
    error.statusCode = 502;
    error.code = "PAYMENT_RECOVERY_FAILED";
    throw error;
  }

  return (result?.items || []).map((payment) => ({
    id: payment.id,
    orderId: payment.order_id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    captured: payment.captured,
  }));
}
