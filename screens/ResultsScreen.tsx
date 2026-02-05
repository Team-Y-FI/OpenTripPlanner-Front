import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlaces } from '@/contexts/PlacesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { planService, type AlternativeSpot } from '@/services/planService';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const KAKAO_API_KEY = process.env.EXPO_PUBLIC_KAKAO_MAPS_KEY || '';

// 카카오 맵 타입 선언
declare global {
  interface Window {
    kakao: any;
  }
}

// 타입 정의
interface TimelineItem {
  name: string;
  category: string;
  category2?: string;
  time: string;
  transit_to_here: string[];
  population_level?: string;
  traffic_level?: string;
}

interface RouteItem {
  name: string;
  category: string;
  category2?: string;
  lat: number;
  lng: number;
}

interface DayPlan {
  route: RouteItem[];
  restaurants: RouteItem[];
  accommodations: RouteItem[];
  timelines: {
    fastest_version: TimelineItem[];
    min_transfer_version: TimelineItem[];
  };
}

interface PlanData {
  plan_id: string;
  summary: {
    region: string;
    start_date: string;
    end_date: string;
    transport: string;
    transport_mode: string;
  };
  variants: {
    [key: string]: DayPlan;
  };
}

// 순서 마커 (1, 2, 3, 4 … 첫 번째, 두 번째 코스 순서)
const getOrderMarker = (index: number): string => {
  return String(index + 1);
};

// 카테고리별 아이콘 매핑
const getCategoryIcon = (category: string): string => {
  const cat = category.toLowerCase();
  if (cat.includes('카페') || cat.includes('커피')) return 'cafe';
  if (cat.includes('음식') || cat.includes('맛집') || cat.includes('식당')) return 'restaurant';
  if (cat.includes('쇼핑')) return 'bag';
  if (cat.includes('관광') || cat.includes('명소')) return 'camera';
  if (cat.includes('공원') || cat.includes('산책')) return 'leaf';
  if (cat.includes('전시') || cat.includes('미술관') || cat.includes('박물관')) return 'images';
  if (cat.includes('문화')) return 'library';
  if (cat.includes('레포츠') || cat.includes('스포츠')) return 'fitness';
  if (cat.includes('숙박')) return 'bed';
  return 'location';
};

// 카테고리별 색상
const getCategoryColor = (category: string): { bg: string; text: string; accent: string } => {
  const cat = category.toLowerCase();
  if (cat.includes('카페') || cat.includes('커피')) return { bg: '#fef3c7', text: '#92400e', accent: '#f59e0b' };
  if (cat.includes('음식') || cat.includes('맛집') || cat.includes('식당')) return { bg: '#fee2e2', text: '#991b1b', accent: '#ef4444' };
  if (cat.includes('쇼핑')) return { bg: '#fce7f3', text: '#9d174d', accent: '#ec4899' };
  if (cat.includes('관광') || cat.includes('명소')) return { bg: '#dbeafe', text: '#1e40af', accent: '#3b82f6' };
  if (cat.includes('공원') || cat.includes('산책')) return { bg: '#dcfce7', text: '#166534', accent: '#22c55e' };
  if (cat.includes('전시') || cat.includes('미술관') || cat.includes('박물관')) return { bg: '#f3e8ff', text: '#6b21a8', accent: '#a855f7' };
  if (cat.includes('숙박')) return { bg: '#e0e7ff', text: '#3730a3', accent: '#6366f1' };
  return { bg: '#f1f5f9', text: '#475569', accent: '#64748b' };
};

// 거리 및 이동 시간 추출 (요약용)
const extractTravelInfo = (transit: string[]): { distance: string | null; duration: string | null; mode: string } => {
  let distance: string | null = null;
  let duration: string | null = null;
  let mode = 'walk';

  for (const t of transit) {
    // 도보 시간 추출
    const walkMatch = t.match(/도보\s*[:\s]*(\d+)\s*분/);
    if (walkMatch) {
      const minutes = parseInt(walkMatch[1]);
      duration = `${minutes}분`;
      const km = (minutes / 60) * 4;
      distance = km >= 1 ? `${km.toFixed(1)}km` : `${(km * 1000).toFixed(0)}m`;
      mode = 'walk';
    }
    // 버스/지하철 시간
    const busMatch = t.match(/버스|지하철/);
    if (busMatch) {
      mode = 'transit';
    }
  }
  return { distance, duration, mode };
};

// 시간 문자열에서 기본 구간과 혼잡 태그 분리
const splitTimeAndExtra = (timeStr: string): {
  startTime: string;
  endTime: string | null;
  extraLabel: string | null;
  extraColor: string | null;
} => {
  const extraMatch = timeStr.match(/\[(.+)\]\s*$/);
  const base = timeStr.replace(/\s*\[.+\]\s*$/, '');
  const [start, end] = base.split(' - ');
  const extraRaw = extraMatch ? extraMatch[1] : null;

  if (!extraRaw) {
    return { startTime: start ?? '', endTime: end ?? null, extraLabel: null, extraColor: null };
  }

  const cleaned = extraRaw.replace(/[🟢🟡🔴]/g, '').trim();
  let color = '#e5e7eb';
  if (extraRaw.includes('🟡') || cleaned.includes('보통')) color = '#eab308';
  else if (extraRaw.includes('🔴') || cleaned.includes('정체') || cleaned.includes('지연')) color = '#dc2626';
  else if (extraRaw.includes('🟢') || cleaned.includes('여유')) color = '#16a34a';

  return {
    startTime: start ?? '',
    endTime: end ?? null,
    extraLabel: cleaned,
    extraColor: color,
  };
};

type TransitStepType = 'walk' | 'bus' | 'subway' | 'wait' | 'other';

interface ParsedTransitStep {
  type: TransitStepType;
  duration: string | null;
  routes: string[];
  fromStation: string | null;
  toStation: string | null;
  delayText: string | null;
  delayColor: string | null;
  rawText: string;
}

