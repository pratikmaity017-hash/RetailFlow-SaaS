import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.message ||
      "Something went wrong.";

    const apiError = new Error(message);

    apiError.status = error.response?.status;
    apiError.code = error.response?.data?.error?.code || "REQUEST_FAILED";

    return Promise.reject(apiError);
  },
);

export default apiClient;
