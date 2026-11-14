import BillingPayment from "../models/billing-payment.model.js";
import { createServiceError } from "../utils/service-error.util.js";

export async function getSubscriptionPaymentHistory({
  organizationId,
  page = 1,
  limit = 10,
}) {
  const skip = (page - 1) * limit;

  const filter = {
    organization: organizationId,
  };

  const [payments, total] = await Promise.all([
    BillingPayment.find(filter)
      .populate("plan", "code name")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    BillingPayment.countDocuments(filter),
  ]);

  return {
    payments: payments.map((payment) => ({
      id: payment._id,
      paymentType: payment.paymentType || "initial",

      plan: payment.plan
        ? {
            code: payment.plan.code,
            name: payment.plan.name,
          }
        : null,

      amountPaise: payment.amountPaise,
      currency: payment.currency,
      billingInterval: payment.billingInterval,
      status: payment.status,
      gateway: payment.gateway,

      transaction: {
        orderId: payment.razorpayOrderId || null,
        paymentId: payment.razorpayPaymentId || null,
      },

      paidAt: payment.paidAt,
      refundedAt: payment.refundedAt,
      createdAt: payment.createdAt,
    })),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}
