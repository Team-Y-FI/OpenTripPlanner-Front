import React, { useEffect } from 'react';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { PlacesProvider } from '@/contexts/PlacesContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SessionProvider, useSession } from '@/contexts/SessionContext';
import { NetworkProvider } from '@/contexts/NetworkContext';
import FullScreenLoader from '@/components/FullScreenLoader';
import Toast from 'react-native-toast-message';
import 'react-native-reanimated';

function AppStack() {
  const { isBootstrapped } = useAuth();
  const { isAppReady, setAppReady } = useSession();

  // Auth 부팅이 끝나면 앱을 준비 완료 상태로 전환
  useEffect(() => {
    if (isBootstrapped && !isAppReady) {
      setAppReady();
    }
  }, [isBootstrapped, isAppReady, setAppReady]);

  const content = (
    <ThemeProvider value={DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            paddingTop: Platform.OS === 'android' ? 0 : 0,
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="course" />
        <Stack.Screen name="upload" />
        <Stack.Screen name="record" />
        <Stack.Screen name="records" />
      </Stack>
    </ThemeProvider>
  );

  // 아직 Auth/세션 부팅이 끝나지 않았으면 전역 로딩만 보여줌.
  if (!isAppReady) {
    return (
      <>
        <StatusBar style="dark" translucent={false} backgroundColor="#ffffff" />
        {content}
        <FullScreenLoader visible message="앱을 준비하는 중..." />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" translucent={false} backgroundColor="#ffffff" />
      {content}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <SessionProvider>
            <PlacesProvider>
              <AppStack />
              <Toast />
            </PlacesProvider>
          </SessionProvider>
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}

