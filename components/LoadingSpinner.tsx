import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

/**
 * 로딩 스피너 컴포넌트
 * 
 * @param size - 스피너 크기 ('small' 또는 'large')
 * @param message - 로딩 메시지 (선택사항)
 * @param color - 스피너 색상 (선택사항, 기본값: '#6366f1')
 */
interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  message?: string;
  color?: string;
}

export default function LoadingSpinner({
  size = 'small',
  message,
  color = '#6366f1',
}: LoadingSpinnerProps) {
  return (
    <View style={styles.container}>
      {/* ActivityIndicator는 React Native에서 제공하는 기본 로딩 아이콘 */}
      <ActivityIndicator size={size} color={color} />
      {/* 메시지가 있으면 표시합니다 */}
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
