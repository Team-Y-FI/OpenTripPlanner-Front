import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useNetwork } from "@/contexts/NetworkContext";
import Toast from "react-native-toast-message";
import FullScreenLoader from "@/components/FullScreenLoader";

const PASSWORD_POLICY = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

export default function SignupScreen() {
  const router = useRouter();
  const {
    signup,
    sendVerification,
    verifyEmailCode,
    kakaoLoginHandler,
    isAuthLoading,
  } = useAuth();
  const { isOnline } = useNetwork();

  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const passwordHelp = useMemo(() => {
    if (!password) return "";
    return PASSWORD_POLICY.test(password)
      ? ""
      : "비밀번호는 8자 이상, 영문/숫자/특수문자를 각각 1개 이상 포함해야 합니다.";
  }, [password]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/login");
  };

  const handleSendVerification = async () => {
    if (!isOnline) {
      Toast.show({
        type: "error",
        text1: "네트워크 오류",
        text2: "인터넷 연결을 확인해주세요.",
        position: "top",
        visibilityTime: 3000,
      });
      return;
    }

    if (!email) {
      Toast.show({
        type: "error",
        text1: "입력 오류",
        text2: "이메일을 입력해주세요.",
        position: "top",
        visibilityTime: 3000,
      });
      return;
    }

    const ok = await sendVerification(email);
    if (ok) {
      setIsCodeSent(true);
      setIsEmailVerified(false);
      Toast.show({
        type: "success",
        text1: "인증코드 발송",
        text2: "이메일로 인증코드를 확인해주세요.",
        position: "top",
        visibilityTime: 2500,
      });
    } else {
      Toast.show({
        type: "error",
        text1: "발송 실패",
        text2: "인증코드 발송에 실패했습니다.",
        position: "top",
        visibilityTime: 3000,
      });
    }
  };

  const handleVerifyCode = async () => {
    if (!isOnline) {
      Toast.show({
        type: "error",
        text1: "네트워크 오류",
        text2: "인터넷 연결을 확인해주세요.",
        position: "top",
        visibilityTime: 3000,
      });
      return;
    }

    if (!email || verificationCode.length !== 6) {
      Toast.show({
        type: "error",
        text1: "입력 오류",
        text2: "이메일과 6자리 인증코드를 입력해주세요.",
        position: "top",
        visibilityTime: 3000,
      });
      return;
    }

    const ok = await verifyEmailCode(email, verificationCode);
    if (ok) {
      setIsEmailVerified(true);
      Toast.show({
        type: "success",
        text1: "인증 완료",
        text2: "이메일 인증이 완료되었습니다.",
        position: "top",
        visibilityTime: 2000,
      });
    } else {
      setIsEmailVerified(false);
      Toast.show({
        type: "error",
        text1: "인증 실패",
        text2: "인증코드가 올바르지 않거나 만료되었습니다.",
        position: "top",
        visibilityTime: 3000,
      });
    }
  };

  const handleSignup = async () => {
    if (!isOnline) {
      Toast.show({
        type: "error",
        text1: "네트워크 오류",
        text2: "인터넷 연결을 확인해주세요.",
        position: "top",
        visibilityTime: 3000,
      });
      return;
    }

    if (!userId || !name || !email || !password || !confirmPassword) {
      Toast.show({
        type: "error",
        text1: "입력 오류",
        text2: "모든 항목을 입력해주세요.",
        position: "top",
        visibilityTime: 3000,
      });
      return;
    }

    if (!PASSWORD_POLICY.test(password)) {
      Toast.show({
        type: "error",
        text1: "비밀번호 오류",
        text2: "비밀번호 정책을 확인해주세요.",
        position: "top",
        visibilityTime: 3000,
      });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({
        type: "error",
        text1: "비밀번호 오류",
        text2: "비밀번호가 일치하지 않습니다.",
        position: "top",
        visibilityTime: 3000,
      });
      return;
    }

    if (!isEmailVerified) {
      Toast.show({
        type: "error",
        text1: "이메일 인증 필요",
        text2: "회원가입 전에 이메일 인증을 완료해주세요.",
        position: "top",
        visibilityTime: 3000,
      });
      return;
    }

    const ok = await signup(userId, email, password, name);
    if (ok) {
      Toast.show({
        type: "success",
        text1: "회원가입 완료",
        text2: `${name}님 환영합니다!`,
        position: "top",
        visibilityTime: 2000,
      });
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 500);
    } else {
      Toast.show({
        type: "error",
        text1: "회원가입 실패",
        text2: "회원가입에 실패했습니다. 입력값/인증 상태를 확인해주세요.",
        position: "top",
        visibilityTime: 3000,
      });
    }
  };

  const handleKakaoLogin = async () => {
    const ok = await kakaoLoginHandler();
    if (!ok) {
      Toast.show({
        type: "error",
        text1: "카카오 로그인 미지원",
        text2: "현재 백엔드 연동이 되어 있지 않습니다.",
        position: "top",
        visibilityTime: 2500,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>회원가입</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.logoSection}>
            <LinearGradient
              colors={["#6366f1", "#0ea5e9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoCircle}
            >
              <Text style={styles.logoText}>O</Text>
            </LinearGradient>
            <Text style={styles.welcomeText}>
              OpenTripPlanner에 오신 것을 환영합니다
            </Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>User ID</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#64748b"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="user_id"
                  placeholderTextColor="#94a3b8"
                  value={userId}
                  onChangeText={setUserId}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>이름</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="id-card-outline"
                  size={20}
                  color="#64748b"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="이름"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>이메일</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#64748b"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="example@email.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setIsEmailVerified(false);
                  }}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSendVerification}
              disabled={isAuthLoading}
            >
              <Text style={styles.secondaryButtonText}>
                {isCodeSent ? "인증코드 재발송" : "인증코드 보내기"}
              </Text>
            </TouchableOpacity>

            {isCodeSent && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>인증코드</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="key-outline"
                      size={20}
                      color="#64748b"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="6자리 인증코드"
                      placeholderTextColor="#94a3b8"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleVerifyCode}
                  disabled={isAuthLoading}
                >
                  <Text style={styles.secondaryButtonText}>
                    {isEmailVerified ? "인증 완료" : "인증하기"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#64748b"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="비밀번호"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
              {!!passwordHelp && (
                <Text style={styles.helpText}>{passwordHelp}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호 확인</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#64748b"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="비밀번호 확인"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.signupButton}
              onPress={handleSignup}
              disabled={isAuthLoading}
            >
              <LinearGradient
                colors={["#6366f1", "#0ea5e9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.signupGradient}
              >
                <Text style={styles.signupButtonText}>회원가입</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>또는</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={styles.kakaoButton}
              onPress={handleKakaoLogin}
              disabled={isAuthLoading}
            >
              <View style={styles.kakaoButtonContent}>
                <Text style={styles.kakaoIcon}>K</Text>
                <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.loginSection}>
              <Text style={styles.loginText}>이미 계정이 있으신가요?</Text>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text style={styles.loginLink}>로그인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FullScreenLoader visible={isAuthLoading} message="처리 중..." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
  },
  welcomeText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },
  formSection: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 15,
    color: "#0f172a",
  },
  helpText: {
    marginTop: 8,
    fontSize: 12,
    color: "#ef4444",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  signupButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signupGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
  },
  kakaoButton: {
    backgroundColor: "#FEE500",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  kakaoButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  kakaoIcon: {
    fontSize: 16,
    fontWeight: "700",
  },
  kakaoButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000000",
    opacity: 0.85,
  },
  loginSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    gap: 6,
  },
  loginText: {
    fontSize: 14,
    color: "#64748b",
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366f1",
  },
});
