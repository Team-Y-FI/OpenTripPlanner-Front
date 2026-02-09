import React, { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { usePlaces } from '@/contexts/PlacesContext';

/**
 * 코스 생성 완료(성공/실패) 시 토스트 표시 및 성공 시 결과 탭으로 이동.
 * 다른 화면으로 나갔다가 돌아와도 동작하도록 전역 상태만 구독.
 */
export default function CourseGenerationListener() {
  const router = useRouter();
  const { courseGenerationStatus, courseGenerationMessage, clearCourseGenerationStatus } = usePlaces();
  const prevStatusRef = useRef<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    // idle 상태일 때 prevStatusRef도 리셋하여 다음 생성 시 정상 동작하도록 함
    if (courseGenerationStatus === 'idle') {
      prevStatusRef.current = 'idle';
      return;
    }

    // 이미 처리한 상태면 스킵
    if (courseGenerationStatus === prevStatusRef.current) return;
    prevStatusRef.current = courseGenerationStatus;

    if (courseGenerationStatus === 'success') {
      Toast.show({
        type: 'success',
        text1: '코스 생성 완료',
        text2: '추천 결과를 확인해보세요.',
        position: 'top',
        visibilityTime: 3000,
      });
      router.push('/(tabs)/results');
    } else if (courseGenerationStatus === 'error') {
      Toast.show({
        type: 'error',
        text1: '코스 생성 실패',
        text2: courseGenerationMessage ?? '다시 시도해주세요.',
        position: 'top',
        visibilityTime: 3000,
      });
    }
    clearCourseGenerationStatus();
  }, [courseGenerationStatus, courseGenerationMessage, clearCourseGenerationStatus, router]);

  return null;
}
