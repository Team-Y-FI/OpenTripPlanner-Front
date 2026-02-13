import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';

const LAST_GENERATED_PLAN_KEY = 'LAST_GENERATED_PLAN';
const getLastGeneratedPlanKey = (userId?: string | null) =>
  userId ? `${LAST_GENERATED_PLAN_KEY}:${userId}` : null;

export interface Place {
  id: string;
  filename: string;
  placeName: string;
  placeAddress: string;
  category: string;
  timestamp: string;
  lat?: number;
  lng?: number;
}

/**
 * 플랜 생성에 사용되는 입력 폼 상태
 */
export interface PlanForm {
  region: string | null;
  durationHours: number | null;
  transport: 'walk' | 'public' | 'car' | null;
  categories: string[];
  crowdMode: 'quiet' | 'normal' | 'hot' | null;
}

interface PlacesContextType {
  /** 사용자가 선택한 장소들 (플랜 생성에 사용) */
  selectedPlaces: Place[];
  setSelectedPlaces: (places: Place[]) => void;
  addPlace: (place: Place) => void;
  removePlace: (id: string) => void;
  clearPlaces: () => void;

  /** 현재 생성 중인 플랜의 입력 값 */
  planForm: PlanForm;
  setPlanFormField: <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => void;
  resetPlanForm: () => void;

  /** 마지막으로 생성된 플랜 결과 (백엔드 응답 전체를 그대로 들고 있을 수 있음) */
  lastGeneratedPlan: unknown;
  setLastGeneratedPlan: (plan: unknown) => void;
  clearGeneratedPlan: () => void;

  /** 코스 생성 진행 중 여부 (다른 화면에서도 확인 가능) */
  isCourseGenerating: boolean;
  setIsCourseGenerating: (value: boolean) => void;

  /** 코스 생성 완료 결과 (성공/실패) - 리스너가 토스트·이동 처리 후 idle로 초기화 */
  courseGenerationStatus: 'idle' | 'success' | 'error';
  courseGenerationMessage: string | undefined;
  reportCourseGenerationComplete: (status: 'success' | 'error', message?: string) => void;
  clearCourseGenerationStatus: () => void;
}

const defaultPlanForm: PlanForm = {
  region: null,
  durationHours: null,
  transport: null,
  categories: [],
  crowdMode: null,
};

const PlacesContext = createContext<PlacesContextType | undefined>(undefined);

export function PlacesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.user_id ?? null;
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
  const [planForm, setPlanForm] = useState<PlanForm>(defaultPlanForm);
  const [lastGeneratedPlan, setLastGeneratedPlanState] = useState<unknown>(null);
  const [isCourseGenerating, setIsCourseGenerating] = useState(false);
  const [courseGenerationStatus, setCourseGenerationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [courseGenerationMessage, setCourseGenerationMessage] = useState<string | undefined>(undefined);

  // 새로고침 후에도 마지막 코스 결과 유지: 사용자별 로컬 저장소에서 복원
  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        // 계정 전환 시 이전 사용자 데이터가 보이지 않도록 즉시 초기화
        setLastGeneratedPlanState(null);

        // 레거시 전역 키 제거 (계정 간 캐시 누수 방지)
        await AsyncStorage.removeItem(LAST_GENERATED_PLAN_KEY);

        const key = getLastGeneratedPlanKey(userId);
        if (!key) return;

        const raw = await AsyncStorage.getItem(key);
        if (!raw) return;

        const parsed = JSON.parse(raw) as unknown;
        if (parsed != null && isActive) setLastGeneratedPlanState(parsed);
      } catch {
        // 저장된 값이 없거나 파싱 실패 시 무시
      }
    })();
    return () => {
      isActive = false;
    };
  }, [userId]);

  const addPlace = (place: Place) => {
    setSelectedPlaces((prev) => [...prev, place]);
  };

  const removePlace = (id: string) => {
    setSelectedPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  const clearPlaces = () => {
    setSelectedPlaces([]);
  };

  const setPlanFormField = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => {
    setPlanForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetPlanForm = () => {
    setPlanForm(defaultPlanForm);
  };

  const setLastGeneratedPlan = useCallback((plan: unknown) => {
    setLastGeneratedPlanState(plan);
    (async () => {
      try {
        const key = getLastGeneratedPlanKey(userId);
        if (!key) return;

        if (plan != null) {
          await AsyncStorage.setItem(key, JSON.stringify(plan));
        } else {
          await AsyncStorage.removeItem(key);
        }
      } catch {
        // 저장 실패 시 메모리 상태만 유지
      }
    })();
  }, [userId]);

  const clearGeneratedPlan = useCallback(() => {
    setLastGeneratedPlanState(null);
    (async () => {
      try {
        const key = getLastGeneratedPlanKey(userId);
        if (!key) return;
        await AsyncStorage.removeItem(key);
      } catch {
        // 무시
      }
    })();
  }, [userId]);

  const reportCourseGenerationComplete = (status: 'success' | 'error', message?: string) => {
    setIsCourseGenerating(false);
    setCourseGenerationStatus(status);
    setCourseGenerationMessage(message);
  };

  const clearCourseGenerationStatus = () => {
    setCourseGenerationStatus('idle');
    setCourseGenerationMessage(undefined);
  };

  return (
    <PlacesContext.Provider
      value={{
        selectedPlaces,
        setSelectedPlaces,
        addPlace,
        removePlace,
        clearPlaces,
        planForm,
        setPlanFormField,
        resetPlanForm,
        lastGeneratedPlan,
        setLastGeneratedPlan,
        clearGeneratedPlan,
        isCourseGenerating,
        setIsCourseGenerating,
        courseGenerationStatus,
        courseGenerationMessage,
        reportCourseGenerationComplete,
        clearCourseGenerationStatus,
      }}
    >
      {children}
    </PlacesContext.Provider>
  );
}

export function usePlaces() {
  const context = useContext(PlacesContext);
  if (context === undefined) {
    throw new Error('usePlaces must be used within a PlacesProvider');
  }
  return context;
}
