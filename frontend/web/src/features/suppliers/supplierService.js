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

function getSuppliersUrl(organizationId) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  return `/api/organizations/${encodeURIComponent(organizationId)}/suppliers`;
}

// Get suppliers with search, status filter and pagination.
export async function getSuppliers(organizationId, params = {}) {
  const url = getSuppliersUrl(organizationId);

  const response = await apiClient.get(url, {
    headers: getAuthHeaders(),
    params,
  });

  return response.data;
}

// Get a single supplier.
export async function getSupplierById(organizationId, supplierId) {
  const url = getSuppliersUrl(organizationId);

  if (!supplierId) {
    throw new Error("Supplier ID is required.");
  }

  const response = await apiClient.get(
    `${url}/${encodeURIComponent(supplierId)}`,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Create a supplier.
export async function createSupplier(organizationId, supplierData) {
  const url = getSuppliersUrl(organizationId);

  const response = await apiClient.post(url, supplierData, {
    headers: getAuthHeaders(),
  });

  return response.data;
}

// Update supplier information.
export async function updateSupplier(organizationId, supplierId, supplierData) {
  const url = getSuppliersUrl(organizationId);

  if (!supplierId) {
    throw new Error("Supplier ID is required.");
  }

  const response = await apiClient.patch(
    `${url}/${encodeURIComponent(supplierId)}`,
    supplierData,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Activate or deactivate a supplier.
export async function updateSupplierStatus(organizationId, supplierId, status) {
  const url = getSuppliersUrl(organizationId);

  if (!supplierId) {
    throw new Error("Supplier ID is required.");
  }

  const response = await apiClient.patch(
    `${url}/${encodeURIComponent(supplierId)}/status`,
    { status },
    { headers: getAuthHeaders() },
  );

  return response.data;
}
