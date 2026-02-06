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

export const authService = {
  sendVerification: async (email: string): Promise<MessageResponse> => {
    return api.post<MessageResponse>(
      "/auth/send-verification",
      { email },
      { requiresAuth: false },
    );
  },

  verifyCode: async (data: VerifyCodeRequest): Promise<MessageResponse> => {
    return api.post<MessageResponse>("/auth/verify-code", data, {
      requiresAuth: false,
    });
  },

  register: async (data: RegisterRequest): Promise<MessageResponse> => {
    return api.post<MessageResponse>("/auth/register", data, {
      requiresAuth: false,
    });
  },

  login: async (data: LoginRequest): Promise<User> => {
    const token = await api.post<TokenResponse>("/auth/login", data, {
      requiresAuth: false,
    });
    await tokenManager.setAccessToken(token.access_token);
    return api.get<User>("/users/me", { requiresAuth: true });
  },

  kakaoLogin: async (kakaoAccessToken: string): Promise<User> => {
    const token = await api.post<TokenResponse>(
      "/auth/kakao/token",
      { access_token: kakaoAccessToken },
      { requiresAuth: false },
    );
    await tokenManager.setAccessToken(token.access_token);
    return api.get<User>("/users/me", { requiresAuth: true });
  },

  // ✅ redirect_uri 함께 전달
  kakaoCallback: async (code: string, redirectUri?: string): Promise<User> => {
    const qs = new URLSearchParams({ code });
    if (redirectUri) qs.set("redirect_uri", redirectUri);

    const token = await api.get<TokenResponse>(
      `/auth/kakao/callback?${qs.toString()}`,
      { requiresAuth: false },
    );

    await tokenManager.setAccessToken(token.access_token);
    return api.get<User>("/users/me", { requiresAuth: true });
  },

  refresh: async (): Promise<TokenResponse> => {
    const token = await api.post<TokenResponse>("/auth/refresh", undefined, {
      requiresAuth: false,
    });
    await tokenManager.setAccessToken(token.access_token);
    return token;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post<MessageResponse>("/auth/logout", undefined, {
        requiresAuth: true,
      });
    } finally {
      await tokenManager.clearTokens();
    }
  },
};

export default authService;
