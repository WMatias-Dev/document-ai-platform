import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Helper seguro para formatar erros da API (incluindo objetos de validação Pydantic) para string pura
export function getErrorMessage(
  err: any,
  fallback: string = "Ocorreu um erro."
): string {
  if (!err) return fallback;

  const detail = err.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    // Array de erros do Pydantic v2: [{ loc: [...], msg: '...', type: '...' }]
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.msg) return item.msg;
        return JSON.stringify(item);
      })
      .join("; ");
  }

  if (detail && typeof detail === "object") {
    return detail.message || detail.msg || detail.detail || JSON.stringify(detail);
  }

  if (err.message && typeof err.message === "string") {
    return err.message;
  }

  return fallback;
}

// Interceptor para injeção automática do Bearer JWT
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("doc_ai_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor para logout automático ao receber 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const isAuthRoute =
        window.location.pathname.includes("/login") ||
        window.location.pathname.includes("/register");

      if (!isAuthRoute) {
        localStorage.removeItem("doc_ai_token");
        localStorage.removeItem("doc_ai_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
