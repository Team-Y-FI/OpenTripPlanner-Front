import React, { createContext, useContext, useEffect, useState } from "react";
import { authService, api, tokenManager, type User as AuthUser } from "@/services";

export type User = AuthUser;

interface AuthContextType {
  user: User | null;
  /** 로그인/회원가입/자동 로그인 등 Auth 관련 로딩 */
  isAuthLoading: boolean;
  /** 앱 시작 시 토큰/유저 부팅이 끝났는지 */
  isBootstrapped: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  sendVerification: (email: string) => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  signup: (userId: string, email: string, password: string, name: string) => Promise<boolean>;
  kakaoLoginHandler: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean>(false);

  useEffect(() => {
    const bootstrapAuth = async () => {
      setIsAuthLoading(true);
      try {
        const accessToken = await tokenManager.getAccessToken();
        if (!accessToken) {
          setUser(null);
          return;
        }

        try {
          const me = await api.get<User>("/users/me", { requiresAuth: true });
          setUser(me);
          return;
        } catch (error) {
          // access token 만료 가능 → refresh(쿠키 기반) 후 재조회
          try {
            await authService.refresh();
            const me = await api.get<User>("/users/me", { requiresAuth: true });
            setUser(me);
            return;
          } catch {
            await tokenManager.clearTokens();
            setUser(null);
          }
        }
      } finally {
        setIsBootstrapped(true);
        setIsAuthLoading(false);
      }
    };

    void bootstrapAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsAuthLoading(true);
    try {
      const me = await authService.login({ email, password });
      setUser(me);
      return true;
    } catch (error: any) {
      console.error("로그인 실패:", error?.message || error);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const sendVerification = async (email: string): Promise<boolean> => {
    setIsAuthLoading(true);
    try {
      await authService.sendVerification(email);
      return true;
    } catch (error: any) {
      console.error("인증코드 발송 실패:", error?.message || error);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const verifyEmailCode = async (email: string, code: string): Promise<boolean> => {
    setIsAuthLoading(true);
    try {
      await authService.verifyCode({ email, code });
      return true;
    } catch (error: any) {
      console.error("이메일 인증 실패:", error?.message || error);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signup = async (userId: string, email: string, password: string, name: string): Promise<boolean> => {
    setIsAuthLoading(true);
    try {
      await authService.register({ user_id: userId, email, password, name });

      // 가입 직후 자동 로그인
      const me = await authService.login({ email, password });
      setUser(me);
      return true;
    } catch (error: any) {
      console.error("회원가입 실패:", error?.message || error);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const kakaoLoginHandler = async (): Promise<boolean> => {
    // 백엔드에 /auth/kakao 같은 엔드포인트가 없어서 현재는 비활성화
    console.warn("Kakao login is not wired to backend yet.");
    return false;
  };

  const logout = async () => {
    setIsAuthLoading(true);
    try {
      await authService.logout();
    } catch (error) {
      console.error("로그아웃 실패:", error);
    } finally {
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
        sendVerification,
        verifyEmailCode,
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
