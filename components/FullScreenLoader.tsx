import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * 전체 화면 로딩 컴포넌트
 * @param message - 로딩 메시지 (선택사항)
 * @param visible - 표시 여부 (true면 표시, false면 숨김)
 */
interface FullScreenLoaderProps {
  message?: string;
  visible?: boolean;
}

export default function FullScreenLoader({
  message = '데이터를 불러오는 중...',
  visible = true,
}: FullScreenLoaderProps) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      {/* 반투명 배경 */}
      <View style={styles.background} />
      
      {/* 로딩 컨텐츠 */}
      <View style={styles.content}>
        {/* 그라데이션 원형 배경 */}
        <LinearGradient
          colors={['#6366f1', '#0ea5e9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconContainer}
        >
          {/* 로딩 스피너 */}
          <ActivityIndicator size="large" color="#ffffff" />
        </LinearGradient>
        
        {/* 로딩 메시지 */}
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  background: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  content: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -75 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});
