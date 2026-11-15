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

function getInventoryBaseUrl(organizationId) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  return `/api/organizations/${encodeURIComponent(organizationId)}/inventory`;
}

function getVariantInventoryUrl(organizationId, productId, variantId) {
  if (!productId) {
    throw new Error("Product ID is required.");
  }

  if (!variantId) {
    throw new Error("Variant ID is required.");
  }

  return `/api/organizations/${encodeURIComponent(organizationId)}/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/inventory`;
}

// Get inventory for a specific product variant.
export async function getVariantInventory(
  organizationId,
  productId,
  variantId,
) {
  const url = getVariantInventoryUrl(organizationId, productId, variantId);

  const response = await apiClient.get(url, {
    headers: getAuthHeaders(),
  });

  return response.data;
}

// Adjust stock: stock_in, stock_out or adjustment.
export async function adjustStock(
  organizationId,
  productId,
  variantId,
  adjustmentData,
) {
  const url = getVariantInventoryUrl(organizationId, productId, variantId);

  const response = await apiClient.post(`${url}/adjustments`, adjustmentData, {
    headers: getAuthHeaders(),
  });

  return response.data;
}

// Get stock movement history for a specific variant.
export async function getStockMovements(
  organizationId,
  productId,
  variantId,
  page = 1,
  limit = 20,
) {
  const url = getVariantInventoryUrl(organizationId, productId, variantId);

  const response = await apiClient.get(`${url}/movements`, {
    headers: getAuthHeaders(),
    params: { page, limit },
  });

  return response.data;
}

// Get low-stock inventory for an organization.
export async function getLowStockInventory(
  organizationId,
  page = 1,
  limit = 20,
) {
  const url = getInventoryBaseUrl(organizationId);

  const response = await apiClient.get(`${url}/low-stock`, {
    headers: getAuthHeaders(),
    params: { page, limit },
  });

  return response.data;
}
