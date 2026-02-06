// /services/api.ts

// .env에서 API URL 가져오기
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/otp";

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

type RefreshResponse = {
  access_token: string;
};

/**
 * ✅ refresh까지 실패했을 때(=세션 만료) 구분용 에러
 */
export class AuthExpiredError extends Error {
  constructor(message = "AUTH_EXPIRED") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

/**
 * ✅ Access Token은 메모리(in-memory)에만 저장
 */
let inMemoryAccessToken: string | null = null;

/**
 * ✅ refresh 동시성 제어 (동시에 여러 요청이 401이어도 refresh는 1회만)
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) return null;

      const data = (await response
        .json()
        .catch(() => null)) as RefreshResponse | null;
      const token = data?.access_token;
      if (!token) return null;

      await tokenManager.setAccessToken(token);
      return token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function attachAccessToken(headers: HeadersInit): Promise<HeadersInit> {
  const token = await tokenManager.getAccessToken();
  if (!token) return headers;

  return {
    ...(headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };
}

/**
 * API 요청(JSON)
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { requiresAuth = true, headers = {}, ...restOptions } = options;

  let requestHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (requiresAuth) {
    requestHeaders = await attachAccessToken(requestHeaders);
  }

  const url = `${API_URL}${endpoint}`;

  const doFetch = (hdrs: HeadersInit) =>
    fetch(url, {
      ...restOptions,
      headers: hdrs,
      credentials: "include", // refresh_token 쿠키 포함
    });

  let response = await doFetch(requestHeaders);

  // ✅ 401이면 refresh 후 1회 재시도 (공통 처리)
  if (requiresAuth && response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      // ✅ refresh 실패 → 세션 만료로 간주
      throw new AuthExpiredError();
    }

    const retryHeaders: HeadersInit = {
      ...(requestHeaders as Record<string, string>),
      Authorization: `Bearer ${newToken}`,
    };
    response = await doFetch(retryHeaders);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `HTTP error! status: ${response.status}`,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

/**
 * API 요청(FormData)
 * - Content-Type을 직접 세팅하지 말 것(boundary 자동 처리)
 */
async function requestFormData<T>(
  endpoint: string,
  formData: FormData,
  options: RequestOptions = {},
): Promise<T> {
  const { requiresAuth = true, headers = {}, ...restOptions } = options;

  let requestHeaders: HeadersInit = { ...headers };

  if (requiresAuth) {
    requestHeaders = await attachAccessToken(requestHeaders);
  }

  const url = `${API_URL}${endpoint}`;

  const doFetch = (hdrs: HeadersInit) =>
    fetch(url, {
      ...restOptions,
      method: "POST",
      headers: hdrs,
      body: formData,
      credentials: "include",
    });

  let response = await doFetch(requestHeaders);

  if (requiresAuth && response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      throw new AuthExpiredError();
    }

    const retryHeaders: HeadersInit = {
      ...(requestHeaders as Record<string, string>),
      Authorization: `Bearer ${newToken}`,
    };
    response = await doFetch(retryHeaders);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `HTTP error! status: ${response.status}`,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

/**
 * API 서비스 객체
 */
export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, data?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  postFormData: <T>(
    endpoint: string,
    formData: FormData,
    options?: RequestOptions,
  ) => requestFormData<T>(endpoint, formData, options),
};

/**
 * ✅ 토큰 관리(메모리 only)
 * - refresh_token은 쿠키로만 관리됨
 * - access_token은 메모리에만 저장됨
 */
export const tokenManager = {
  setAccessToken: async (token: string) => {
    inMemoryAccessToken = token;
  },
  getAccessToken: async () => inMemoryAccessToken,
  clearTokens: async () => {
    inMemoryAccessToken = null;
  },
};

export default api;
