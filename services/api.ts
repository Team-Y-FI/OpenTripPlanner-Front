import AsyncStorage from "@react-native-async-storage/async-storage";

// .env에서 API URL 가져오기
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/otp";

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

type RefreshResponse = {
  access_token: string;
};

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
      const data = (await response.json().catch(() => null)) as RefreshResponse | null;
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
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) return headers;

    return {
      ...(headers as Record<string, string>),
      Authorization: `Bearer ${token}`,
    };
  } catch (error) {
    console.error("access_token 로드 실패:", error);
    return headers;
  }
}

/**
 * API 요청을 처리하는 기본 함수
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
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
      // refresh_token은 HTTP-only 쿠키로 관리 → 쿠키가 포함되도록 설정
      credentials: "include",
    });

  try {
    let response = await doFetch(requestHeaders);

    // 401: access token 만료 → refresh(쿠키 기반) 후 1회 재시도
    if (requiresAuth && response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryHeaders: HeadersInit = {
          ...(requestHeaders as Record<string, string>),
          Authorization: `Bearer ${newToken}`,
        };
        response = await doFetch(retryHeaders);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("API 요청 실패:", error);
    throw error;
  }
}

async function requestFormData<T>(endpoint: string, formData: FormData, options: RequestOptions = {}): Promise<T> {
  const { requiresAuth = true, headers = {}, ...restOptions } = options;

  let requestHeaders: HeadersInit = {
    ...headers,
  };

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

  try {
    let response = await doFetch(requestHeaders);

    if (requiresAuth && response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryHeaders: HeadersInit = {
          ...(requestHeaders as Record<string, string>),
          Authorization: `Bearer ${newToken}`,
        };
        response = await doFetch(retryHeaders);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("API 요청 실패:", error);
    throw error;
  }
}

/**
 * API 서비스 객체
 */
export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, { ...options, method: "GET" }),

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

  delete: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, { ...options, method: "DELETE" }),

  postFormData: <T>(endpoint: string, formData: FormData, options?: RequestOptions) =>
    requestFormData<T>(endpoint, formData, options),
};

/**
 * 토큰 관리 함수 (백엔드 기준: refresh_token은 쿠키로만 관리)
 */
export const tokenManager = {
  setAccessToken: async (token: string) => {
    try {
      await AsyncStorage.setItem("access_token", token);
    } catch (error) {
      console.error("access_token 저장 실패:", error);
      throw error;
    }
  },

  getAccessToken: async () => {
    try {
      return await AsyncStorage.getItem("access_token");
    } catch (error) {
      console.error("access_token 로드 실패:", error);
      return null;
    }
  },

  clearTokens: async () => {
    try {
      // 과거 구현 흔적(refresh_token)까지 함께 정리
      await AsyncStorage.multiRemove(["access_token", "refresh_token"]);
    } catch (error) {
      console.error("토큰 삭제 실패:", error);
      throw error;
    }
  },
};

export default api;
