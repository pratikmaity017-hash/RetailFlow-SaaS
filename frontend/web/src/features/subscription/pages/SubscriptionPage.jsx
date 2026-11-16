import { useEffect, useState } from "react";
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
} from "../subscriptionService";
import { loadRazorpayCheckout } from "../razorpayCheckout";
import { getOrganizationContext } from "../../organization/organizationService";

import "./subscription.css";

const ORGANIZATION_STORAGE_KEY = "retailflow_selected_organization_id";

function formatDate(date) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(amountPaise, currency = "INR") {
  if (typeof amountPaise !== "number") return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function getStatusLabel(status) {
  if (!status) return "Unknown";

  return status.replaceAll("_", " ");
}

function UsageCard({ title, resource }) {
  if (!resource) return null;

  const used = resource.used ?? 0;
  const limit = resource.limit;
  const unlimited = resource.unlimited || limit === null;
  const percentage =
    unlimited || !limit ? 0 : Math.min((used / limit) * 100, 100);

  return (
    <div className="subscription-usage-card">
      <div className="subscription-usage-card__header">
        <h3>{title}</h3>
        <span>
          {used} / {unlimited ? "Unlimited" : limit}
        </span>
      </div>

      <div className="subscription-usage-progress">
        <div
          className="subscription-usage-progress__bar"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p>
        {unlimited
          ? "No usage limit"
          : `${resource.remaining ?? Math.max(limit - used, 0)} remaining`}
      </p>
    </div>
  );
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [usage, setUsage] = useState(null);
  const [payments, setPayments] = useState([]);
  const [userRole, setUserRole] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedBillingInterval, setSelectedBillingInterval] =
    useState("monthly");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function handleCancelSubscription() {
    const confirmed = window.confirm(
      "Your subscription will remain active until the current billing period ends. Continue?",
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setActionError("");
      setActionMessage("");

      await cancelSubscription(localStorage.getItem(ORGANIZATION_STORAGE_KEY));

      setActionMessage("Subscription cancellation scheduled successfully.");
      window.location.reload();
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Failed to cancel subscription.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResumeSubscription() {
    try {
      setActionLoading(true);
      setActionError("");
      setActionMessage("");

      await resumeSubscription(localStorage.getItem(ORGANIZATION_STORAGE_KEY));

      setActionMessage("Subscription resumed successfully.");
      window.location.reload();
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Failed to resume subscription.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpgradePlan(plan) {
    if (!isOwner) return;

    const organizationId = localStorage.getItem(ORGANIZATION_STORAGE_KEY);

    if (!organizationId) {
      setActionError("Please select an organization first.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");
      setActionMessage("");

      // Create a checkout order through our backend.
      const response = await createSubscriptionCheckout(
        organizationId,
        plan.code,
        selectedBillingInterval,
      );

      const checkoutData = response?.data?.checkout;

      if (
        !checkoutData?.keyId ||
        !checkoutData?.orderId ||
        !checkoutData?.amount
      ) {
        throw new Error("Invalid checkout information received.");
      }

      // Load Razorpay Checkout.js.
      await loadRazorpayCheckout();

      const razorpay = new window.Razorpay({
        key: checkoutData.keyId,
        amount: checkoutData.amount,
        currency: checkoutData.currency,
        name: "RetailFlow",
        description: `${checkoutData.plan?.name || plan.name} Subscription`,
        order_id: checkoutData.orderId,

        handler: async function (paymentResponse) {
          try {
            setActionLoading(true);

            await verifySubscriptionPayment(organizationId, {
              orderId: paymentResponse.razorpay_order_id,
              paymentId: paymentResponse.razorpay_payment_id,
              signature: paymentResponse.razorpay_signature,
            });

            window.location.reload();
          } catch (err) {
            setActionError(
              err.response?.data?.message ||
                err.message ||
                "Payment verification failed. Please contact support.",
            );
            setActionLoading(false);
          }
        },

        modal: {
          ondismiss: function () {
            setActionLoading(false);
          },
        },
      });

      razorpay.on("payment.failed", function (paymentResponse) {
        setActionError(
          paymentResponse.error?.description ||
            "Payment failed. Please try again.",
        );
        setActionLoading(false);
      });

      razorpay.open();
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          err.message ||
          "Unable to start subscription checkout.",
      );
      setActionLoading(false);
    }
  }

  async function handleChangePlan(plan) {
    if (!isOwner) return;

    const organizationId = localStorage.getItem(ORGANIZATION_STORAGE_KEY);

    if (!organizationId) {
      setActionError("Please select an organization first.");
      return;
    }

    const confirmed = window.confirm(
      `Schedule a change to ${plan.name} (${selectedBillingInterval})? This will take effect at the end of your current billing period.`,
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setActionError("");
      setActionMessage("");

      await changeSubscriptionPlan(
        organizationId,
        plan.code,
        selectedBillingInterval,
      );

      setActionMessage(
        "Plan change scheduled successfully. It will take effect at the end of your current billing period.",
      );

      window.location.reload();
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          err.message ||
          "Unable to schedule plan change.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadSubscriptionData() {
      const organizationId = localStorage.getItem(ORGANIZATION_STORAGE_KEY);

      if (!organizationId) {
        setError("Please select an organization first.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [
          subscriptionResponse,
          plansResponse,
          usageResponse,
          paymentsResponse,
          organizationContextResponse,
        ] = await Promise.all([
          getSubscription(organizationId),
          getSubscriptionPlans(organizationId),
          getSubscriptionUsage(organizationId),
          getSubscriptionPayments(organizationId, {
            page: 1,
            limit: 5,
          }),
          getOrganizationContext(organizationId),
        ]);

        if (!isMounted) return;

        setSubscription(subscriptionResponse?.data ?? null);
        setPlans(plansResponse?.data?.plans ?? []);
        setUsage(usageResponse?.data?.resources ?? null);
        setPayments(paymentsResponse?.data?.payments ?? []);
        setUserRole(organizationContextResponse?.data?.membership?.role || "");
      } catch (err) {
        if (!isMounted) return;

        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load subscription information.",
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSubscriptionData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="subscription-page">
        <div className="subscription-page__loading">
          Loading subscription information...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscription-page">
        <div className="subscription-page__error">
          <h2>Unable to load subscription</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const currentPlan = subscription?.plan;
  const currentSubscription = subscription?.subscription;

  const isOwner = userRole === "owner";
  const isPaidPlan = currentPlan?.code !== "free";
  const cancellationScheduled = currentSubscription?.cancelAtPeriodEnd === true;

  return (
    <div className="subscription-page">
      <div className="subscription-page__header">
        <div>
          <h1>Subscription & Billing</h1>
          <p>Manage your organization's plan, usage and billing information.</p>
        </div>
      </div>

      <section className="subscription-section">
        <div className="subscription-section__heading">
          <h2>Current Subscription</h2>
        </div>

        <div className="subscription-current-card">
          <div className="subscription-current-card__main">
            <div>
              <span className="subscription-label">Current Plan</span>
              <h2>{currentPlan?.name || "Unknown Plan"}</h2>
              <p>{currentPlan?.description || "No description available."}</p>
            </div>

            <span
              className={`subscription-status subscription-status--${currentSubscription?.status || "unknown"}`}
            >
              {getStatusLabel(currentSubscription?.status)}
            </span>
          </div>

          <div className="subscription-current-card__details">
            <div>
              <span className="subscription-label">Billing Interval</span>
              <strong>{currentSubscription?.billingInterval || "None"}</strong>
            </div>

            <div>
              <span className="subscription-label">Current Period Ends</span>
              <strong>
                {formatDate(currentSubscription?.currentPeriodEnd)}
              </strong>
            </div>

            <div>
              <span className="subscription-label">Next Billing Date</span>
              <strong>{formatDate(currentSubscription?.nextBillingAt)}</strong>
            </div>

            <div>
              <span className="subscription-label">Cancellation</span>
              <strong>
                {currentSubscription?.cancelAtPeriodEnd
                  ? "Scheduled"
                  : "Not scheduled"}
              </strong>
            </div>
          </div>

          {isOwner && isPaidPlan && (
            <div className="subscription-actions">
              {cancellationScheduled ? (
                <button
                  type="button"
                  className="subscription-action-button subscription-action-button--primary"
                  onClick={handleResumeSubscription}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Please wait..." : "Resume Subscription"}
                </button>
              ) : (
                <button
                  type="button"
                  className="subscription-action-button subscription-action-button--danger"
                  onClick={handleCancelSubscription}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Please wait..." : "Cancel Subscription"}
                </button>
              )}
            </div>
          )}

          {actionMessage && (
            <p className="subscription-action-message">{actionMessage}</p>
          )}

          {actionError && (
            <p className="subscription-action-error">{actionError}</p>
          )}

          {currentSubscription?.pendingChange && (
            <div className="subscription-pending-change">
              <strong>Upcoming Plan Change</strong>
              <p>
                {currentSubscription.pendingChange.plan?.name} (
                {currentSubscription.pendingChange.billingInterval})
              </p>
              <span>
                Effective:{" "}
                {formatDate(currentSubscription.pendingChange.effectiveAt)}
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="subscription-section">
        <div className="subscription-section__heading">
          <h2>Resource Usage</h2>
          <p>Track your organization's current resource consumption.</p>
        </div>

        <div className="subscription-usage-grid">
          <UsageCard title="Products" resource={usage?.products} />
          <UsageCard title="Staff Members" resource={usage?.staff} />
          <UsageCard title="Suppliers" resource={usage?.suppliers} />
          <UsageCard title="Customers" resource={usage?.customers} />
        </div>
      </section>

      <section className="subscription-section">
        <div className="subscription-section__heading">
          <h2>Available Plans</h2>
          <p>Explore the subscription plans available for your business.</p>
        </div>

        <div className="subscription-billing-selector">
          <span>Billing Interval</span>

          <div>
            <button
              type="button"
              className={
                selectedBillingInterval === "monthly" ? "is-selected" : ""
              }
              onClick={() => setSelectedBillingInterval("monthly")}
            >
              Monthly
            </button>

            <button
              type="button"
              className={
                selectedBillingInterval === "yearly" ? "is-selected" : ""
              }
              onClick={() => setSelectedBillingInterval("yearly")}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="subscription-plans-grid">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan?.code === plan.code;
            const isCurrentInterval =
              currentSubscription?.billingInterval === selectedBillingInterval;

            const isCurrentSelection = isCurrentPlan && isCurrentInterval;
            const isFree = plan.code === "free";

            const selectedPrice = plan.prices?.[selectedBillingInterval];
            const hasPrice =
              isFree ||
              (typeof selectedPrice?.amountPaise === "number" &&
                selectedPrice.amountPaise > 0);

            const canChangePlan =
              isOwner &&
              plan.isActive &&
              !isFree &&
              hasPrice &&
              !isCurrentSelection &&
              !cancellationScheduled &&
              !currentSubscription?.pendingChange;

            return (
              <article className="subscription-plan-card" key={plan.id}>
                <div>
                  <span className="subscription-label">{plan.code}</span>
                  <h3>{plan.name}</h3>
                  <p>{plan.description}</p>
                </div>

                <div className="subscription-plan-card__prices">
                  <div>
                    <strong>
                      {formatPrice(
                        plan.prices?.monthly?.amountPaise,
                        plan.prices?.monthly?.currency,
                      )}
                    </strong>
                    <span>/ month</span>
                  </div>

                  <div>
                    <strong>
                      {formatPrice(
                        plan.prices?.yearly?.amountPaise,
                        plan.prices?.yearly?.currency,
                      )}
                    </strong>
                    <span>/ year</span>
                  </div>
                </div>

                <span
                  className={`subscription-plan-card__availability ${
                    plan.isActive ? "is-active" : "is-inactive"
                  }`}
                >
                  {plan.isActive ? "Available" : "Unavailable"}
                </span>

                {isCurrentSelection && (
                  <span className="subscription-plan-current">
                    Current Plan
                  </span>
                )}

                {isOwner && !isFree && !isCurrentSelection && (
                  <button
                    type="button"
                    className="subscription-action-button subscription-action-button--primary"
                    disabled={!canChangePlan || actionLoading}
                    onClick={() =>
                      isPaidPlan
                        ? handleChangePlan(plan)
                        : handleUpgradePlan(plan)
                    }
                  >
                    {actionLoading
                      ? "Please wait..."
                      : isPaidPlan
                        ? "Change Plan"
                        : "Upgrade"}
                  </button>
                )}

                {!isOwner && !isCurrentSelection && !isFree && (
                  <p className="subscription-plan-owner-note">
                    Contact your organization owner to change plans.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="subscription-section">
        <div className="subscription-section__heading">
          <h2>Recent Payment History</h2>
          <p>Your organization's latest subscription payments.</p>
        </div>

        {payments.length === 0 ? (
          <div className="subscription-empty-state">
            No payment history available.
          </div>
        ) : (
          <div className="subscription-table-wrapper">
            <table className="subscription-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plan</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.createdAt)}</td>
                    <td>{payment.plan?.name || "—"}</td>
                    <td>{getStatusLabel(payment.paymentType)}</td>
                    <td>
                      {formatPrice(payment.amountPaise, payment.currency)}
                    </td>
                    <td>
                      <span
                        className={`subscription-status subscription-status--${payment.status}`}
                      >
                        {getStatusLabel(payment.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