const parseTransitStep = (raw: string): ParsedTransitStep => {
  // 지연/정체 정보 추출 [정체 +2분]
  const delayMatch = raw.match(/\[([^\]]*(?:지연|정체|서행)[^\]]*)\]\s*$/);
  const cleanRaw = raw.replace(/\s*\[[^\]]*(?:지연|정체|서행)[^\]]*\]\s*$/, '').trim();
  const delayRaw = delayMatch ? delayMatch[1] : null;

  let type: TransitStepType = 'other';
  let duration: string | null = null;
  let routes: string[] = [];
  let fromStation: string | null = null;
  let toStation: string | null = null;

  // 도보: "도보 : 2분" 또는 "도보 2분"
  const walkMatch = cleanRaw.match(/도보\s*[:\s]*(\d+)\s*분/);
  if (walkMatch) {
    type = 'walk';
    duration = `${walkMatch[1]}분`;
  }
  // 대기: "대기 : 3분" 또는 "대기 3분"
  else if (cleanRaw.includes('대기')) {
    type = 'wait';
    const waitMatch = cleanRaw.match(/대기\s*[:\s]*(\d+)\s*분/);
    if (waitMatch) duration = `${waitMatch[1]}분`;
  }
  // 버스: "[버스][341, 3411, N31] : 잠실역.롯데월드 → 잠실진주아파트 : 4분"
  else if (cleanRaw.includes('버스') || cleanRaw.match(/\d{2,4}번?/)) {
    type = 'bus';
    // 두 번째 대괄호에서 노선 번호 추출: [버스][341, 3411, N31]
    const routeMatch = cleanRaw.match(/\[버스\]\[([^\]]+)\]/);
    if (routeMatch) {
      routes = routeMatch[1].split(/,\s*/).map(r => r.trim()).filter(r => r);
    } else {
      // fallback: 첫 번째 대괄호가 노선일 수도 있음
      const fallbackMatch = cleanRaw.match(/\[([^\]]+)\]/);
      if (fallbackMatch && !fallbackMatch[1].includes('버스')) {
        routes = fallbackMatch[1].split(/,\s*/).map(r => r.trim()).filter(r => r);
      }
    }
    // 정류장 정보 추출: "출발지 → 도착지"
    const stationMatch = cleanRaw.match(/:\s*([^:→]+)\s*→\s*([^:]+)\s*:/);
    if (stationMatch) {
      fromStation = stationMatch[1].trim();
      toStation = stationMatch[2].trim();
    }
    // 소요시간 추출
    const durationMatch = cleanRaw.match(/:\s*(\d+)\s*분\s*$/);
    if (durationMatch) duration = `${durationMatch[1]}분`;
  }
  // 지하철: "[지하철][서울 2호선] : 성수 → 잠실나루 : 8분"
  else if (cleanRaw.includes('지하철') || cleanRaw.includes('호선')) {
    type = 'subway';
    // 두 번째 대괄호에서 노선 정보 추출: [지하철][서울 2호선]
    const lineMatch = cleanRaw.match(/\[지하철\]\[([^\]]+)\]/);
    if (lineMatch) {
      routes = [lineMatch[1].trim()];
    } else {
      // fallback: 호선 패턴 찾기
      const fallbackMatch = cleanRaw.match(/([^\s]*\d+호선)/);
      if (fallbackMatch) routes = [fallbackMatch[1]];
    }
    const stationMatch = cleanRaw.match(/:\s*([^:→]+)\s*→\s*([^:]+)\s*:/);
    if (stationMatch) {
      fromStation = stationMatch[1].trim();
      toStation = stationMatch[2].trim();
    }
    const durationMatch = cleanRaw.match(/:\s*(\d+)\s*분\s*$/);
    if (durationMatch) duration = `${durationMatch[1]}분`;
  }

  // 지연 정보 색상
  let delayColor: string | null = null;
  if (delayRaw) {
    if (delayRaw.includes('🔴') || delayRaw.includes('정체')) delayColor = '#dc2626';
    else if (delayRaw.includes('🟡') || delayRaw.includes('지연')) delayColor = '#f59e0b';
    else if (delayRaw.includes('🟢')) delayColor = '#16a34a';
    else delayColor = '#6b7280';
  }
  const cleanedDelay = delayRaw ? delayRaw.replace(/[🟢🟡🔴]/g, '').trim() : null;

  return {
    type,
    duration,
    routes,
    fromStation,
    toStation,
    delayText: cleanedDelay,
    delayColor,
    rawText: cleanRaw,
  };
};

// 총 이동시간 계산
const calculateTotalTransitTime = (transitSteps: string[]): string => {
  let totalMinutes = 0;
  for (const step of transitSteps) {
    const match = step.match(/(\d+)\s*분/);
    if (match) totalMinutes += parseInt(match[1]);
  }
  return `${totalMinutes}분`;
};

// 혼잡도 레벨 파싱
const parsePopulationLevel = (level: string): { text: string; color: string; bgColor: string } => {
  const cleaned = level.replace(/[🟢🟡🔴]/g, '').trim();
  if (level.includes('🟢') || cleaned.includes('여유') || cleaned.includes('보통')) {
    return { text: cleaned, color: '#166534', bgColor: '#dcfce7' };
  }
  if (level.includes('🟡') || cleaned.includes('약간')) {
    return { text: cleaned, color: '#a16207', bgColor: '#fef9c3' };
  }
  if (level.includes('🔴') || cleaned.includes('붐빔') || cleaned.includes('혼잡')) {
    return { text: cleaned, color: '#dc2626', bgColor: '#fee2e2' };
  }
  return { text: cleaned, color: '#475569', bgColor: '#f1f5f9' };
};

// 코스 순서 아이콘 색상: 혼잡도에 맞춤 (보통=노랑, 혼잡=빨강, 그 외=회색)
const getCourseOrderColor = (level?: string): string => {
  if (!level || level === '-') return '#94a3b8';
  const cleaned = level.replace(/[🟢🟡🔴]/g, '').trim();
  if (cleaned.includes('보통')) return '#eab308';
  if (cleaned.includes('혼잡') || cleaned.includes('붐빔') || level.includes('🔴')) return '#dc2626';
  return '#94a3b8';
};

// 카테고리별 예상 체류 시간 (분)
const getEstimatedDuration = (category: string): number => {
  const cat = category.toLowerCase();
  if (cat.includes('카페') || cat.includes('커피')) return 30;
  if (cat.includes('음식') || cat.includes('맛집') || cat.includes('식당')) return 60;
  if (cat.includes('쇼핑')) return 45;
  if (cat.includes('관광') || cat.includes('명소')) return 60;
  if (cat.includes('공원') || cat.includes('산책')) return 45;
  if (cat.includes('전시') || cat.includes('미술관') || cat.includes('박물관')) return 90;
  if (cat.includes('숙박')) return 60;
  return 45;
};

// 시간 문자열 파싱 (HH:MM -> 분)
const parseTimeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// 분을 시간 문자열로 변환 (분 -> HH:MM)
const formatMinutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// 타임라인 시간 재계산
const recalculateTimes = (timeline: TimelineItem[]): TimelineItem[] => {
  if (timeline.length === 0) return timeline;

  const firstStartTime = timeline[0].time.split(' - ')[0];
  let currentMinutes = parseTimeToMinutes(firstStartTime);

  return timeline.map((item, index) => {
    const duration = getEstimatedDuration(item.category);
    const startTime = formatMinutesToTime(currentMinutes);
    const endTime = formatMinutesToTime(currentMinutes + duration);

    // 다음 장소로 이동 시간 (기본 15분)
    const transitTime = index < timeline.length - 1 ? 15 : 0;
    currentMinutes += duration + transitTime;

    return {
      ...item,
      time: `${startTime} - ${endTime}`,
    };
  });
};

// 깊은 복사 함수
const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

