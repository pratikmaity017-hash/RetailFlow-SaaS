import { verifyRazorpayWebhookSignature } from "../utils/razorpay-webhook-signature.js";

import { processRazorpayWebhook } from "../services/razorpay-webhook.service.js";

export async function handleRazorpayWebhook(req, res, next) {
  try {
    const rawBody = req.rawBody;
    const signature = req.headers["x-razorpay-signature"];

    const isValidSignature = verifyRazorpayWebhookSignature({
      rawBody,
      signature,
    });

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_WEBHOOK_SIGNATURE",
          message: "Webhook signature verification failed.",
        },
      });
    }

    const eventId = req.headers["x-razorpay-event-id"];
    const eventType = req.body?.event;
    const payload = req.body;

    const result = await processRazorpayWebhook({
      eventId,
      eventType,
      payload,
    });

    return res.status(200).json({
      success: true,
      message: "Razorpay webhook processed successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
