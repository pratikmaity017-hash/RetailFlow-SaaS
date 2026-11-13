import apiClient from "../../services/api/apiClient";
import { getAccessToken } from "../../services/api/tokenStorage";

// Retrieve organizations available to the logged-in user.
export async function getUserOrganizations() {
  const accessToken = getAccessToken();

  const response = await apiClient.get("/api/organizations", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

// Create a new organization.
export async function createOrganization(name) {
  const accessToken = getAccessToken();

  const response = await apiClient.post(
    "/api/organizations",
    { name },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.data;
}

// Retrieve active business categories.
export async function getBusinessCategories() {
  const response = await apiClient.get("/api/business-categories");

  return response.data;
}

// Save primary and additional business categories.
export async function updateOrganizationCategories(
  organizationId,
  primaryCategory,
  additionalCategories,
) {
  const accessToken = getAccessToken();

  const response = await apiClient.patch(
    `/api/organizations/${organizationId}/categories`,
    {
      primaryCategory,
      additionalCategories,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.data;
}

// Retrieve and verify the selected organization's context.
export async function getOrganizationContext(organizationId) {
  const accessToken = getAccessToken();

  const response = await apiClient.get(
    `/api/organizations/${organizationId}/context`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.data;
}
