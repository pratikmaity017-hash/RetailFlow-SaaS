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
  const authorization = getRazorpayAuthorization();

  let response;

  try {
    response = await fetch(`${RAZORPAY_API_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        Authorization: authorization,
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
  } catch (cause) {
    const error = new Error("Razorpay order creation outcome is unknown");

    error.statusCode = 503;
    error.code = "RAZORPAY_ORDER_CREATION_OUTCOME_UNKNOWN";
    error.outcomeUnknown = true;
    error.cause = cause;

    throw error;
  }

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Razorpay order creation failed:", {
      status: response.status,
      code: result?.error?.code,
    });

    const outcomeUnknown = response.status >= 500;

    const error = new Error(
      outcomeUnknown
        ? "Razorpay order creation outcome is unknown"
        : "Unable to create payment order",
    );

    error.statusCode = outcomeUnknown ? 503 : 502;
    error.code = outcomeUnknown
      ? "RAZORPAY_ORDER_CREATION_OUTCOME_UNKNOWN"
      : "PAYMENT_ORDER_CREATION_FAILED";

    error.outcomeUnknown = outcomeUnknown;

    throw error;
  }

  if (
    !result?.id ||
    result.amount !== amountPaise ||
    result.currency !== currency
  ) {
    const error = new Error("Razorpay returned an invalid order response");

    error.statusCode = 502;
    error.code = "RAZORPAY_ORDER_RESPONSE_INVALID";
    error.outcomeUnknown = true;

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

export async function fetchRazorpayOrder(orderId) {
  if (!orderId || typeof orderId !== "string") {
    const error = new Error("Valid Razorpay order ID is required");
    error.statusCode = 400;
    error.code = "INVALID_RAZORPAY_ORDER_ID";
    throw error;
  }

  const response = await fetch(
    `${RAZORPAY_API_BASE_URL}/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: {
        Authorization: getRazorpayAuthorization(),
      },
      signal: AbortSignal.timeout(15000),
    },
  );

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error("Unable to retrieve Razorpay order");
    error.statusCode = 502;
    error.code = "RAZORPAY_ORDER_FETCH_FAILED";
    throw error;
  }

  return {
    id: result.id,
    receipt: result.receipt,
    notes: result.notes,
    status: result.status,
    attempts: result.attempts,
    amount: result.amount,
    amountPaid: result.amount_paid,
    amountDue: result.amount_due,
    currency: result.currency,
  };
}

export async function createRazorpayRefund({
  paymentId,
  amountPaise,
  currency = "INR",
  idempotencyKey,
  notes = {},
}) {
  if (
    !paymentId ||
    !idempotencyKey ||
    !Number.isSafeInteger(amountPaise) ||
    amountPaise <= 0 ||
    !currency
  ) {
    const error = new Error("Invalid refund request");
    error.statusCode = 400;
    error.code = "INVALID_REFUND_REQUEST";
    throw error;
  }
  const authorization = getRazorpayAuthorization();
  let response;

  try {
    response = await fetch(
      `${RAZORPAY_API_BASE_URL}/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "X-Refund-Idempotency": idempotencyKey,
        },
        body: JSON.stringify({
          amount: amountPaise,
          notes,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch (cause) {
    const error = new Error("Refund creation outcome is unknown", { cause });
    error.statusCode = 503;
    error.code = "PAYMENT_REFUND_OUTCOME_UNKNOWN";
    error.outcomeUnknown = true;
    throw error;
  }

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Razorpay refund creation failed:", {
      status: response.status,
      code: result?.error?.code,
    });

    const error = new Error("Unable to create payment refund");
    error.statusCode = response.status >= 500 ? 503 : 502;
    error.code =
      response.status >= 500
        ? "PAYMENT_REFUND_OUTCOME_UNKNOWN"
        : "PAYMENT_REFUND_CREATION_FAILED";
    error.outcomeUnknown = response.status >= 500;
    throw error;
  }

  if (
    typeof result?.id !== "string" ||
    typeof result?.currency !== "string" ||
    result.payment_id !== paymentId ||
    !Number.isSafeInteger(result.amount) ||
    !["pending", "processed", "failed"].includes(result.status)
  ) {
    const error = new Error(
      "Razorpay refund response is invalid or incomplete",
    );
    error.statusCode = 502;
    error.code = "PAYMENT_REFUND_RESPONSE_INVALID";
    error.outcomeUnknown = true;
    throw error;
  }

  return {
    id: result.id,
    paymentId: result.payment_id,
    amount: result.amount,
    currency: result.currency,
    status: result.status,
  };
}

export async function fetchRazorpayRefund(refundId) {
  if (!refundId || typeof refundId !== "string") {
    const error = new Error("Valid Razorpay refund ID is required");
    error.statusCode = 400;
    error.code = "INVALID_RAZORPAY_REFUND_ID";
    throw error;
  }

  const response = await fetch(
    `${RAZORPAY_API_BASE_URL}/refunds/${encodeURIComponent(refundId)}`,
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
    console.error("Razorpay refund fetch failed:", {
      status: response.status,
      code: result?.error?.code,
    });

    const error = new Error("Unable to retrieve Razorpay refund");
    error.statusCode = 502;
    error.code = "RAZORPAY_REFUND_FETCH_FAILED";
    throw error;
  }

  if (
    typeof result?.id !== "string" ||
    result.id !== refundId ||
    typeof result?.currency !== "string" ||
    !result?.payment_id ||
    !Number.isSafeInteger(result.amount) ||
    !["pending", "processed", "failed"].includes(result.status)
  ) {
    const error = new Error("Razorpay returned an invalid refund response");
    error.statusCode = 502;
    error.code = "RAZORPAY_REFUND_RESPONSE_INVALID";
    throw error;
  }

  return {
    id: result.id,
    paymentId: result.payment_id,
    amount: result.amount,
    currency: result.currency,
    status: result.status,
  };
}

export async function fetchRazorpayOrdersByReceipt(receipt) {
  if (!receipt || typeof receipt !== "string") {
    const error = new Error("Valid Razorpay receipt is required");
    error.statusCode = 400;
    error.code = "INVALID_RAZORPAY_RECEIPT";
    throw error;
  }

  const response = await fetch(
    `${RAZORPAY_API_BASE_URL}/orders?receipt=${encodeURIComponent(receipt)}&count=100`,
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
    const error = new Error("Unable to search Razorpay orders by receipt");
    error.statusCode = 502;
    error.code = "RAZORPAY_ORDER_SEARCH_FAILED";
    throw error;
  }

  return (result?.items || [])
    .filter((order) => order.receipt === receipt)
    .map((order) => ({
      id: order.id,
      receipt: order.receipt,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      attempts: order.attempts,
      amountPaid: order.amount_paid,
      amountDue: order.amount_due,
      notes: order.notes,
    }));
}
