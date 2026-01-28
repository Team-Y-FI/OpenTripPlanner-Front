import { api, tokenManager } from './api';

/**
 * 인증 관련 타입 정의
 */
export interface User {
  user_id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
}

/**
 * 인증 관련 API 서비스
 */
export const authService = {
  /**
   * 회원가입
   */
  register: async (data: RegisterRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/register', data, {
      requiresAuth: false,
    });

    // 토큰 저장
    await tokenManager.setAccessToken(response.tokens.access_token);
    await tokenManager.setRefreshToken(response.tokens.refresh_token);

    return response;
  },

  /**
   * 로그인
   */
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', data, {
      requiresAuth: false,
    });

    // 토큰 저장
    await tokenManager.setAccessToken(response.tokens.access_token);
    await tokenManager.setRefreshToken(response.tokens.refresh_token);

    return response;
  },

  /**
   * 토큰 갱신
   */
  refresh: async (): Promise<RefreshTokenResponse> => {
    const refreshToken = await tokenManager.getRefreshToken();

    if (!refreshToken) {
      throw new Error('리프레시 토큰이 없습니다.');
    }

    const response = await api.post<RefreshTokenResponse>(
      '/auth/refresh',
      { refresh_token: refreshToken },
      { requiresAuth: false }
    );

    // 새로운 액세스 토큰 저장
    await tokenManager.setAccessToken(response.access_token);

    return response;
  },

  /**
   * 로그아웃
   */
  logout: async (): Promise<void> => {
    const refreshToken = await tokenManager.getRefreshToken();

    if (refreshToken) {
      try {
        await api.post<{ ok: boolean }>(
          '/auth/logout',
          { refresh_token: refreshToken },
          { requiresAuth: true }
        );
      } catch (error) {
        console.error('로그아웃 API 호출 실패:', error);
      }
    }

    // 로컬 토큰 삭제
    await tokenManager.clearTokens();
  },
};

export default authService;
