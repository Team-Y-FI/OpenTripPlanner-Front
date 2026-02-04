import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Toast from "react-native-toast-message";
import {
  authService,
  api,
  tokenManager,
  type User as AuthUser,
} from "@/services";
import { AuthExpiredError } from "@/services/api";

export type User = AuthUser;

interface AuthContextType {
  user: User | null;
  isAuthLoading: boolean;
  isBootstrapped: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  sendVerification: (email: string) => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  signup: (
    userId: string,
    email: string,
    password: string,
    name: string,
  ) => Promise<boolean>;
  kakaoLoginHandler: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isLikelyNetworkError(err: any): boolean {
  // 웹에서는 navigator.onLine이 어느 정도 도움 됨
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator &&
      navigator.onLine === false
    )
      return true;
  } catch {
    // ignore
  }

  const msg = String(err?.message || "");
  return (
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch") ||
    msg.includes("ECONN") ||
    msg.includes("timeout")
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean>(false);

  // ✅ “부트스트랩 자동 호출에서만 1회” 토스트 보장
  const shownSessionExpiredToastRef = useRef(false);
  const shownNetworkToastRef = useRef(false);
  const bootstrapRanRef = useRef(false); // (선택) StrictMode에서 effect 2번 실행 방지

  useEffect(() => {
    const bootstrapAuth = async () => {
      // StrictMode에서 effect가 2번 실행될 수 있어서, 원치 않으면 막아준다.
      if (bootstrapRanRef.current) return;
      bootstrapRanRef.current = true;

      setIsAuthLoading(true);
      try {
        /**
         * ✅ 메모리 access 구조에서는 access_token이 없을 수 있으니
         * accessToken 유무로 early return 하지 말고 /users/me만 시도한다.
         *
         * /users/me가 401이면 api.ts가 refresh 후 1회 재시도한다.
         */
        const me = await api.get<User>("/users/me", { requiresAuth: true });
        setUser(me);
      } catch (err: any) {
        // (A) 네트워크/오프라인: 토스트 1회만, 로그아웃/토큰 클리어는 하지 않음
        if (isLikelyNetworkError(err)) {
          if (!shownNetworkToastRef.current) {
            shownNetworkToastRef.current = true;
            Toast.show({
              type: "error",
              text1: "네트워크 확인",
              text2: "인터넷 연결을 확인해주세요.",
              position: "top",
              visibilityTime: 2500,
            });
          }
          return;
        }

        // (B) 세션 만료(refresh까지 실패): 토스트 1회 + 토큰/유저 정리
        const isExpired =
          err instanceof AuthExpiredError ||
          String(err?.message || "").includes("AUTH_EXPIRED");
        if (isExpired) {
          await tokenManager.clearTokens();
          setUser(null);

          if (!shownSessionExpiredToastRef.current) {
            shownSessionExpiredToastRef.current = true;
            Toast.show({
              type: "error",
              text1: "다시 로그인 필요",
              text2: "세션이 만료되었습니다.",
              position: "top",
              visibilityTime: 2500,
            });
          }
          return;
        }

        // 기타 예외는 보수적으로 비로그인 처리(원하면 여기서 토스트는 생략)
        setUser(null);
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

  const verifyEmailCode = async (
    email: string,
    code: string,
  ): Promise<boolean> => {
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

  const signup = async (
    userId: string,
    email: string,
    password: string,
    name: string,
  ): Promise<boolean> => {
    setIsAuthLoading(true);
    try {
      await authService.register({ user_id: userId, email, password, name });
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
