import { apiRequest } from "../../services/api/apiClient";
import { getAccessToken } from "../../services/api/tokenStorage";

export async function getProducts(organizationId) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Authentication required. Please sign in again.");
  }

  return apiRequest(
    `/api/organizations/${encodeURIComponent(organizationId)}/products`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}
