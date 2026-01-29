import React, { createContext, useContext, useState, type ReactNode } from 'react';

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
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
  const [planForm, setPlanForm] = useState<PlanForm>(defaultPlanForm);
  const [lastGeneratedPlan, setLastGeneratedPlanState] = useState<unknown>(null);

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

  const setLastGeneratedPlan = (plan: unknown) => {
    setLastGeneratedPlanState(plan);
  };

  const clearGeneratedPlan = () => {
    setLastGeneratedPlanState(null);
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
