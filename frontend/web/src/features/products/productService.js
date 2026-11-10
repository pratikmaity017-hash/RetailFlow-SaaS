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

function getProductVariantsUrl(organizationId, productId) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  if (!productId) {
    throw new Error("Product ID is required.");
  }

  return `/api/organizations/${encodeURIComponent(organizationId)}/products/${encodeURIComponent(productId)}/variants`;
}

// Product APIs

export async function getProducts(organizationId) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  const response = await apiClient.get(
    `/api/organizations/${encodeURIComponent(organizationId)}/products`,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

export async function createProduct(organizationId, productData) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  const response = await apiClient.post(
    `/api/organizations/${encodeURIComponent(organizationId)}/products`,
    productData,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

export async function updateProduct(organizationId, productId, productData) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  if (!productId) {
    throw new Error("Product ID is required.");
  }

  const response = await apiClient.put(
    `/api/organizations/${encodeURIComponent(organizationId)}/products/${encodeURIComponent(productId)}`,
    productData,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

export async function deactivateProduct(organizationId, productId) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  if (!productId) {
    throw new Error("Product ID is required.");
  }

  const response = await apiClient.delete(
    `/api/organizations/${encodeURIComponent(organizationId)}/products/${encodeURIComponent(productId)}`,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

export async function reactivateProduct(organizationId, productId) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  if (!productId) {
    throw new Error("Product ID is required.");
  }

  const response = await apiClient.put(
    `/api/organizations/${encodeURIComponent(organizationId)}/products/${encodeURIComponent(productId)}`,
    { status: "active" },
    { headers: getAuthHeaders() },
  );

  return response.data;
}

// Product Variant APIs

export async function getProductVariants(organizationId, productId) {
  const url = getProductVariantsUrl(organizationId, productId);

  const response = await apiClient.get(url, {
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function createProductVariant(
  organizationId,
  productId,
  variantData,
) {
  const url = getProductVariantsUrl(organizationId, productId);

  const response = await apiClient.post(url, variantData, {
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function updateProductVariant(
  organizationId,
  productId,
  variantId,
  variantData,
) {
  const url = getProductVariantsUrl(organizationId, productId);

  if (!variantId) {
    throw new Error("Variant ID is required.");
  }

  const response = await apiClient.put(
    `${url}/${encodeURIComponent(variantId)}`,
    variantData,
    { headers: getAuthHeaders() },
  );

  return response.data;
}

export async function deactivateProductVariant(
  organizationId,
  productId,
  variantId,
) {
  const url = getProductVariantsUrl(organizationId, productId);

  if (!variantId) {
    throw new Error("Variant ID is required.");
  }

  const response = await apiClient.patch(
    `${url}/${encodeURIComponent(variantId)}/deactivate`,
    {},
    { headers: getAuthHeaders() },
  );

  return response.data;
}

export async function reactivateProductVariant(
  organizationId,
  productId,
  variantId,
) {
  return updateProductVariant(organizationId, productId, variantId, {
    status: "active",
  });
}
