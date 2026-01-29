import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useNetwork } from '@/contexts/NetworkContext';
import Toast from 'react-native-toast-message';
import FullScreenLoader from '@/components/FullScreenLoader';

export default function LoginScreen() {
  const router = useRouter();
  const { user, login, kakaoLoginHandler, isAuthLoading } = useAuth();
  const { isOnline } = useNetwork();
  
  // 로그인 성공 시 자동으로 메인 화면으로 이동
  useEffect(() => {
    if (user && !isAuthLoading) {
      router.replace('/(tabs)');
    }
  }, [user, isAuthLoading, router]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // 어떤 인증 플로우가 동작 중인지 구분하기 위한 상태 (버튼/메시지용)
  const [activeAuthMode, setActiveAuthMode] = useState<'email' | 'kakao' | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: '입력 오류',
        text2: '이메일과 비밀번호를 입력해주세요.',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    setActiveAuthMode('email');
    try {
      const success = await login(email, password);
      setActiveAuthMode(null);

      if (success) {
        Toast.show({
          type: 'success',
          text1: '로그인 성공!',
          text2: '환영합니다 🎉',
          position: 'top',
          visibilityTime: 2000,
        });
        // user 상태 변경으로 useEffect가 자동으로 리다이렉트 처리
      } else {
        Toast.show({
          type: 'error',
          text1: '로그인 실패',
          text2: '다시 시도해주세요.',
          position: 'top',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('로그인 처리 중 오류:', error);
      setActiveAuthMode(null);
      
      Toast.show({
        type: 'success',
        text1: '로그인 성공!',
        text2: '환영합니다 🎉',
        position: 'top',
        visibilityTime: 2000,
      });
      // user 상태 변경으로 useEffect가 자동으로 리다이렉트 처리
    }
  };

  const handleKakaoLogin = async () => {
    if (!isOnline) {
      Toast.show({
        type: 'error',
        text1: '네트워크 오류',
        text2: '오프라인 상태입니다. 인터넷 연결을 확인해주세요.',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    setActiveAuthMode('kakao');
    const success = await kakaoLoginHandler();
    setActiveAuthMode(null);

    if (success) {
      Toast.show({
        type: 'success',
        text1: '카카오 로그인 성공!',
        text2: '환영합니다 🎉',
        position: 'top',
        visibilityTime: 2000,
      });
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);
    } else {
      Toast.show({
        type: 'error',
        text1: '카카오 로그인 실패',
        text2: '다시 시도해주세요.',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 로고 섹션 */}
          <View style={styles.logoSection}>
            <LinearGradient
              colors={['#6366f1', '#0ea5e9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoCircle}
            >
              <Text style={styles.logoText}>O</Text>
            </LinearGradient>
            <Text style={styles.appTitle}>OpenTripPlanner</Text>
            <Text style={styles.appSubtitle}>여행의 모든 순간을 기록하고 계획하세요</Text>
          </View>

          {/* 입력 폼 */}
          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>이메일</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="example@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* 로그인 버튼 */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={isAuthLoading}
            >
              <LinearGradient
                colors={['#6366f1', '#0ea5e9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginGradient}
              >
                <Text style={styles.loginButtonText}>
                  {isAuthLoading && activeAuthMode === 'email' ? '로그인 중...' : '로그인'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* 소셜 로그인 구분선 */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>또는</Text>
              <View style={styles.divider} />
            </View>

            {/* 카카오 로그인 버튼 */}
            <TouchableOpacity
              style={styles.kakaoButton}
              onPress={handleKakaoLogin}
              disabled={isAuthLoading}
            >
              <View style={styles.kakaoButtonContent}>
                <Text style={styles.kakaoIcon}>💬</Text>
                <Text style={styles.kakaoButtonText}>
                  {isAuthLoading && activeAuthMode === 'kakao' ? '로그인 중...' : '카카오톡으로 로그인'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* 회원가입 링크 */}
            <View style={styles.signupSection}>
              <Text style={styles.signupText}>아직 계정이 없으신가요?</Text>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.signupLink}>회원가입</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* 전체 화면 로딩 표시 - 어떤 인증 플로우든 동작 중일 때 */}
      <FullScreenLoader 
        visible={isAuthLoading} 
        message={
          activeAuthMode === 'kakao'
            ? '카카오 로그인 중...'
            : '로그인 중...'
        } 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  formSection: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    shadowColor: '#000',
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
    color: '#0f172a',
  },
  loginButton: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  signupSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  signupText: {
    fontSize: 14,
    color: '#64748b',
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  kakaoButton: {
    backgroundColor: '#FEE500',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  kakaoButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  kakaoIcon: {
    fontSize: 20,
  },
  kakaoButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    opacity: 0.85,
  },
});
