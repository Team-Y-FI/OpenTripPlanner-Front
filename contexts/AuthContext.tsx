import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, api, tokenManager, type User as AuthUser } from '@/services';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as kakaoLogin, getProfile as kakaoGetProfile } from '@react-native-seoul/kakao-login';

export type User = AuthUser;

interface AuthContextType {
  user: User | null;
  /** 로그인/회원가입/자동 로그인 등 Auth 관련 로딩 */
  isAuthLoading: boolean;
  /** 앱 시작 시 토큰/유저 정보 초기화가 끝났는지 여부 확인용 */
  isBootstrapped: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  kakaoLoginHandler: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean>(false);

  /**
   * 앱 시작 시:
   * 1) 저장된 토큰이 있는지 확인
   * 2) 토큰이 있으면 /users/me 로 현재 사용자 정보를 가져와서 user 세팅
   */
  useEffect(() => {
    const bootstrapAuth = async () => {
      setIsAuthLoading(true);
      try {
        const accessToken = await tokenManager.getAccessToken();
        if (!accessToken) {
          setUser(null);
          return;
        }

        // 백엔드의 현재 사용자 정보 조회 엔드포인트
        const me = await api.get<User>('/users/me', { requiresAuth: true });
        setUser(me);
      } catch (error) {
        console.error('초기 인증 상태 확인 실패:', error);
        // 토큰이 유효하지 않으면 정리
        try {
          await tokenManager.clearTokens();
        } catch {
          // 무시
        }
        setUser(null);
      } finally {
        setIsBootstrapped(true);
        setIsAuthLoading(false);
      }
    };

    void bootstrapAuth();
  }, []);

  /**
   * 이메일/비밀번호 로그인
   */
  const login = async (email: string, password: string): Promise<boolean> => {
    setIsAuthLoading(true);
    try {
      const response = await authService.login({ email, password });
      setUser(response.user);
      return true;
    } catch (error) {
      console.error('로그인 실패:', error);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  /**
   * 이메일/비밀번호 회원가입
   */
  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    setIsAuthLoading(true);
    try {
      const response = await authService.register({ email, password, name });
      setUser(response.user);
      return true;
    } catch (error) {
      console.error('회원가입 실패:', error);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  /**
   * 카카오 로그인
   * 현재는 백엔드 연동 없이, 기기/개발 환경에서만 동작하는 mock 기반
   * 나중에 /auth/kakao 같은 엔드포인트가 생기면 이 부분에서 교체할 수 있음
   */
  const kakaoLoginHandler = async (): Promise<boolean> => {
    setIsAuthLoading(true);
    try {
      const token = await kakaoLogin();
      console.log('카카오 로그인 토큰:', token);

      const profile = await kakaoGetProfile();
      console.log('카카오 프로필:', profile);

      const userData: User = {
        user_id: profile.id ?? 0,
        email: profile.email || `kakao_${profile.id}@kakao.com`,
        name: profile.nickname || '카카오 사용자',
        created_at: new Date().toISOString(),
      };

      // 카카오 전용 로컬 유저 정보 저장 (백엔드 연동 전 임시)
      await AsyncStorage.setItem('user:kakao', JSON.stringify(userData));
      setUser(userData);

      return true;
    } catch (error: any) {
      console.error('카카오 로그인 실패:', error);

      // 개발 환경에서 네이티브 모듈이 없는 경우 mock 데이터 사용
      if (error?.code === 'ENOENT' || error?.message?.includes('Native module')) {
        console.log('카카오 SDK 설정 필요 - Mock 데이터 사용');
        const mockUserData: User = {
          user_id: 0,
          email: 'kakao_user@kakao.com',
          name: '카카오톡 사용자',
          created_at: new Date().toISOString(),
        };
        await AsyncStorage.setItem('user:kakao', JSON.stringify(mockUserData));
        setUser(mockUserData);
        return true;
      }

      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  /**
   * 로그아웃
   * 1) 백엔드 로그아웃 호출
   * 2) 토큰 및 로컬 사용자 정보 정리
   */
  const logout = async () => {
    setIsAuthLoading(true);
    try {
      await authService.logout();
    } catch (error) {
      console.error('로그아웃 실패:', error);
    } finally {
      try {
        await AsyncStorage.removeItem('user:kakao');
      } catch {
        // 무시
      }
      setUser(null);
      setIsAuthLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthLoading,
        isBootstrapped,
        login,
        signup,
        kakaoLoginHandler,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