// 드래그 가능한 장소 카드 컴포넌트 (편집 모드용)
interface SortablePlaceCardProps {
  id: string;
  item: TimelineItem;
  idx: number;
  isEditMode: boolean;
  isHovered: boolean;
  isSelected: boolean;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onPress: () => void;
  onDelete: () => void;
  onToggleSelect: () => void;
}

function SortablePlaceCard({
  id,
  item,
  idx,
  isEditMode,
  isHovered,
  isSelected,
  onHoverIn,
  onHoverOut,
  onPress,
  onDelete,
  onToggleSelect,
}: SortablePlaceCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const { startTime, endTime, extraLabel, extraColor } = splitTimeAndExtra(item.time);
  const categoryColors = getCategoryColor(item.category);
  const categoryIcon = getCategoryIcon(item.category);

  return (
    <div ref={setNodeRef} style={style}>
      <View
        style={[
          styles.placeCard,
          isHovered && styles.placeCardHovered,
          isDragging && styles.placeCardDragging,
          isEditMode && styles.placeCardEdit,
          isEditMode && isSelected && styles.placeCardSelected,
        ]}
      >
        {/* 체크박스 (편집 모드에서만 표시) */}
        {isEditMode && (
          <Pressable style={styles.editCheckboxArea} onPress={onToggleSelect}>
            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
            </View>
          </Pressable>
        )}

        {/* 순서 마커 */}
        <Pressable
          style={[styles.placeMarker, { backgroundColor: getCourseOrderColor(item.population_level || item.traffic_level) }]}
          onHoverIn={onHoverIn}
          onHoverOut={onHoverOut}
          onPress={onPress}
        >
          <Text style={styles.placeMarkerText}>{getOrderMarker(idx)}</Text>
        </Pressable>

        {/* 카드 내용 */}
        <Pressable
          style={styles.placeContent}
          onHoverIn={onHoverIn}
          onHoverOut={onHoverOut}
          onPress={onPress}
        >
          <View style={styles.placeTimeRow}>
            <Text style={styles.courseOrderLabel}>{idx + 1}번 코스</Text>
          </View>
          {startTime ? (
            <View style={styles.placeTimeRow}>
              <View style={styles.placeTimeMain}>
                <Text style={styles.placeTime}>{startTime}</Text>
                {endTime && (
                  <>
                    <Ionicons name="arrow-forward" size={12} color="#94a3b8" />
                    <Text style={styles.placeTimeEnd}>{endTime}</Text>
                  </>
                )}
              </View>
              {extraLabel && extraColor && (
                <View style={[styles.timeBadge, { backgroundColor: extraColor + '22', borderColor: extraColor }]}>
                  <Text style={[styles.timeBadgeText, { color: extraColor }]}>{extraLabel}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.placeTimeRow}>
              <Text style={styles.placeTimeUndefined}>시간 미정</Text>
            </View>
          )}

          <Text style={[styles.placeName, isEditMode && styles.placeNameEdit]}>{item.name}</Text>

          <View style={styles.placeMetaRow}>
            <View style={[styles.categoryBadge, { backgroundColor: categoryColors.bg }]}>
              <Ionicons name={categoryIcon as any} size={12} color={categoryColors.text} />
              <Text style={[styles.categoryText, { color: categoryColors.text }]}>
                {item.category}
              </Text>
            </View>
          </View>

          {!isEditMode && (item.population_level || (item.traffic_level && item.traffic_level !== '-')) && (
            <View style={styles.statusRow}>
              {item.population_level && (() => {
                const popInfo = parsePopulationLevel(item.population_level);
                return (
                  <View style={[styles.statusBadge, { backgroundColor: popInfo.bgColor }]}>
                    <View style={[styles.statusDot, { backgroundColor: popInfo.color }]} />
                    <Text style={[styles.statusText, { color: popInfo.color }]}>{popInfo.text}</Text>
                  </View>
                );
              })()}
              {item.traffic_level && item.traffic_level !== '-' && (() => {
                const trafficInfo = parsePopulationLevel(item.traffic_level);
                return (
                  <View style={[styles.statusBadge, { backgroundColor: trafficInfo.bgColor }]}>
                    <Ionicons name="car" size={10} color={trafficInfo.color} />
                    <Text style={[styles.statusText, { color: trafficInfo.color }]}>{trafficInfo.text}</Text>
                  </View>
                );
              })()}
            </View>
          )}
        </Pressable>

        {/* 오른쪽 액션 버튼 영역 */}
        {isEditMode ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
            gap: 4,
          }}>
            {/* 삭제 버튼 */}
            <Pressable
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#fef2f2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={onDelete}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </Pressable>
            {/* 드래그 핸들 */}
            <button
              type="button"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#eef2ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'grab',
              }}
              {...attributes}
              {...listeners}
            >
              <Ionicons name="menu" size={18} color="#6366f1" />
            </button>
          </div>
        ) : (
          <Pressable style={styles.detailButton}>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>
        )}
      </View>
    </div>
  );
}

