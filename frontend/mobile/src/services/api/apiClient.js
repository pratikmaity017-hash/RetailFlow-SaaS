const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export async function apiRequest(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error("API_BASE_URL is not configured.");
  }

  const url = `${API_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

  const headers = {
    Accept: "application/json",
    ...options.headers,
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Unable to connect to the server.");
  }

  const data =
    response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error?.message || "Something went wrong.");

    error.status = response.status;
    error.code = data?.error?.code || "REQUEST_FAILED";

    throw error;
  }

  return data;
}
