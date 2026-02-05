import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { usePlaces } from '@/contexts/PlacesContext';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

function ResultsTabButton({ onPress, children, style, accessibilityState, testID }: BottomTabBarButtonProps) {
  const { isCourseGenerating } = usePlaces();

  const handlePress = (e: GestureResponderEvent) => {
    if (isCourseGenerating) {
      Toast.show({
        type: 'info',
        text1: '알림',
        text2: '코스 생성 중입니다. 완료 후 결과를 확인할 수 있습니다.',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }
    onPress?.(e);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={style}
      accessibilityState={accessibilityState}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366f1', // indigo-500
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          height: 60 + insets.bottom,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: '추천 결과',
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
          tabBarButton: (props) => <ResultsTabButton {...props} />,
        }}
      />
    </Tabs>
  );
}
