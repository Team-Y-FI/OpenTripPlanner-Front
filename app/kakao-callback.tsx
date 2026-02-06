import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import FullScreenLoader from "@/components/FullScreenLoader";
import { useAuth } from "@/contexts/AuthContext";
import * as AuthSession from "expo-auth-session";

export default function KakaoCallbackScreen() {
  const router = useRouter();
  const { kakaoCallbackHandler, isAuthLoading } = useAuth();
  const ranRef = useRef(false);

  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = typeof params.code === "string" ? params.code : undefined;
    const error = typeof params.error === "string" ? params.error : undefined;

    if (error) {
      Toast.show({
        type: "error",
        text1: "카카오 로그인 실패",
        text2: params.error_description
          ? String(params.error_description)
          : "카카오 인증에 실패했습니다.",
        position: "top",
        visibilityTime: 3000,
      });
      router.replace("/login");
      return;
    }

    if (!code) {
      Toast.show({
        type: "error",
        text1: "카카오 로그인 실패",
        text2: "인가 코드가 없습니다.",
        position: "top",
        visibilityTime: 3000,
      });
      router.replace("/login");
      return;
    }

    (async () => {
      const redirectUri = AuthSession.makeRedirectUri({
        path: "kakao-callback",
      });
      const ok = await kakaoCallbackHandler(code, redirectUri);
      if (ok) {
        router.replace("/(tabs)");
        return;
      }

      Toast.show({
        type: "error",
        text1: "카카오 로그인 실패",
        text2: "서버 로그인 처리에 실패했습니다.",
        position: "top",
        visibilityTime: 3000,
      });
      router.replace("/login");
    })();
  }, [
    kakaoCallbackHandler,
    params.code,
    params.error,
    params.error_description,
    router,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.title}>카카오 로그인 처리 중...</Text>
        <Text style={styles.subtitle}>잠시만 기다려주세요.</Text>
      </View>
      <FullScreenLoader visible={isAuthLoading} message="로그인 중..." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  subtitle: { marginTop: 8, fontSize: 14, color: "#64748b" },
});
