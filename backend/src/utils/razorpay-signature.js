import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";

export function verifyRazorpayPaymentSignature({
  orderId,
  paymentId,
  signature,
}) {
  if (
    !orderId ||
    !paymentId ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return false;
  }

  if (!env.RAZORPAY_KEY_SECRET) {
    const error = new Error("Razorpay is not configured");
    error.statusCode = 503;
    error.code = "PAYMENT_GATEWAY_NOT_CONFIGURED";
    throw error;
  }

  const expectedSignature = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest();

  const receivedSignature = Buffer.from(signature, "hex");

  return (
    receivedSignature.length === expectedSignature.length &&
    timingSafeEqual(receivedSignature, expectedSignature)
  );
}
