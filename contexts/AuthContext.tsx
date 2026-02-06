import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import Toast from "react-native-toast-message";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";

import {
  authService,
  api,
  tokenManager,
  type User as AuthUser,
} from "@/services";
import { AuthExpiredError } from "@/services/api";

export type User = AuthUser;

// ✅ OAuth redirect 완료 처리 (iOS에서 특히 중요)
WebBrowser.maybeCompleteAuthSession();

const isExpoGo = Constants.appOwnership === "expo";

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
  kakaoCallbackHandler: (
    code: string,
    redirectUri?: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isLikelyNetworkError(err: any): boolean {
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

  const shownSessionExpiredToastRef = useRef(false);
  const shownNetworkToastRef = useRef(false);
  const bootstrapRanRef = useRef(false);

  useEffect(() => {
    const bootstrapAuth = async () => {
      if (bootstrapRanRef.current) return;
      bootstrapRanRef.current = true;

      setIsAuthLoading(true);
      try {
        const me = await api.get<User>("/users/me", { requiresAuth: true });
        setUser(me);
      } catch (err: any) {
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

  /**
   * ✅ Expo Go fallback: Web OAuth
   */
  const kakaoOAuthFallback = async (): Promise<boolean> => {
    const apiUrl = (
      process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/otp"
    ).replace(/\/$/, "");

    // ✅ 핵심: Expo Go에서 exp://8081 복귀(=Metro 의존)를 피하기 위해 useProxy 사용
    const redirectUri = AuthSession.makeRedirectUri({ path: "kakao-callback" });

    const startUrl = `${apiUrl}/auth/kakao/login?redirect_uri=${encodeURIComponent(redirectUri)}`;

    console.info("[auth] kakao oauth fallback redirectUri =", redirectUri);
    console.info("[auth] kakao oauth fallback startUrl =", startUrl);

    try {
      const result = await WebBrowser.openAuthSessionAsync(
        startUrl,
        redirectUri,
      );

      if (result.type !== "success" || !result.url) {
        Toast.show({
          type: "error",
          text1: "카카오 로그인 취소",
          text2: "로그인이 취소되었거나 실패했습니다.",
          position: "top",
          visibilityTime: 2500,
        });
        return false;
      }

      const u = new URL(result.url);
      const code = u.searchParams.get("code");
      const error = u.searchParams.get("error");

      if (error) {
        Toast.show({
          type: "error",
          text1: "카카오 로그인 실패",
          text2: String(error),
          position: "top",
          visibilityTime: 2500,
        });
        return false;
      }

      if (!code) {
        Toast.show({
          type: "error",
          text1: "카카오 로그인 실패",
          text2: "인가 코드가 없습니다.",
          position: "top",
          visibilityTime: 2500,
        });
        return false;
      }

      return await kakaoCallbackHandler(code, redirectUri);
    } catch (e: any) {
      console.error("[auth] kakao oauth fallback failed:", e?.message || e);
      Toast.show({
        type: "error",
        text1: "카카오 로그인 실패",
        text2: "OAuth 처리 중 오류가 발생했습니다.",
        position: "top",
        visibilityTime: 2500,
      });
      return false;
    }
  };

  const kakaoLoginHandler = async (): Promise<boolean> => {
    // web: 기존 redirect 방식 유지
    if (Platform.OS === "web") {
      const apiUrl = (
        process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/otp"
      ).replace(/\/$/, "");
      const loginUrl = `${apiUrl}/auth/kakao/login`;

      try {
        console.info("[auth] Kakao web redirect:", loginUrl);
        if (typeof window !== "undefined" && window?.location) {
          window.location.assign(loginUrl);
          return true;
        }
      } catch {
        // ignore
      }

      Toast.show({
        type: "error",
        text1: "카카오 로그인 실패",
        text2: "리다이렉트에 실패했습니다.",
        position: "top",
        visibilityTime: 2500,
      });
      return false;
    }

    // ✅ Expo Go: 네이티브 모듈 경로 절대 타지 않음
    if (isExpoGo) {
      return await kakaoOAuthFallback();
    }

    setIsAuthLoading(true);
    try {
      const KakaoLogin = await import("@react-native-seoul/kakao-login");
      const nativeLoginFn = (KakaoLogin as any)?.login;

      // dev client인데도 모듈이 없으면 fallback
      if (typeof nativeLoginFn !== "function") {
        return await kakaoOAuthFallback();
      }

      const token = await nativeLoginFn();
      const kakaoAccessToken =
        token?.accessToken || token?.access_token || token?.accessToken?.token;

      if (!kakaoAccessToken) throw new Error("Kakao access token is missing");

      const me = await authService.kakaoLogin(String(kakaoAccessToken));
      setUser(me);
      return true;
    } catch (error: any) {
      console.error("카카오 로그인 실패:", error?.message || error);
      if (String(error?.message || "").includes("null")) {
        return await kakaoOAuthFallback();
      }
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const kakaoCallbackHandler = async (
    code: string,
    redirectUri?: string,
  ): Promise<boolean> => {
    setIsAuthLoading(true);
    try {
      const me = await authService.kakaoCallback(code, redirectUri);
      setUser(me);
      return true;
    } catch (error: any) {
      console.error("카카오 콜백 처리 실패:", error?.message || error);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
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
        kakaoCallbackHandler,
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
