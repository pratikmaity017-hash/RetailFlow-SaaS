import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSubscription,
  getSubscriptionPlans,
  getSubscriptionUsage,
  getSubscriptionPayments,
  changeSubscriptionPlan,
  createSubscriptionCheckout,
  verifySubscriptionPayment,
  cancelSubscription,
  resumeSubscription,
  recoverSubscriptionPayment,
} from "../subscriptionService";
import { loadRazorpayCheckout } from "../razorpayCheckout";
import { getOrganizationContext } from "../../organization/organizationService";
import "./subscription.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(
    "en-IN",
    includeTime
      ? {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : { day: "numeric", month: "short", year: "numeric" },
  );
}

function formatPrice(amountPaise, currency = "INR") {
  if (typeof amountPaise !== "number") return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function label(value) {
  return value ? String(value).replaceAll("_", " ") : "Unknown";
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function UsageCard({ title, resource, icon, accent }) {
  if (!resource) return null;
  const used = resource.used ?? 0;
  const limit = resource.limit;
  const unlimited = resource.unlimited || limit === null;
  const percentage =
    unlimited || !limit ? 0 : Math.min((used / limit) * 100, 100);

  return (
    <article className={`sub-usage-card sub-usage-card--${accent}`}>
      <div className="sub-usage-card__top">
        <span className="sub-usage-card__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="sub-usage-card__caption">{title}</span>
      </div>
      <div className="sub-usage-card__numbers">
        <strong>{used.toLocaleString("en-IN")}</strong>
        <span>
          {unlimited ? "Unlimited" : `of ${limit.toLocaleString("en-IN")}`}
        </span>
      </div>
      <div className="sub-usage-card__track">
        <span style={{ width: `${percentage}%` }} />
      </div>
      <p>
        {unlimited
          ? "No usage limit on your plan"
          : `${resource.remaining ?? Math.max(limit - used, 0)} remaining`}
      </p>
    </article>
  );
}

function StatusPill({ status }) {
  const normalized = String(status || "unknown")
    .toLowerCase()
    .replaceAll("_", "-");
  return (
    <span className={`sub-status sub-status--${normalized}`}>
      {label(status)}
    </span>
  );
}

function ReceiptButton({ payment, organizationName }) {
  function printReceipt() {
    const receiptWindow = window.open("", "_blank", "width=760,height=850");
    if (!receiptWindow) {
      window.alert("Please allow pop-ups to print the receipt.");
      return;
    }

    const safe = (value) =>
      String(value ?? "—").replace(
        /[&<>"']/g,
        (char) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[char],
      );
    const receiptNumber =
      payment.receiptNumber ||
      payment.id ||
      payment._id ||
      payment.orderId ||
      "—";
    const amount = formatPrice(payment.amountPaise, payment.currency);
    const optionalRows = [
      ["Payment ID", payment.paymentId || payment.razorpayPaymentId],
      ["Order ID", payment.orderId],
      ["Payment type", label(payment.paymentType)],
    ].filter(([, value]) => value);

    receiptWindow.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>RetailFlow Payment Receipt</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;padding:42px;background:#f4f6fb}
.receipt{max-width:680px;margin:auto;background:#fff;padding:42px;border:1px solid #e5e9f2;border-radius:18px}
.brand{font-size:24px;font-weight:800;letter-spacing:-.7px;color:#2458d3}.muted{color:#68758b}
.top{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #e8ecf3;padding-bottom:26px}
h1{font-size:25px;margin:28px 0 8px}.amount{font-size:34px;font-weight:800;margin:12px 0 24px}
.row{display:flex;justify-content:space-between;gap:20px;padding:13px 0;border-bottom:1px solid #eef1f6;font-size:14px}
.row span:first-child{color:#68758b}.row strong{text-align:right;overflow-wrap:anywhere}
.footer{margin-top:30px;padding:18px;background:#f5f7fc;border-radius:12px;font-size:12px;color:#68758b;line-height:1.6}
@media print{body{background:#fff;padding:0}.receipt{border:0;border-radius:0;max-width:none;padding:20px}}
</style></head><body><main class="receipt">
<div class="top"><div><div class="brand">RetailFlow</div><div class="muted">Subscription billing</div></div><div style="text-align:right"><strong>PAYMENT RECEIPT</strong><div class="muted">${safe(formatDate(payment.createdAt))}</div></div></div>
<h1>Payment received</h1><div class="muted">${safe(organizationName || "Organization")}</div>
<div class="amount">${safe(amount)}</div>
<div class="row"><span>Receipt reference</span><strong>${safe(receiptNumber)}</strong></div>
<div class="row"><span>Plan</span><strong>${safe(payment.plan?.name || payment.planName || "Subscription")}</strong></div>
<div class="row"><span>Status</span><strong>${safe(label(payment.status))}</strong></div>
${optionalRows.map(([key, value]) => `<div class="row"><span>${safe(key)}</span><strong>${safe(value)}</strong></div>`).join("")}
<div class="footer">This receipt is generated from the payment information available in your RetailFlow account. Keep it for your records. For billing assistance, contact your organization administrator.</div>
</main><script>window.onload=()=>window.print();</script></body></html>`);
    receiptWindow.document.close();
  }

  return (
    <button type="button" className="sub-receipt-button" onClick={printReceipt}>
      View receipt <span aria-hidden="true">↗</span>
    </button>
  );
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [usage, setUsage] = useState(null);
  const [payments, setPayments] = useState([]);
  const [organizationName, setOrganizationName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [processingPlanCode, setProcessingPlanCode] = useState("");
  const [selectedBillingInterval, setSelectedBillingInterval] =
    useState("monthly");
  const [pendingRecoveryOrderId, setPendingRecoveryOrderId] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  const organizationId = localStorage.getItem(ORGANIZATION_STORAGE_KEY);

  const loadData = useCallback(
    async ({ initial = false } = {}) => {
      if (!organizationId) {
        setError("Select an organization to view subscription and billing.");
        setLoading(false);
        return;
      }

      if (initial) setLoading(true);
      else setRefreshing(true);
      setError("");

      try {
        const [
          subscriptionResponse,
          plansResponse,
          usageResponse,
          paymentsResponse,
          contextResponse,
        ] = await Promise.all([
          getSubscription(organizationId),
          getSubscriptionPlans(organizationId),
          getSubscriptionUsage(organizationId),
          getSubscriptionPayments(organizationId, { page: 1, limit: 10 }),
          getOrganizationContext(organizationId),
        ]);

        setSubscription(subscriptionResponse?.data ?? null);
        setPlans(plansResponse?.data?.plans ?? []);
        setUsage(usageResponse?.data?.resources ?? null);
        setPayments(paymentsResponse?.data?.payments ?? []);
        const context = contextResponse?.data;
        setUserRole(context?.membership?.role || "");
        setOrganizationName(context?.organization?.name || context?.name || "");
      } catch (err) {
        setError(errorMessage(err, "Unable to load subscription information."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [organizationId],
  );

  useEffect(() => {
    loadData({ initial: true });
  }, [loadData]);

  const currentPlan = subscription?.plan;
  const currentSubscription = subscription?.subscription;
  const isOwner = userRole === "owner";
  const isPaidPlan = currentPlan?.code !== "free";
  const cancellationScheduled = currentSubscription?.cancelAtPeriodEnd === true;

  const showToast = useCallback((type, message) => {
    setToast({ type, message, id: Date.now() });
  }, []);

  const runAction = useCallback(
    async (task, successMessage, fallbackMessage) => {
      setActionLoading(true);
      setToast(null);
      try {
        await task();
        await loadData();
        showToast("success", successMessage);
        return true;
      } catch (err) {
        showToast("error", errorMessage(err, fallbackMessage));
        return false;
      } finally {
        setActionLoading(false);
        setProcessingPlanCode("");
      }
    },
    [loadData, showToast],
  );

  function askConfirmation({
    title,
    message,
    confirmLabel,
    tone = "primary",
    onConfirm,
  }) {
    setConfirmation({ title, message, confirmLabel, tone, onConfirm });
  }

  async function handleCancelSubscription() {
    setConfirmation(null);
    await runAction(
      () => cancelSubscription(organizationId),
      "Cancellation scheduled. Your subscription remains active until the current period ends.",
      "Failed to schedule subscription cancellation.",
    );
  }

  async function handleResumeSubscription() {
    setConfirmation(null);
    await runAction(
      () => resumeSubscription(organizationId),
      "Your subscription has been resumed successfully.",
      "Failed to resume subscription.",
    );
  }

  async function handleRecoverPayment() {
    if (!isOwner || !pendingRecoveryOrderId) return;
    setConfirmation(null);
    const success = await runAction(
      () =>
        recoverSubscriptionPayment(organizationId, {
          orderId: pendingRecoveryOrderId,
        }),
      "Payment recovered and subscription information refreshed.",
      "Unable to recover payment. Please try again later.",
    );
    if (success) setPendingRecoveryOrderId("");
  }

  async function handleUpgradePlan(plan) {
    if (!isOwner || !organizationId) return;
    setProcessingPlanCode(plan.code);
    setActionLoading(true);
    setToast(null);

    try {
      const response = await createSubscriptionCheckout(
        organizationId,
        plan.code,
        selectedBillingInterval,
      );
      const checkoutData = response?.data?.checkout;
      if (
        !checkoutData?.keyId ||
        !checkoutData?.orderId ||
        !Number.isSafeInteger(checkoutData?.amount) ||
        checkoutData.amount <= 0 ||
        !checkoutData?.currency
      )
        throw new Error(
          "Invalid checkout information received from the server.",
        );

      await loadRazorpayCheckout();
      const razorpay = new window.Razorpay({
        key: checkoutData.keyId,
        amount: checkoutData.amount,
        currency: checkoutData.currency,
        name: "RetailFlow",
        description: `${checkoutData.plan?.name || plan.name} Subscription`,
        order_id: checkoutData.orderId,
        handler: async (paymentResponse) => {
          try {
            await verifySubscriptionPayment(organizationId, {
              orderId: paymentResponse.razorpay_order_id,
              paymentId: paymentResponse.razorpay_payment_id,
              signature: paymentResponse.razorpay_signature,
            });
            setPendingRecoveryOrderId("");
            await loadData();
            showToast(
              "success",
              "Payment verified. Your subscription is now updated.",
            );
          } catch (err) {
            setPendingRecoveryOrderId(
              paymentResponse.razorpay_order_id || checkoutData.orderId,
            );
            showToast(
              "error",
              `${errorMessage(err, "Payment verification failed.")} If money was deducted, use Recover Payment.`,
            );
          } finally {
            setProcessingPlanCode("");
            setActionLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessingPlanCode("");
            setActionLoading(false);
          },
        },
      });

      razorpay.on("payment.failed", (paymentResponse) => {
        showToast(
          "error",
          paymentResponse.error?.description ||
            "Payment failed. Please try again.",
        );
        setProcessingPlanCode("");
        setActionLoading(false);
      });
      razorpay.open();
    } catch (err) {
      showToast(
        "error",
        errorMessage(err, "Unable to start subscription checkout."),
      );
      setProcessingPlanCode("");
      setActionLoading(false);
    }
  }

  async function handleChangePlan(plan) {
    setConfirmation(null);
    setProcessingPlanCode(plan.code);
    await runAction(
      () =>
        changeSubscriptionPlan(
          organizationId,
          plan.code,
          selectedBillingInterval,
        ),
      `Your change to ${plan.name} has been scheduled for the end of the current billing period.`,
      "Unable to schedule plan change.",
    );
  }

  const selectedPlans = useMemo(
    () =>
      plans.map((plan) => ({
        ...plan,
        selectedPrice: plan.prices?.[selectedBillingInterval],
      })),
    [plans, selectedBillingInterval],
  );

  if (loading) {
    return (
      <div className="subscription-page">
        <div className="sub-loading">
          <span className="sub-loading__spinner" />
          Loading your billing workspace…
        </div>
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <div className="subscription-page">
        <div className="sub-error-panel">
          <span className="sub-eyebrow">BILLING WORKSPACE</span>
          <h2>We couldn't load your subscription</h2>
          <p>{error}</p>
          <button
            type="button"
            className="sub-button sub-button--primary"
            onClick={() => loadData({ initial: true })}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="subscription-page">
      <header className="sub-page-header">
        <div>
          <span className="sub-eyebrow">WORKSPACE SETTINGS / BILLING</span>
          <h1>
            Subscription <span>& Billing</span>
          </h1>
          <p>One clear view of your plan, usage and payment history.</p>
        </div>
        <button
          type="button"
          className="sub-refresh-button"
          onClick={() => loadData()}
          disabled={refreshing}
        >
          <span
            className={
              refreshing ? "sub-refresh-icon is-spinning" : "sub-refresh-icon"
            }
          >
            ↻
          </span>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {toast && (
        <div
          className={`sub-toast sub-toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          <span className="sub-toast__icon">
            {toast.type === "success" ? "✓" : "!"}
          </span>
          <p>{toast.message}</p>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="sub-inline-error" role="alert">
          {error}
        </div>
      )}

      <section className="sub-hero-card">
        <div className="sub-hero-card__glow sub-hero-card__glow--one" />
        <div className="sub-hero-card__glow sub-hero-card__glow--two" />
        <div className="sub-hero-card__content">
          <div className="sub-hero-card__topline">
            <span className="sub-hero-card__label">YOUR CURRENT PLAN</span>
            <StatusPill status={currentSubscription?.status} />
          </div>
          <div className="sub-hero-card__main">
            <div>
              <h2>{currentPlan?.name || "Free Plan"}</h2>
              <p>
                {currentPlan?.description ||
                  "Your organization's current subscription."}
              </p>
            </div>
            <div className="sub-hero-card__plan-mark" aria-hidden="true">
              RF<span>✦</span>
            </div>
          </div>
          <div className="sub-hero-card__meta">
            <div>
              <span>Billing cycle</span>
              <strong>
                {label(currentSubscription?.billingInterval || "none")}
              </strong>
            </div>
            <div>
              <span>Next billing</span>
              <strong>
                {formatDate(
                  currentSubscription?.nextBillingAt ||
                    currentSubscription?.currentPeriodEnd,
                )}
              </strong>
            </div>
            <div>
              <span>Renewal</span>
              <strong>
                {cancellationScheduled
                  ? "Ends this period"
                  : "Automatic, if applicable"}
              </strong>
            </div>
          </div>
          {isOwner && isPaidPlan && (
            <div className="sub-hero-card__actions">
              {cancellationScheduled ? (
                <button
                  className="sub-button sub-button--light"
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    askConfirmation({
                      title: "Resume subscription?",
                      message:
                        "Your subscription cancellation will be removed and the plan will continue under its existing billing schedule.",
                      confirmLabel: "Resume subscription",
                      onConfirm: handleResumeSubscription,
                    })
                  }
                >
                  Resume subscription
                </button>
              ) : (
                <button
                  className="sub-button sub-button--glass-danger"
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    askConfirmation({
                      title: "Cancel subscription?",
                      message: `Your ${currentPlan?.name || "paid"} plan will remain active until ${formatDate(currentSubscription?.currentPeriodEnd)}. It will not renew after that date.`,
                      confirmLabel: "Schedule cancellation",
                      tone: "danger",
                      onConfirm: handleCancelSubscription,
                    })
                  }
                >
                  Cancel subscription
                </button>
              )}
            </div>
          )}
        </div>
        <div className="sub-hero-card__side">
          <span className="sub-hero-card__side-label">PLAN STATUS</span>
          <strong>
            {cancellationScheduled
              ? "Cancellation scheduled"
              : label(currentSubscription?.status)}
          </strong>
          <span className="sub-hero-card__side-caption">
            {currentSubscription?.pendingChange
              ? "A plan change is scheduled"
              : "Managed by your organization owner"}
          </span>
        </div>
      </section>

      {currentSubscription?.pendingChange && (
        <section className="sub-pending-banner">
          <span className="sub-pending-banner__icon">↗</span>
          <div>
            <strong>Upcoming plan change</strong>
            <p>
              {currentSubscription.pendingChange.plan?.name} ·{" "}
              {label(currentSubscription.pendingChange.billingInterval)} ·
              Effective{" "}
              {formatDate(currentSubscription.pendingChange.effectiveAt)}
            </p>
          </div>
        </section>
      )}

      <section className="sub-section">
        <div className="sub-section-heading">
          <div>
            <span className="sub-eyebrow">AT A GLANCE</span>
            <h2>Resource usage</h2>
            <p>Monitor how much of your plan your team is using.</p>
          </div>
        </div>
        <div className="sub-usage-grid">
          <UsageCard
            title="Products"
            resource={usage?.products}
            icon="▦"
            accent="blue"
          />
          <UsageCard
            title="Team members"
            resource={usage?.staff}
            icon="♙"
            accent="violet"
          />
          <UsageCard
            title="Suppliers"
            resource={usage?.suppliers}
            icon="◇"
            accent="amber"
          />
          <UsageCard
            title="Customers"
            resource={usage?.customers}
            icon="◎"
            accent="teal"
          />
        </div>
      </section>

      <section className="sub-section">
        <div className="sub-section-heading sub-section-heading--plans">
          <div>
            <span className="sub-eyebrow">FIND YOUR FIT</span>
            <h2>Plans built for your business</h2>
            <p>
              Choose the billing cycle that works best for your organization.
            </p>
          </div>
          <div
            className="sub-billing-switch"
            role="group"
            aria-label="Billing interval"
          >
            <button
              type="button"
              className={
                selectedBillingInterval === "monthly" ? "is-active" : ""
              }
              onClick={() => setSelectedBillingInterval("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={
                selectedBillingInterval === "yearly" ? "is-active" : ""
              }
              onClick={() => setSelectedBillingInterval("yearly")}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="sub-plans-grid">
          {selectedPlans.map((plan, index) => {
            const isFree = plan.code === "free";
            const isCurrent =
              currentPlan?.code === plan.code &&
              (currentSubscription?.billingInterval ===
                selectedBillingInterval ||
                isFree);
            const price = plan.selectedPrice;
            const hasPrice =
              isFree ||
              (typeof price?.amountPaise === "number" && price.amountPaise > 0);
            const canChange =
              isOwner &&
              plan.isActive &&
              !isFree &&
              hasPrice &&
              !isCurrent &&
              !cancellationScheduled &&
              !currentSubscription?.pendingChange;
            return (
              <article
                className={`sub-plan-card ${index === 1 ? "sub-plan-card--featured" : ""}`}
                key={plan.id}
              >
                {index === 1 && (
                  <span className="sub-plan-card__ribbon">POPULAR CHOICE</span>
                )}
                <div className="sub-plan-card__head">
                  <span className="sub-plan-card__code">
                    {label(plan.code)}
                  </span>
                  <span
                    className={`sub-plan-card__availability ${plan.isActive ? "is-active" : ""}`}
                  >
                    {plan.isActive ? "Available" : "Unavailable"}
                  </span>
                </div>
                <h3>{plan.name}</h3>
                <p className="sub-plan-card__description">{plan.description}</p>
                <div className="sub-plan-card__price">
                  <strong>
                    {isFree
                      ? "Free"
                      : formatPrice(price?.amountPaise, price?.currency)}
                  </strong>
                  {!isFree && (
                    <span>
                      /{" "}
                      {selectedBillingInterval === "monthly" ? "month" : "year"}
                    </span>
                  )}
                </div>
                <div className="sub-plan-card__divider" />
                <div className="sub-plan-card__billing-note">
                  {selectedBillingInterval === "yearly"
                    ? "Billed annually"
                    : "Billed monthly"}
                </div>
                {isCurrent ? (
                  <div className="sub-plan-card__current">
                    ✓ Your current plan
                  </div>
                ) : isOwner && !isFree ? (
                  <button
                    type="button"
                    className={`sub-button ${index === 1 ? "sub-button--primary" : "sub-button--outline"}`}
                    disabled={!canChange || actionLoading}
                    onClick={() => {
                      if (isPaidPlan) {
                        askConfirmation({
                          title: `Schedule ${plan.name}?`,
                          message: `Your plan will change to ${plan.name} (${selectedBillingInterval}) at the end of your current billing period. Your current plan remains active until then.`,
                          confirmLabel: "Confirm plan change",
                          onConfirm: () => handleChangePlan(plan),
                        });
                      } else {
                        askConfirmation({
                          title: `Continue to ${plan.name}?`,
                          message: `You'll be redirected to Razorpay's secure checkout to pay ${formatPrice(price?.amountPaise, price?.currency)} for the ${selectedBillingInterval} plan.`,
                          confirmLabel: "Continue to checkout",
                          onConfirm: () => {
                            setConfirmation(null);
                            handleUpgradePlan(plan);
                          },
                        });
                      }
                    }}
                  >
                    {processingPlanCode === plan.code
                      ? "Processing…"
                      : isPaidPlan
                        ? "Change plan"
                        : "Upgrade plan"}
                  </button>
                ) : !isOwner && !isFree ? (
                  <p className="sub-plan-card__owner-note">
                    Ask your organization owner to change plans.
                  </p>
                ) : (
                  <span className="sub-plan-card__free-note">
                    Included as the starter option
                  </span>
                )}
                {!hasPrice && !isFree && (
                  <span className="sub-plan-card__owner-note">
                    Pricing is not configured for this billing cycle.
                  </span>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {pendingRecoveryOrderId && isOwner && (
        <section className="sub-recovery-card">
          <div>
            <span className="sub-eyebrow">PAYMENT NEEDS ATTENTION</span>
            <h3>Verify a recent payment</h3>
            <p>
              If money was deducted but your plan was not updated, you can ask
              RetailFlow to recover this payment.
            </p>
          </div>
          <button
            type="button"
            className="sub-button sub-button--primary"
            disabled={actionLoading}
            onClick={() =>
              askConfirmation({
                title: "Recover this payment?",
                message:
                  "RetailFlow will check the payment status with the payment provider and update your subscription if the payment was captured.",
                confirmLabel: "Recover payment",
                onConfirm: handleRecoverPayment,
              })
            }
          >
            Recover payment
          </button>
        </section>
      )}

      <section className="sub-section">
        <div className="sub-section-heading">
          <div>
            <span className="sub-eyebrow">YOUR TRANSACTIONS</span>
            <h2>Payment history</h2>
            <p>Recent subscription payments for this organization.</p>
          </div>
          <span className="sub-history-count">{payments.length} recent</span>
        </div>
        {payments.length === 0 ? (
          <div className="sub-empty-state">
            <span>▤</span>
            <h3>No payments yet</h3>
            <p>Your subscription transactions and receipts will appear here.</p>
          </div>
        ) : (
          <div className="sub-history-card">
            <div className="sub-history-table-wrap">
              <table className="sub-history-table">
                <thead>
                  <tr>
                    <th>TRANSACTION</th>
                    <th>DATE</th>
                    <th>TYPE</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id || payment._id}>
                      <td>
                        <strong>
                          {payment.plan?.name ||
                            payment.planName ||
                            "Subscription"}
                        </strong>
                        <span className="sub-table-subtext">
                          {payment.id || payment._id || "Payment"}
                        </span>
                      </td>
                      <td>{formatDate(payment.createdAt)}</td>
                      <td>{label(payment.paymentType)}</td>
                      <td className="sub-table-amount">
                        {formatPrice(payment.amountPaise, payment.currency)}
                      </td>
                      <td>
                        <StatusPill status={payment.status} />
                      </td>
                      <td>
                        <ReceiptButton
                          payment={payment}
                          organizationName={organizationName}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <footer className="sub-billing-footer">
        <span>🔒 Secure billing powered by Razorpay</span>
        <span>Subscription access is managed by your organization owner.</span>
      </footer>

      {confirmation && (
        <div
          className="sub-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !actionLoading)
              setConfirmation(null);
          }}
        >
          <section
            className="sub-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sub-confirm-title"
          >
            <button
              type="button"
              className="sub-modal-close"
              aria-label="Close dialog"
              onClick={() => setConfirmation(null)}
            >
              ×
            </button>
            <span
              className={`sub-confirm-modal__icon ${confirmation.tone === "danger" ? "is-danger" : ""}`}
            >
              {confirmation.tone === "danger" ? "!" : "?"}
            </span>
            <span className="sub-eyebrow">PLEASE CONFIRM</span>
            <h2 id="sub-confirm-title">{confirmation.title}</h2>
            <p>{confirmation.message}</p>
            <div className="sub-confirm-modal__actions">
              <button
                type="button"
                className="sub-button sub-button--outline"
                disabled={actionLoading}
                onClick={() => setConfirmation(null)}
              >
                Go back
              </button>
              <button
                type="button"
                className={`sub-button ${confirmation.tone === "danger" ? "sub-button--danger" : "sub-button--primary"}`}
                disabled={actionLoading}
                onClick={confirmation.onConfirm}
              >
                {actionLoading ? "Please wait…" : confirmation.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
