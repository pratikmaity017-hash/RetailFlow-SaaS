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

function getCustomersUrl(organizationId) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  return `/api/organizations/${encodeURIComponent(organizationId)}/customers`;
}

// Get customers with search, status filter and pagination.
export async function getCustomers(organizationId, params = {}) {
  const url = getCustomersUrl(organizationId);

  const response = await apiClient.get(url, {
    headers: getAuthHeaders(),
    params,
  });

  return response.data;
}

// Get a single customer.
export async function getCustomerById(organizationId, customerId) {
  const url = getCustomersUrl(organizationId);

  if (!customerId) {
    throw new Error("Customer ID is required.");
  }

  const response = await apiClient.get(
    `${url}/${encodeURIComponent(customerId)}`,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Create a customer.
export async function createCustomer(organizationId, customerData) {
  const url = getCustomersUrl(organizationId);

  const response = await apiClient.post(url, customerData, {
    headers: getAuthHeaders(),
  });

  return response.data;
}

// Update customer information.
export async function updateCustomer(organizationId, customerId, customerData) {
  const url = getCustomersUrl(organizationId);

  if (!customerId) {
    throw new Error("Customer ID is required.");
  }

  const response = await apiClient.put(
    `${url}/${encodeURIComponent(customerId)}`,
    customerData,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Deactivate a customer.
export async function deactivateCustomer(organizationId, customerId) {
  const url = getCustomersUrl(organizationId);

  if (!customerId) {
    throw new Error("Customer ID is required.");
  }

  const response = await apiClient.delete(
    `${url}/${encodeURIComponent(customerId)}`,
    { headers: getAuthHeaders() },
  );

  return response.data;
}
