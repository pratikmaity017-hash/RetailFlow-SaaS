import apiClient from "../../services/api/apiClient";
import { getAccessToken } from "../../services/api/tokenStorage";

function getAuthHeaders() {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error("Authentication required. Please sign in again.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function getSubscriptionUrl(organizationId) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  return `/api/organizations/${encodeURIComponent(
    organizationId,
  )}/subscription`;
}

// Get current organization subscription.
export async function getSubscription(organizationId) {
  const response = await apiClient.get(getSubscriptionUrl(organizationId), {
    headers: getAuthHeaders(),
  });

  return response.data;
}

// Get available subscription plans.
export async function getSubscriptionPlans(organizationId) {
  const response = await apiClient.get(
    `${getSubscriptionUrl(organizationId)}/plans`,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Get organization resource usage.
export async function getSubscriptionUsage(organizationId) {
  const response = await apiClient.get(
    `${getSubscriptionUrl(organizationId)}/usage`,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Get subscription payment history.
export async function getSubscriptionPayments(organizationId, params = {}) {
  const response = await apiClient.get(
    `${getSubscriptionUrl(organizationId)}/payments`,
    {
      headers: getAuthHeaders(),
      params,
    },
  );

  return response.data;
}

// Schedule a subscription plan change.
export async function changeSubscriptionPlan(
  organizationId,
  planCode,
  billingInterval,
) {
  const response = await apiClient.post(
    `${getSubscriptionUrl(organizationId)}/change`,
    { planCode, billingInterval },
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Create checkout order for upgrading from Free to Paid.
export async function createSubscriptionCheckout(
  organizationId,
  planCode,
  billingInterval,
) {
  const response = await apiClient.post(
    `${getSubscriptionUrl(organizationId)}/checkout`,
    { planCode, billingInterval },
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Create renewal payment order.
export async function createSubscriptionRenewal(
  organizationId,
  billingInterval,
) {
  const response = await apiClient.post(
    `${getSubscriptionUrl(organizationId)}/renew`,
    { billingInterval },
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Verify Razorpay subscription payment.
export async function verifySubscriptionPayment(organizationId, paymentData) {
  const response = await apiClient.post(
    `${getSubscriptionUrl(organizationId)}/verify-payment`,
    paymentData,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Recover an unresolved subscription payment.
export async function recoverSubscriptionPayment(organizationId, paymentData) {
  const response = await apiClient.post(
    `${getSubscriptionUrl(organizationId)}/recover-payment`,
    paymentData,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Schedule subscription cancellation.
export async function cancelSubscription(organizationId) {
  const response = await apiClient.post(
    `${getSubscriptionUrl(organizationId)}/cancel`,
    {},
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Resume a subscription scheduled for cancellation.
export async function resumeSubscription(organizationId) {
  const response = await apiClient.post(
    `${getSubscriptionUrl(organizationId)}/resume`,
    {},
    { headers: getAuthHeaders() },
  );

  return response.data;
}
