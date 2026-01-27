import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as kakaoLogin, getProfile as kakaoGetProfile } from '@react-native-seoul/kakao-login';

interface User {
  email: string;
  name: string;
  profileImage?: string;
  loginType?: 'email' | 'kakao';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  kakaoLoginHandler: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 앱 시작 시 저장된 사용자 정보 확인
  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('사용자 정보 확인 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // DB 연결 없이 입력한 데이터로 바로 로그인
      // 이메일에서 @ 앞부분을 이름으로 사용
      const name = email.split('@')[0];
      const userData = { email, name };
      
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      return true;
    } catch (error) {
      console.error('로그인 실패:', error);
      return false;
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      // DB 연결 없이 입력한 데이터로 바로 회원가입 및 로그인
      const userData = { email, name };
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      return true;
    } catch (error) {
      console.error('회원가입 실패:', error);
      return false;
    }
  };

  const kakaoLoginHandler = async (): Promise<boolean> => {
    try {
      // 카카오 로그인 시도
      const token = await kakaoLogin();
      console.log('카카오 로그인 토큰:', token);

      // 카카오 프로필 정보 가져오기
      const profile = await kakaoGetProfile();
      console.log('카카오 프로필:', profile);

      const userData: User = {
        email: profile.email || `kakao_${profile.id}@kakao.com`,
        name: profile.nickname || '카카오 사용자',
        profileImage: profile.profileImageUrl,
        loginType: 'kakao',
      };

      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      return true;
    } catch (error: any) {
      console.error('카카오 로그인 실패:', error);
      
      // 개발 환경에서는 mock 데이터로 대체
      if (error.code === 'ENOENT' || error.message?.includes('Native module')) {
        console.log('카카오 SDK 설정 필요 - Mock 데이터 사용');
        const mockUserData: User = {
          email: 'kakao_user@kakao.com',
          name: '카카오톡 사용자',
          loginType: 'kakao',
        };
        await AsyncStorage.setItem('user', JSON.stringify(mockUserData));
        setUser(mockUserData);
        return true;
      }
      
      return false;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, kakaoLoginHandler, logout }}>
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