// 카카오맵 스크립트 로드
const loadKakaoMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return reject(new Error('Not in browser environment'));
    }
    if (!KAKAO_API_KEY) return reject(new Error('NO_API_KEY'));
    if (window.kakao && window.kakao.maps) return resolve();

    const id = 'kakao-maps-script';
    const existingScript = document.getElementById(id);
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.kakao && window.kakao.maps) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}&autoload=false`;
    script.onload = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => resolve());
      } else {
        reject(new Error('Kakao Maps failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Kakao Maps'));
    document.head.appendChild(script);
  });
};

// 저장된 일정 키
const SAVED_PLANS_KEY = 'SAVED_TRIP_PLANS';

export default function ResultsScreen() {
  const router = useRouter();
  const { lastGeneratedPlan, setLastGeneratedPlan } = usePlaces();
  const { user } = useAuth();
  const [activeDay, setActiveDay] = useState<string>('day1');
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  const [expandedTransit, setExpandedTransit] = useState<number | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);

  // 편집 모드 상태
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editedPlan, setEditedPlan] = useState<PlanData | null>(null);
  const [originalPlan, setOriginalPlan] = useState<PlanData | null>(null);
  
  // 대체 장소 추천 관련 상태
  const [selectedSpots, setSelectedSpots] = useState<Set<string>>(new Set());
  const [alternativesModalVisible, setAlternativesModalVisible] = useState<boolean>(false);
  const [alternatives, setAlternatives] = useState<AlternativeSpot[]>([]);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState<boolean>(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const planData = (isEditMode && editedPlan ? editedPlan : lastGeneratedPlan) as PlanData | null;

  // @dnd-kit 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 편집 모드 진입
  const enterEditMode = useCallback(() => {
    if (lastGeneratedPlan) {
      const cloned = deepClone(lastGeneratedPlan as PlanData);
      setOriginalPlan(cloned);
      setEditedPlan(deepClone(cloned));
      setIsEditMode(true);
      setSelectedSpots(new Set()); // 선택 초기화
    }
  }, [lastGeneratedPlan]);

  // 편집 모드 종료 (저장)
  const saveAndExitEditMode = useCallback(() => {
    if (editedPlan) {
      setLastGeneratedPlan(editedPlan);
      Toast.show({
        type: 'success',
        text1: '저장 완료',
        text2: '일정이 수정되었습니다.',
        position: 'top',
        visibilityTime: 2000,
      });
    }
    setIsEditMode(false);
    setEditedPlan(null);
    setOriginalPlan(null);
  }, [editedPlan, setLastGeneratedPlan]);

  // 편집 취소
  const cancelEditMode = useCallback(() => {
    setIsEditMode(false);
    setEditedPlan(null);
    setOriginalPlan(null);
    setSelectedSpots(new Set());
    setAlternativesModalVisible(false);
    setAlternatives([]);
  }, []);

  // 원본으로 초기화
  const resetToOriginal = useCallback(() => {
    if (originalPlan) {
      setEditedPlan(deepClone(originalPlan));
      Toast.show({
        type: 'info',
        text1: '초기화',
        text2: '원본 일정으로 되돌렸습니다.',
        position: 'top',
        visibilityTime: 2000,
      });
    }
  }, [originalPlan]);

  // 장소 삭제
  const deletePlace = useCallback((dayKey: string, placeIndex: number) => {
    if (!editedPlan) return;

    const updatedPlan = deepClone(editedPlan);
    const dayPlan = updatedPlan.variants[dayKey];
    const timeline = dayPlan.timelines.fastest_version;
    const placeToDelete = timeline[placeIndex];

    // 타임라인에서 제거
    dayPlan.timelines.fastest_version = timeline.filter((_, i) => i !== placeIndex);
    dayPlan.timelines.min_transfer_version = dayPlan.timelines.min_transfer_version.filter(
      (item) => item.name !== placeToDelete.name
    );

    // route/restaurants/accommodations에서도 제거
    dayPlan.route = dayPlan.route.filter((r) => r.name !== placeToDelete.name);
    dayPlan.restaurants = dayPlan.restaurants.filter((r) => r.name !== placeToDelete.name);
    dayPlan.accommodations = dayPlan.accommodations.filter((a) => a.name !== placeToDelete.name);

    // 시간 재계산
    dayPlan.timelines.fastest_version = recalculateTimes(dayPlan.timelines.fastest_version);

    setEditedPlan(updatedPlan);
    setDeleteConfirmIndex(null);

    Toast.show({
      type: 'success',
      text1: '삭제 완료',
      text2: `${placeToDelete.name}이(가) 삭제되었습니다.`,
      position: 'top',
      visibilityTime: 2000,
    });
  }, [editedPlan]);

  // 드래그 앤 드롭 완료 핸들러
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !editedPlan) return;

    const oldIndex = parseInt(String(active.id).split('-')[1]);
    const newIndex = parseInt(String(over.id).split('-')[1]);

    const updatedPlan = deepClone(editedPlan);
    const dayPlan = updatedPlan.variants[activeDay];
    const newTimeline = arrayMove(dayPlan.timelines.fastest_version, oldIndex, newIndex);

    // 시간 재계산
    dayPlan.timelines.fastest_version = recalculateTimes(newTimeline);

    // route 배열도 순서 맞추기
    const routeOrder = dayPlan.timelines.fastest_version.map((t) => t.name);
    dayPlan.route.sort((a, b) => routeOrder.indexOf(a.name) - routeOrder.indexOf(b.name));

    setEditedPlan(updatedPlan);
  }, [editedPlan, activeDay]);

  // 장소 선택 토글
  const toggleSpotSelection = useCallback((spotName: string) => {
    setSelectedSpots((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(spotName)) {
        newSet.delete(spotName);
      } else {
        newSet.add(spotName);
      }
      return newSet;
    });
  }, []);

  // 대체 장소 추천 요청
  const requestAlternatives = useCallback(async () => {
    if (!planData || !user || selectedSpots.size === 0) {
      Toast.show({
        type: 'info',
        text1: '알림',
        text2: selectedSpots.size === 0 ? '대체하고 싶은 장소를 선택해주세요.' : '로그인이 필요합니다.',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }

    setIsLoadingAlternatives(true);
    try {
      const response = await planService.recommendAlternatives({
        plan_id: planData.plan_id,
        day: activeDay,
        spot_names: Array.from(selectedSpots),
        region: planData.summary.region,
      });

      if (response.alternatives.length === 0) {
        Toast.show({
          type: 'info',
          text1: '알림',
          text2: '대체 장소를 찾을 수 없습니다.',
          position: 'top',
          visibilityTime: 2000,
        });
        return;
      }

      setAlternatives(response.alternatives);
      setAlternativesModalVisible(true);
    } catch (error) {
      console.error('대체 장소 추천 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '대체 장소 추천에 실패했습니다.';
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoadingAlternatives(false);
    }
  }, [planData, user, selectedSpots, activeDay]);

  // 대체 장소로 교체
  const replaceSpotWithAlternative = useCallback((oldSpotName: string, alternative: AlternativeSpot) => {
    if (!editedPlan) return;

    const updatedPlan = deepClone(editedPlan);
    const dayPlan = updatedPlan.variants[activeDay];
    const timeline = dayPlan.timelines.fastest_version;

    // 타임라인에서 장소 찾아서 교체
    const spotIndex = timeline.findIndex((item) => item.name === oldSpotName);
    if (spotIndex === -1) return;

    // 새 장소 정보로 교체
    const oldSpot = timeline[spotIndex];
    timeline[spotIndex] = {
      ...oldSpot,
      name: alternative.name,
      category: alternative.category,
    };

    // route/restaurants/accommodations 배열도 업데이트
    const updateArray = (arr: { name: string; category: string; category2?: string; lat: number; lng: number }[]) => {
      const idx = arr.findIndex((item) => item.name === oldSpotName);
      if (idx !== -1) {
        arr[idx] = {
          name: alternative.name,
          category: alternative.category,
          category2: alternative.category2 || alternative.category,
          lat: alternative.lat,
          lng: alternative.lng,
        };
      }
    };

    updateArray(dayPlan.route);
    updateArray(dayPlan.restaurants);
    updateArray(dayPlan.accommodations);

    // 시간 재계산
    dayPlan.timelines.fastest_version = recalculateTimes(timeline);

    setEditedPlan(updatedPlan);
    setSelectedSpots(new Set());
    setAlternativesModalVisible(false);
    setAlternatives([]);

    Toast.show({
      type: 'success',
      text1: '교체 완료',
      text2: `${oldSpotName} → ${alternative.name}`,
      position: 'top',
      visibilityTime: 2000,
    });
  }, [editedPlan, activeDay]);

  // 날짜 목록
  const dayKeys = useMemo(() => {
    if (!planData?.variants) return [];
    return Object.keys(planData.variants).sort();
  }, [planData]);

  // 현재 선택된 날짜의 데이터
  const currentDayData = useMemo(() => {
    if (!planData?.variants || !activeDay) return null;
    return planData.variants[activeDay];
  }, [planData, activeDay]);

  // 타임라인 데이터 (비어있으면 route 데이터로 fallback)
  const timeline = useMemo(() => {
    if (!currentDayData) return [];

    // timeline 데이터가 있으면 사용
    if (currentDayData.timelines?.fastest_version?.length > 0) {
      return currentDayData.timelines.fastest_version;
    }

    // timeline이 비어있으면 route 데이터를 timeline 형태로 변환
    const routeAsTimeline: TimelineItem[] = currentDayData.route.map((item, index) => ({
      name: item.name,
      category: item.category,
      category2: item.category2,
      time: '', // 시간 정보 없음
      transit_to_here: [],
      population_level: undefined,
      traffic_level: undefined,
    }));

    return routeAsTimeline;
  }, [currentDayData]);

  // 모든 장소 좌표
  const allLocations = useMemo(() => {
    if (!currentDayData) return [];
    const locations: { lat: number; lng: number; name: string; category: string }[] = [];

    timeline.forEach((item) => {
      const routeItem = currentDayData.route.find(r => r.name === item.name);
      if (routeItem) {
        locations.push({ lat: routeItem.lat, lng: routeItem.lng, name: item.name, category: item.category });
        return;
      }
      const restaurantItem = currentDayData.restaurants.find(r => r.name === item.name);
      if (restaurantItem) {
        locations.push({ lat: restaurantItem.lat, lng: restaurantItem.lng, name: item.name, category: item.category });
        return;
      }
      const accommodationItem = currentDayData.accommodations.find(a => a.name === item.name);
      if (accommodationItem) {
        locations.push({ lat: accommodationItem.lat, lng: accommodationItem.lng, name: item.name, category: item.category });
      }
    });

    return locations;
  }, [currentDayData, timeline]);

  // 저장 상태 확인 (서버에서 확인)
  useEffect(() => {
    const checkSavedStatus = async () => {
      if (!planData?.plan_id || !user) {
        setIsSaved(false);
        return;
      }
      try {
        const response = await planService.getSavedPlans(100);
        // 저장된 플랜 목록에는 plan_id가 없으므로, 저장 시점에만 상태 업데이트
        // 정확한 확인을 위해서는 각 저장된 플랜의 상세를 조회해야 하지만, 
        // 성능상 저장 시점에만 상태를 업데이트하는 방식 사용
        setIsSaved(false);
      } catch (error) {
        console.error('저장 상태 확인 실패:', error);
        setIsSaved(false);
      }
    };
    checkSavedStatus();
  }, [planData?.plan_id, user]);

  // 일정 저장 (서버에 저장)
  const handleSave = useCallback(async () => {
    if (!planData || !user) {
      Toast.show({ type: 'info', text1: '알림', text2: '로그인이 필요합니다.', position: 'top', visibilityTime: 2000 });
      return;
    }

    if (isSaving) return;

    setIsSaving(true);
    try {
      // 플랜 제목 생성 (지역 + 날짜)
      const title = `${planData.summary.region} ${planData.summary.start_date} ~ ${planData.summary.end_date}`;

      await planService.savePlan({
        plan_id: planData.plan_id,
        title: title,
      });

      setIsSaved(true);
      Toast.show({ 
        type: 'success', 
        text1: '저장 완료', 
        text2: '일정이 저장되었습니다.', 
        position: 'top', 
        visibilityTime: 2000 
      });
    } catch (error) {
      console.error('저장 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '저장에 실패했습니다.';
      Toast.show({ 
        type: 'error', 
        text1: '오류', 
        text2: errorMessage, 
        position: 'top', 
        visibilityTime: 3000 
      });
    } finally {
      setIsSaving(false);
    }
  }, [planData, user, isSaving]);

  // 공유 기능
  const handleShare = useCallback(async () => {
    if (!planData) return;

    const shareText = `${planData.summary.region} 여행 일정\n${planData.summary.start_date} ~ ${planData.summary.end_date}\n\n` +
      dayKeys.map((day, idx) => {
        const dayData = planData.variants[day];
        const dayTimeline = dayData?.timelines?.fastest_version || [];
        return `Day ${idx + 1}:\n${dayTimeline.map((item, i) => `  ${i + 1}. ${item.name} (${item.time})`).join('\n')}`;
      }).join('\n\n');

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${planData.summary.region} 여행 일정`,
          text: shareText,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          // 공유 취소가 아닌 경우 클립보드에 복사
          await copyToClipboard(shareText);
        }
      }
    } else {
      await copyToClipboard(shareText);
    }
  }, [planData, dayKeys]);

  // 클립보드 복사
  const copyToClipboard = async (text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        Toast.show({ type: 'success', text1: '복사 완료', text2: '일정이 클립보드에 복사되었습니다.', position: 'top', visibilityTime: 2000 });
      }
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      Toast.show({ type: 'error', text1: '오류', text2: '복사에 실패했습니다.', position: 'top', visibilityTime: 2000 });
    }
  };

  // 특정 장소로 지도 줌 인
  const zoomToLocation = useCallback((index: number) => {
    if (!mapInstanceRef.current || !window.kakao || !allLocations[index]) return;

    const location = allLocations[index];
    const moveLatLng = new window.kakao.maps.LatLng(location.lat, location.lng);

    // 부드럽게 이동 및 줌 인
    mapInstanceRef.current.panTo(moveLatLng);
    setTimeout(() => {
      mapInstanceRef.current.setLevel(3, { animate: true });
    }, 300);
  }, [allLocations]);

  // 지도 초기화
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!mapContainerRef.current || !KAKAO_API_KEY || allLocations.length === 0) return;

    loadKakaoMapsScript()
      .then(() => {
        if (typeof window === 'undefined' || !window.kakao || !mapContainerRef.current) return;

        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
          polylineRef.current = null;
        }

        const lats = allLocations.map(l => l.lat);
        const lngs = allLocations.map(l => l.lng);
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

        const options = {
          center: new window.kakao.maps.LatLng(centerLat, centerLng),
          level: 5,
        };

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new window.kakao.maps.Map(mapContainerRef.current, options);
        } else {
          mapInstanceRef.current.setCenter(new window.kakao.maps.LatLng(centerLat, centerLng));
        }

        const bounds = new window.kakao.maps.LatLngBounds();
        allLocations.forEach(loc => {
          bounds.extend(new window.kakao.maps.LatLng(loc.lat, loc.lng));
        });
        mapInstanceRef.current.setBounds(bounds);

        // 경로 라인 그리기
        if (allLocations.length > 1) {
          const path = allLocations.map(loc => new window.kakao.maps.LatLng(loc.lat, loc.lng));
          polylineRef.current = new window.kakao.maps.Polyline({
            path,
            strokeWeight: 4,
            strokeColor: '#6366f1',
            strokeOpacity: 0.7,
            strokeStyle: 'solid',
          });
          polylineRef.current.setMap(mapInstanceRef.current);
        }

        // 마커 생성 (순서 1, 2, 3, 4 + 혼잡도 색상: 보통=노랑, 혼잡=빨강, 그 외=회색)
        allLocations.forEach((location, index) => {
          const markerPosition = new window.kakao.maps.LatLng(location.lat, location.lng);
          const level = timeline[index]?.population_level || timeline[index]?.traffic_level;
          const orderColor = getCourseOrderColor(level);
          const orderLabel = getOrderMarker(index);

          const svgString = `<svg width="32" height="40" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="shadow${index}" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/>
              </filter>
            </defs>
            <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 24 16 24s16-15.163 16-24C32 7.163 24.837 0 16 0z" fill="${orderColor}" filter="url(#shadow${index})"/>
            <circle cx="16" cy="14" r="10" fill="white"/>
            <text x="16" y="18" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="${orderColor}" text-anchor="middle">${orderLabel}</text>
          </svg>`;

          const markerImageSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
          const imageSize = new window.kakao.maps.Size(32, 40);
          const imageOption = { offset: new window.kakao.maps.Point(16, 40) };
          const markerImage = new window.kakao.maps.MarkerImage(markerImageSrc, imageSize, imageOption);

          const marker = new window.kakao.maps.Marker({
            position: markerPosition,
            image: markerImage,
            title: location.name,
          });

          marker.setMap(mapInstanceRef.current);
          markersRef.current.push(marker);
        });
      })
      .catch((e) => {
        console.error('카카오맵 초기화 실패', e);
      });
  }, [allLocations, activeDay, timeline]);

  // 날짜 포맷팅
  const formatDate = (dateStr: string, dayIndex: number) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + dayIndex);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = days[date.getDay()];
    return { full: `${month}월 ${day}일 (${dayOfWeek})`, short: `${month}.${day}` };
  };

  if (!planData || !currentDayData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyContent}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="map-outline" size={48} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>아직 생성된 일정이 없어요</Text>
            <Text style={styles.emptyText}>코스 조건을 입력하고{'\n'}나만의 여행 일정을 만들어보세요</Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push('/course')}>
              <Text style={styles.emptyButtonText}>일정 만들기</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const dayIndex = parseInt(activeDay.replace('day', '')) - 1;
  const currentDateInfo = formatDate(planData.summary.start_date, dayIndex);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        {/* 왼쪽: 일정 패널 */}
        <View style={styles.leftPanel}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{planData.summary.region} 여행</Text>
            <Text style={styles.headerSubtitle}>
              {planData.summary.start_date} ~ {planData.summary.end_date} · {dayKeys.length}일
            </Text>
          </View>
          <View style={styles.headerActions}>
            {!isEditMode && (
              <>
                <Pressable style={styles.headerActionBtn} onPress={handleShare}>
                  <Ionicons name="share-outline" size={20} color="#64748b" />
                </Pressable>
                <Pressable
                  style={[
                    styles.headerActionBtn,
                    isSaved && styles.headerActionBtnActive,
                    (isSaving || !user) && styles.headerActionBtnDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={isSaving || !user}
                >
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={isSaved ? '#6366f1' : !user ? '#cbd5e1' : '#64748b'}
                  />
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* 편집/보기 공통 툴바 */}
        <View style={styles.editToolbar}>
          {isEditMode ? (
            <>
              <View style={styles.editToolbarActions}>
                <Pressable style={styles.editToolbarButton} onPress={cancelEditMode}>
                  <Text style={styles.editToolbarButtonText}>취소</Text>
                </Pressable>
                {selectedSpots.size > 0 && (
                  <Pressable
                    style={[styles.editToolbarButton, styles.editToolbarPrimaryButton]}
                    onPress={requestAlternatives}
                    disabled={isLoadingAlternatives}
                  >
                    <Text style={styles.editToolbarPrimaryText}>
                      {isLoadingAlternatives ? '추천 중...' : `대체 추천 (${selectedSpots.size})`}
                    </Text>
                  </Pressable>
                )}
                <Pressable style={styles.editToolbarIconButton} onPress={resetToOriginal}>
                  <Ionicons name="refresh" size={18} color="#64748b" />
                </Pressable>
                <Pressable
                  style={[styles.editToolbarButton, styles.editToolbarPrimaryOutline]}
                  onPress={saveAndExitEditMode}
                >
                  <Text style={styles.editToolbarPrimaryOutlineText}>완료</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.editToolbarText}>
                <Text style={styles.editToolbarTitle}>추천 코스 요약</Text>
                <Text style={styles.editToolbarSubtitle}>
                  {dayKeys.length}일 · 오늘 {timeline.length}개 코스
                </Text>
              </View>
              <View style={styles.editToolbarActions}>
                <Pressable
                  style={[styles.editToolbarButton, styles.editToolbarPrimaryOutline]}
                  onPress={enterEditMode}
                >
                  <Text style={styles.editToolbarPrimaryOutlineText}>코스 편집</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

          {/* 일차 탭 */}
          <View style={styles.dayTabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabsScroll}>
              {dayKeys.map((day, idx) => {
                const dateInfo = formatDate(planData.summary.start_date, idx);
                const isActive = activeDay === day;
                return (
                  <Pressable
                    key={day}
                    style={[styles.dayTab, isActive && styles.dayTabActive]}
                    onPress={() => setActiveDay(day)}
                  >
                    <Text style={[styles.dayTabLabel, isActive && styles.dayTabLabelActive]}>
                      Day {idx + 1}
                    </Text>
                    <Text style={[styles.dayTabDate, isActive && styles.dayTabDateActive]}>
                      {dateInfo.short}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 날짜 헤더 */}
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{currentDateInfo.full}</Text>
            <View style={styles.dateHeaderBadge}>
              <Text style={styles.dateHeaderBadgeText}>{timeline.length}개 장소</Text>
            </View>
          </View>

          {/* 타임라인 */}
          <ScrollView style={styles.timelineScroll} showsVerticalScrollIndicator={false}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={timeline.map((_, idx) => `place-${idx}`)}
                strategy={verticalListSortingStrategy}
              >
                <View style={styles.timelineContainer}>
                  {timeline.map((item, idx) => {
                    const travelInfo = idx > 0 ? extractTravelInfo(item.transit_to_here) : null;
                    const isHovered = hoveredItem === idx;
                    const isTransitExpanded = expandedTransit === idx;

                    return (
                      <View key={`place-${idx}`}>
                        {/* 이동 구간 (첫 번째 아이템 제외, 편집 모드가 아닐 때만) */}
                        {idx > 0 && travelInfo && !isEditMode && (
                          <Pressable
                            style={styles.travelSection}
                            onPress={() => setExpandedTransit(isTransitExpanded ? null : idx)}
                          >
                            <View style={styles.travelLine}>
                              <View style={styles.travelDot} />
                              <View style={styles.travelLineDash} />
                              <View style={styles.travelDot} />
                            </View>
                            <View style={styles.travelInfo}>
                              <View style={styles.travelBadge}>
                                <Ionicons
                                  name={travelInfo.mode === 'walk' ? 'walk' : 'bus'}
                                  size={14}
                                  color="#6366f1"
                                />
                                {travelInfo.distance && (
                                  <Text style={styles.travelDistance}>{travelInfo.distance}</Text>
                                )}
                                {travelInfo.duration && (
                                  <Text style={styles.travelDuration}>{travelInfo.duration}</Text>
                                )}
                              </View>
                              {item.transit_to_here.length > 0 && (
                                <Ionicons
                                  name={isTransitExpanded ? 'chevron-up' : 'chevron-down'}
                                  size={16}
                                  color="#94a3b8"
                                />
                              )}
                            </View>
                          </Pressable>
                        )}

                        {/* 이동 상세 (펼침) - 새 디자인 */}
                        {isTransitExpanded && item.transit_to_here.length > 0 && !isEditMode && (
                          <View style={styles.transitCard}>
                            {/* 헤더: 총 소요시간 */}
                            <View style={styles.transitCardHeader}>
                              <View style={styles.transitCardHeaderLeft}>
                                <Ionicons name="swap-vertical" size={16} color="#6366f1" />
                                <Text style={styles.transitCardHeaderText}>이동 경로</Text>
                              </View>
                              <View style={styles.transitCardHeaderRight}>
                                <Text style={styles.transitCardTotalTime}>
                                  총 {calculateTotalTransitTime(item.transit_to_here)}
                                </Text>
                              </View>
                            </View>

                            {/* 타임라인 */}
                            <View style={styles.transitTimeline}>
                              {item.transit_to_here.map((t, i) => {
                                const step = parseTransitStep(t);
                                const isLast = i === item.transit_to_here.length - 1;

                                // 아이콘 설정
                                let iconName: keyof typeof Ionicons.glyphMap = 'ellipse';
                                let iconBg = '#e5e7eb';
                                let iconColor = '#64748b';
                                let accentColor = '#64748b';

                                if (step.type === 'walk') {
                                  iconName = 'walk';
                                  iconBg = '#dbeafe';
                                  iconColor = '#2563eb';
                                  accentColor = '#2563eb';
                                } else if (step.type === 'bus') {
                                  iconName = 'bus';
                                  iconBg = '#fef3c7';
                                  iconColor = '#d97706';
                                  accentColor = '#d97706';
                                } else if (step.type === 'subway') {
                                  iconName = 'subway';
                                  iconBg = '#d1fae5';
                                  iconColor = '#059669';
                                  accentColor = '#059669';
                                } else if (step.type === 'wait') {
                                  iconName = 'time';
                                  iconBg = '#ede9fe';
                                  iconColor = '#7c3aed';
                                  accentColor = '#7c3aed';
                                }

                                return (
                                  <View key={i} style={styles.transitStep}>
                                    {/* 타임라인 좌측 (점 + 선) */}
                                    <View style={styles.transitStepLeft}>
                                      <View style={[styles.transitStepDot, { backgroundColor: iconBg, borderColor: accentColor }]}>
                                        <Ionicons name={iconName} size={14} color={iconColor} />
                                      </View>
                                      {!isLast && <View style={[styles.transitStepLine, { backgroundColor: accentColor + '40' }]} />}
                                    </View>

                                    {/* 타임라인 우측 (정보) */}
                                    <View style={styles.transitStepRight}>
                                      <View style={styles.transitStepHeader}>
                                        <Text style={[styles.transitStepType, { color: accentColor }]}>
                                          {step.type === 'walk' ? '도보' : step.type === 'bus' ? '버스' : step.type === 'subway' ? '지하철' : step.type === 'wait' ? '대기' : '이동'}
                                        </Text>
                                        {step.duration && (
                                          <Text style={styles.transitStepDuration}>{step.duration}</Text>
                                        )}
                                        {step.delayText && step.delayColor && (
                                          <View style={[styles.transitDelayBadge, { backgroundColor: step.delayColor + '20', borderColor: step.delayColor }]}>
                                            <Ionicons name="warning" size={10} color={step.delayColor} />
                                            <Text style={[styles.transitDelayText, { color: step.delayColor }]}>
                                              {step.delayText}
                                            </Text>
                                          </View>
                                        )}
                                      </View>

                                      {/* 버스/지하철 노선 정보 */}
                                      {step.routes.length > 0 && (
                                        <View style={styles.transitRoutes}>
                                          {step.routes.map((route, ri) => (
                                            <View key={ri} style={[styles.transitRouteBadge, { backgroundColor: step.type === 'subway' ? '#d1fae5' : '#fef3c7' }]}>
                                              <Text style={[styles.transitRouteText, { color: step.type === 'subway' ? '#059669' : '#d97706' }]}>
                                                {route}
                                              </Text>
                                            </View>
                                          ))}
                                        </View>
                                      )}

                                      {/* 정류장 정보 */}
                                      {(step.fromStation || step.toStation) && (
                                        <View style={styles.transitStations}>
                                          {step.fromStation && (
                                            <Text style={styles.transitStationText}>{step.fromStation}</Text>
                                          )}
                                          {step.fromStation && step.toStation && (
                                            <Ionicons name="arrow-forward" size={12} color="#94a3b8" style={{ marginHorizontal: 6 }} />
                                          )}
                                          {step.toStation && (
                                            <Text style={styles.transitStationText}>{step.toStation}</Text>
                                          )}
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        )}

                        {/* 장소 카드 */}
                        <SortablePlaceCard
                          id={`place-${idx}`}
                          item={item}
                          idx={idx}
                          isEditMode={isEditMode}
                          isHovered={isHovered}
                          isSelected={selectedSpots.has(item.name)}
                          onHoverIn={() => setHoveredItem(idx)}
                          onHoverOut={() => setHoveredItem(null)}
                          onPress={() => zoomToLocation(idx)}
                          onDelete={() => deletePlace(activeDay, idx)}
                          onToggleSelect={() => toggleSpotSelection(item.name)}
                        />
                      </View>
                    );
                  })}
                </View>
              </SortableContext>
            </DndContext>

            {/* 여행 요약 */}
            <View style={styles.tripSummary}>
              <View style={styles.summaryCard}>
                <Ionicons name="information-circle" size={20} color="#6366f1" />
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryTitle}>여행 정보</Text>
                  <Text style={styles.summaryText}>
                    {planData.summary.transport_mode === 'walkAndPublic' ? '도보 + 대중교통' : '자가용'} 이용 ·
                    총 {timeline.length}개 장소 방문
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* 오른쪽: 지도 */}
        <View style={styles.rightPanel}>
          {Platform.OS === 'web' && typeof window !== 'undefined' && (
            <div
              ref={mapContainerRef}
              style={{ width: '100%', height: '100%' }}
            />
          )}
        </View>
      </View>

      {/* 대체 장소 추천 모달 */}
      {alternativesModalVisible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setAlternativesModalVisible(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              width: '100%',
              maxHeight: '80%',
              paddingBottom: 40,
              overflow: 'hidden',
            }}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>대체 장소 추천</Text>
              <Pressable onPress={() => setAlternativesModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>
            
            <Text style={styles.modalSubtitle}>
              선택한 {selectedSpots.size}개 장소의 대체 장소를 추천합니다.
            </Text>

            <ScrollView style={styles.alternativesList}>
              {Array.from(selectedSpots).map((spotName) => (
                <View key={spotName} style={styles.spotReplacementSection}>
                  <Text style={styles.replacementLabel}>{spotName} →</Text>
                  {alternatives
                    .filter((alt) => {
                      const originalSpot = timeline.find((item) => item.name === spotName);
                      return originalSpot?.category === alt.category;
                    })
                    .slice(0, 3)
                    .map((alt, altIdx) => (
                      <Pressable
                        key={altIdx}
                        style={styles.alternativeCard}
                        onPress={() => replaceSpotWithAlternative(spotName, alt)}
                      >
                        <View style={styles.alternativeCardContent}>
                          <View style={[styles.alternativeMarker, { backgroundColor: getCategoryColor(alt.category).accent }]}>
                            <Text style={styles.alternativeMarkerText}>{altIdx + 1}</Text>
                          </View>
                          <View style={styles.alternativeInfo}>
                            <Text style={styles.alternativeName}>{alt.name}</Text>
                            <View style={styles.alternativeMeta}>
                              <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(alt.category).bg }]}>
                                <Ionicons name={getCategoryIcon(alt.category) as any} size={12} color={getCategoryColor(alt.category).text} />
                                <Text style={[styles.categoryText, { color: getCategoryColor(alt.category).text }]}>
                                  {alt.category}
                                </Text>
                              </View>
                              {alt.reason && (
                                <Text style={styles.alternativeReason}>{alt.reason}</Text>
                              )}
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                        </View>
                      </Pressable>
                    ))}
                </View>
              ))}
            </ScrollView>
          </div>
        </div>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  // 왼쪽 패널
  leftPanel: {
    width: 435,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    flexShrink: 0,
  },
  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionBtnActive: {
    backgroundColor: '#eef2ff',
  },
  headerActionBtnDisabled: {
    opacity: 0.5,
  },
  headerTextBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  headerTextBtnLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  headerTextBtnPrimary: {
    backgroundColor: '#6366f1',
  },
  headerTextBtnLabelPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  editToolbar: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  editToolbarText: {
    flex: 1,
    marginRight: 12,
  },
  editToolbarTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338ca',
    marginBottom: 2,
  },
  editToolbarSubtitle: {
    fontSize: 12,
    color: '#6366f1',
  },
  editToolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editToolbarButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  editToolbarButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4b5563',
  },
  editToolbarPrimaryButton: {
    backgroundColor: '#6366f1',
  },
  editToolbarPrimaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  editToolbarIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editToolbarPrimaryOutline: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  editToolbarPrimaryOutlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4f46e5',
  },
  headerTextBtnRecommend: {
    backgroundColor: '#6366f1',
  },
  headerTextBtnLabelRecommend: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  // 일차 탭
  dayTabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dayTabsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    minWidth: 72,
  },
  dayTabActive: {
    backgroundColor: '#6366f1',
  },
  dayTabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  dayTabLabelActive: {
    color: '#ffffff',
  },
  dayTabDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  dayTabDateActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  // 날짜 헤더
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fafafa',
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  dateHeaderBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateHeaderBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4f46e5',
  },
  // 타임라인
  timelineScroll: {
    flex: 1,
  },
  timelineContainer: {
    padding: 16,
  },
  // 이동 구간
  travelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    marginVertical: 4,
    paddingVertical: 8,
  },
  travelLine: {
    width: 20,
    alignItems: 'center',
    marginRight: 12,
  },
  travelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  travelLineDash: {
    flex: 1,
    width: 2,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
    minHeight: 16,
  },
  travelInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  travelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  travelDistance: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1',
  },
  travelDuration: {
    fontSize: 12,
    color: '#64748b',
  },
  // 이동 상세
  transitDetail: {
    marginLeft: 48,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  transitDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  transitStepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transitStepTexts: {
    flex: 1,
    gap: 4,
  },
  transitMainText: {
    fontSize: 13,
    color: '#475569',
  },
  transitDelayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  transitDelayText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // 새 이동 구간 카드 스타일
  transitCard: {
    marginLeft: 24,
    marginRight: 8,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  transitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  transitCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transitCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transitCardHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  transitCardTotalTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366f1',
  },
  transitTimeline: {
    padding: 16,
  },
  transitStep: {
    flexDirection: 'row',
    minHeight: 48,
  },
  transitStepLeft: {
    width: 36,
    alignItems: 'center',
  },
  transitStepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    zIndex: 1,
  },
  transitStepLine: {
    width: 2,
    flex: 1,
    marginTop: -2,
    marginBottom: -2,
    minHeight: 20,
  },
  transitStepRight: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
    justifyContent: 'center'
  },
  transitStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  transitStepType: {
    fontSize: 14,
    fontWeight: '600',
  },
  transitStepDuration: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  transitRoutes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  transitRouteBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  transitRouteText: {
    fontSize: 13,
    fontWeight: '600',
  },
  transitStations: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  transitStationText: {
    fontSize: 13,
    color: '#64748b',
  },
  // 장소 카드
  placeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  placeCardHovered: {
    borderColor: '#e0e7ff',
    backgroundColor: '#fafbff',
  },
  placeCardDragging: {
    borderColor: '#6366f1',
    backgroundColor: '#f0f9ff',
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  placeCardSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  placeCardEdit: {
    borderWidth: 1,
    borderColor: '#e0e7ff',
    backgroundColor: '#fafbff',
  },
  editCheckboxArea: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginRight: 4,
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  placeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  placeMarkerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  placeContent: {
    flex: 1,
  },
  placeTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  placeTimeMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  courseOrderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  placeTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  placeTimeEnd: {
    fontSize: 13,
    color: '#94a3b8',
  },
  placeTimeUndefined: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  placeNameEdit: {
    fontSize: 15,
    marginBottom: 6,
  },
  placeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  detailButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  // 여행 요약
  tripSummary: {
    padding: 16,
    paddingTop: 8,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  // 오른쪽 지도 패널
  rightPanel: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  // 빈 상태
  emptyContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  // 대체 장소 모달
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  alternativesList: {
    flex: 1,
    paddingHorizontal: 20,
    maxHeight: 400,
  },
  spotReplacementSection: {
    marginBottom: 24,
  },
  replacementLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  alternativeCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  alternativeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  alternativeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alternativeMarkerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  alternativeInfo: {
    flex: 1,
  },
  alternativeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  alternativeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alternativeReason: {
    fontSize: 12,
    color: '#64748b',
  },
});
