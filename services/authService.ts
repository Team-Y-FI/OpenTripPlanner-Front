import { api, tokenManager } from "./api";

export interface User {
  user_id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  user_id: string;
  email: string;
  password: string;
  name: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}

export interface TokenResponse {
  access_token: string;
}

export interface MessageResponse {
  message: string;
}

/**
 * Auth API (백엔드 기준)
 * - access_token: JSON 응답으로 전달
 * - refresh_token: HTTP-only 쿠키로만 관리
 */
export const authService = {
  sendVerification: async (email: string): Promise<MessageResponse> => {
    return api.post<MessageResponse>(
      "/auth/send-verification",
      { email },
      { requiresAuth: false },
    );
  },

  verifyCode: async (data: VerifyCodeRequest): Promise<MessageResponse> => {
    return api.post<MessageResponse>(
      "/auth/verify-code",
      data,
      { requiresAuth: false },
    );
  },

  register: async (data: RegisterRequest): Promise<MessageResponse> => {
    return api.post<MessageResponse>(
      "/auth/register",
      data,
      { requiresAuth: false },
    );
  },

  login: async (data: LoginRequest): Promise<User> => {
    const token = await api.post<TokenResponse>(
      "/auth/login",
      data,
      { requiresAuth: false },
    );

    await tokenManager.setAccessToken(token.access_token);

    // access token으로 현재 유저 조회
    return api.get<User>("/users/me", { requiresAuth: true });
  },

  refresh: async (): Promise<TokenResponse> => {
    const token = await api.post<TokenResponse>(
      "/auth/refresh",
      undefined,
      { requiresAuth: false },
    );

    await tokenManager.setAccessToken(token.access_token);
    return token;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post<MessageResponse>(
        "/auth/logout",
        undefined,
        { requiresAuth: true },
      );
    } finally {
      await tokenManager.clearTokens();
    }
  },
};

export default authService;
