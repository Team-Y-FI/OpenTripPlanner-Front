import AsyncStorage from "@react-native-async-storage/async-storage";

// .env에서 API URL 가져오기
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/otp";

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

/**
 * API 요청을 처리하는 기본 함수
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { requiresAuth = true, headers = {}, ...restOptions } = options;

  // 기본 헤더 설정
  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...headers,
  };

  // 인증이 필요한 경우 토큰 추가
  if (requiresAuth) {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (token) {
        (defaultHeaders as Record<string, string>)["Authorization"] =
          `Bearer ${token}`;
      }
    } catch (error) {
      console.error("토큰을 불러오는데 실패했습니다:", error);
    }
  }

  // API 요청
  const url = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: defaultHeaders,
    });

    // 응답 처리
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP error! status: ${response.status}`,
      );
    }

    // 204 No Content인 경우 빈 객체 반환
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * API 서비스 객체
 */
export const api = {
  /**
   * GET 요청
   */
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  /**
   * POST 요청
   */
  post: <T>(endpoint: string, data?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  /**
   * PUT 요청
   */
  put: <T>(endpoint: string, data?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  /**
   * PATCH 요청
   */
  patch: <T>(endpoint: string, data?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  /**
   * DELETE 요청
   */
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  /**
   * FormData POST 요청 (파일 업로드용)
   */
  postFormData: async <T>(
    endpoint: string,
    formData: FormData,
    options?: RequestOptions,
  ): Promise<T> => {
    const { requiresAuth = true, headers = {}, ...restOptions } = options || {};

    const defaultHeaders: HeadersInit = {
      ...headers,
    };

    // 인증이 필요한 경우 토큰 추가
    if (requiresAuth) {
      try {
        const token = await AsyncStorage.getItem("access_token");
        if (token) {
          (defaultHeaders as Record<string, string>)["Authorization"] =
            `Bearer ${token}`;
        }
      } catch (error) {
        console.error("토큰을 불러오는데 실패했습니다:", error);
      }
    }

    const url = `${API_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...restOptions,
        method: "POST",
        headers: defaultHeaders,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `HTTP error! status: ${response.status}`,
        );
      }

      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  },
};

/**
 * 토큰 관리 함수들
 */
export const tokenManager = {
  /**
   * 액세스 토큰 저장
   */
  setAccessToken: async (token: string) => {
    try {
      await AsyncStorage.setItem("access_token", token);
    } catch (error) {
      console.error("액세스 토큰 저장 실패:", error);
      throw error;
    }
  },

  /**
   * 리프레시 토큰 저장
   */
  setRefreshToken: async (token: string) => {
    try {
      await AsyncStorage.setItem("refresh_token", token);
    } catch (error) {
      console.error("리프레시 토큰 저장 실패:", error);
      throw error;
    }
  },

  /**
   * 액세스 토큰 가져오기
   */
  getAccessToken: async () => {
    try {
      return await AsyncStorage.getItem("access_token");
    } catch (error) {
      console.error("액세스 토큰 가져오기 실패:", error);
      return null;
    }
  },

  /**
   * 리프레시 토큰 가져오기
   */
  getRefreshToken: async () => {
    try {
      return await AsyncStorage.getItem("refresh_token");
    } catch (error) {
      console.error("리프레시 토큰 가져오기 실패:", error);
      return null;
    }
  },

  /**
   * 모든 토큰 삭제
   */
  clearTokens: async () => {
    try {
      await AsyncStorage.multiRemove(["access_token", "refresh_token"]);
    } catch (error) {
      console.error("토큰 삭제 실패:", error);
      throw error;
    }
  },
};

export default api;
