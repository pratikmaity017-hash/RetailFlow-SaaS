import { apiRequest } from "../../services/api/apiClient";
import { getAccessToken } from "../../services/api/tokenStorage";

// Retrieve organizations available to the logged-in user.
export async function getUserOrganizations() {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Authentication required. Please sign in again.");
  }

  return apiRequest("/api/organizations", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// Retrieve and verify the selected organization's context.
export async function getOrganizationContext(organizationId) {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Authentication required. Please sign in again.");
  }

  return apiRequest(
    `/api/organizations/${encodeURIComponent(organizationId)}/context`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}
