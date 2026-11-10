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
