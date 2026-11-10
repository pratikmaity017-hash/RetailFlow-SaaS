import apiClient from "../../services/api/apiClient";
import { getAccessToken } from "../../services/api/tokenStorage";

export async function getProducts(organizationId) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error("Authentication required. Please sign in again.");
  }

  const response = await apiClient.get(
    `/api/organizations/${encodeURIComponent(organizationId)}/products`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.data;
}
