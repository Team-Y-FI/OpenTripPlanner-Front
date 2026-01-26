import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (!user && inAuthGroup) {
      // 로그인하지 않았는데 인증이 필요한 페이지에 있으면 로그인 페이지로
      router.replace('/login');
    } else if (user && !inAuthGroup) {
      // 로그인했는데 인증 페이지에 있으면 홈으로
      router.replace('/(tabs)');
    } else if (!user) {
      // 로그인하지 않았으면 로그인 페이지로
      router.replace('/login');
    } else {
      // 로그인했으면 홈으로
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
});
