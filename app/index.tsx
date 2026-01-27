import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // 로그인 상태에 따라 리다이렉트
    const timer = setTimeout(() => {
      if (user) {
        // 로그인했으면 홈으로
        router.replace('/(tabs)');
      } else {
        // 로그인하지 않았으면 로그인 페이지로
        router.replace('/login');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [user, isLoading, router]);

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
