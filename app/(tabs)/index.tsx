import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions, Animated, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { usePlaces } from '@/contexts/PlacesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { planService, recordService, API_URL, SavedPlanListItem, SavedPlanDetailResponse, CreateCourseResponse, type SpotListItem } from '@/services';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ConfirmModal from '@/components/ConfirmModal';
import FullScreenLoader from '@/components/FullScreenLoader';

const { width } = Dimensions.get('window');
const STORAGE_BASE = API_URL.replace(/\/otp\/?$/, '');

const resolveStorageUrl = (url?: string | null) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${STORAGE_BASE}${url}`;
  return `${STORAGE_BASE}/${url}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '날짜 없음';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
  } catch {
    return value;
  }
};

export default function HomeScreen() {
  const router = useRouter();
  const { clearPlaces, isCourseGenerating, courseGenerationStatus, clearCourseGenerationStatus, lastGeneratedPlan, setLastGeneratedPlan } = usePlaces();
  const { user, logout } = useAuth();
  const { startGlobalLoading, endGlobalLoading } = useSession();
  const { isOnline: _isOnline } = useNetwork();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // 로딩 상태 관리 - 데이터를 불러올 때 사용
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [userPlansCount, setUserPlansCount] = useState(0);
  const [recentPlan, setRecentPlan] = useState<SavedPlanListItem | null>(null);
  const [recentCourseDetail, setRecentCourseDetail] = useState<SavedPlanDetailResponse | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // 선택된 일자 (day1, day2 등)
  const [savedPlans, setSavedPlans] = useState<SavedPlanListItem[]>([]);
  const [spots, setSpots] = useState<SpotListItem[]>([]);
  const [openingPlanId, setOpeningPlanId] = useState<string | null>(null);

  // 방금 생성된 플랜 (저장 전이라도 바로 표시)
  const generatedPlan = lastGeneratedPlan as CreateCourseResponse | null;
  // 표시할 코스: 생성 중이 아닐 때, 생성된 플랜 > 저장된 플랜
  const displayCourse = isCourseGenerating ? null : (generatedPlan || recentCourseDetail);
  const hasDisplayData = !!displayCourse;

  // 펄스 애니메이션 효과
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // 화면 포커스 시 데이터 새로고침 (코스 생성 중에는 스킵)
  useFocusEffect(
    useCallback(() => {
      if (user && !isCourseGenerating) {
        loadUserData();
      }
    }, [user, isCourseGenerating])
  );

  // 코스 생성 완료 시 데이터 새로고침
  const prevGeneratingRef = useRef(false);
  useEffect(() => {
    if (courseGenerationStatus === 'success' && user) {
      setSelectedDay(null);
      loadUserData();
      clearCourseGenerationStatus();
    }
    // isCourseGenerating 전환도 감지 (fallback)
    if (prevGeneratingRef.current && !isCourseGenerating && user) {
      setTimeout(() => loadUserData(), 800);
    }
    prevGeneratingRef.current = isCourseGenerating;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseGenerationStatus, isCourseGenerating, user]);

  // 표시할 코스가 변경되면 첫 번째 일자를 기본 선택
  useEffect(() => {
    const course = isCourseGenerating ? null : (generatedPlan || recentCourseDetail);
    if (course?.variants) {
      const dayVariants = Object.entries(course.variants).filter(
        (entry) => Array.isArray(entry[1]?.route)
      );
      if (dayVariants.length > 0) {
        setSelectedDay(dayVariants[0][0]);
      }
    }
  }, [lastGeneratedPlan, generatedPlan, recentCourseDetail, isCourseGenerating]);

  /**
   * 사용자 데이터를 불러오는 함수
   * 저장된 플랜 목록을 API에서 가져옴
   */
  const loadUserData = async () => {
    if (!user) {
      setRecentPlan(null);
      setUserPlansCount(0);
      return;
    }

    // 코스 생성 중이거나 이미 생성된 플랜이 있으면 로딩 UI 불필요
    const showLoading = !isCourseGenerating && !lastGeneratedPlan;
    if (showLoading) {
      setIsLoadingData(true);
      startGlobalLoading();
    }

    try {
      // 저장된 플랜 목록 조회 (최근 3개) + 개인 기록 조회 (최근 3개) 병렬
      const [plansResponse, spotsResponse] = await Promise.all([
        planService.getSavedPlans(3),
        recordService.listSpots({ limit: 3 }),
      ]);

      const plans = plansResponse.items || [];
      setSavedPlans(plans);
      setSpots(spotsResponse.items || []);
      setUserPlansCount(plans.length);

      // 가장 최근 플랜 설정 (히어로 카드용)
      if (plans.length > 0) {
        setRecentPlan(plans[0]);

        // saved_plan_id로 상세 코스 정보 조회
        try {
          const detail = await planService.getSavedPlanDetail(plans[0].saved_plan_id);
          setRecentCourseDetail(detail);
        } catch {
          setRecentCourseDetail(null);
        }
      } else {
        setRecentPlan(null);
        setRecentCourseDetail(null);
      }

    } catch (error) {
      console.error('데이터 로딩 실패:', error);
      setRecentPlan(null);
      setRecentCourseDetail(null);
      setSavedPlans([]);
      setSpots([]);
      setUserPlansCount(0);
    } finally {
      setIsLoadingData(false);
      if (showLoading) {
        endGlobalLoading();
      }
    }
  };

  const handleOpenSavedPlan = useCallback(async (savedPlanId: string) => {
    if (openingPlanId) return;
    setOpeningPlanId(savedPlanId);
    try {
      const detail = await planService.getSavedPlanDetail(savedPlanId);
      const rawVariants = (detail.variants || {}) as Record<string, any>;
      const variantsSummary = rawVariants.summary as any | undefined;
      const { summary: _ignore, ...variants } = rawVariants;
      const summary = {
        region: variantsSummary?.region ?? detail.region ?? detail.summary?.region ?? '',
        start_date: variantsSummary?.start_date ?? detail.date ?? '',
        end_date: variantsSummary?.end_date ?? detail.date ?? '',
        transport: variantsSummary?.transport ?? detail.summary?.transport ?? '',
        crowd_mode: variantsSummary?.crowd_mode ?? detail.summary?.crowd_mode ?? '',
        transport_mode: variantsSummary?.transport_mode ?? 'walkAndPublic',
      };
      setLastGeneratedPlan({ plan_id: detail.plan_id, summary, variants });
      router.push('/(tabs)/results');
    } catch (error) {
      console.error('플랜 불러오기 실패:', error);
      Toast.show({ type: 'error', text1: '불러오기 실패', text2: '플랜을 불러오는 중 오류가 발생했습니다.' });
    } finally {
      setOpeningPlanId(null);
    }
  }, [openingPlanId, router, setLastGeneratedPlan]);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const performLogout = async () => {
    setShowLogoutModal(false);
    
    try {
      await logout();
      Toast.show({
        type: 'success',
        text1: '로그아웃 완료',
        text2: '다음에 또 만나요! 👋',
        position: 'top',
        visibilityTime: 2000,
      });
      setTimeout(() => {
        router.replace('/login');
      }, 500);
    } catch (error) {
      console.error('로그아웃 오류:', error);
      Toast.show({
        type: 'error',
        text1: '오류 발생',
        text2: '로그아웃 중 오류가 발생했습니다.',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <LinearGradient colors={['#6366f1', '#38bdf8']} style={styles.logo}>
            <Text style={styles.logoText}>O</Text>
          </LinearGradient>
          <Text style={styles.headerTitle}>OpenTripPlanner</Text>
        </View>
        <View style={styles.headerRight}>
          {user ? (
            <>
              <Text style={styles.userName}>{user.name}님</Text>
              <Pressable onPress={handleLogout}>
                <Text style={styles.logoutButton}>로그아웃</Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => router.push('/login')}>
              <Text style={styles.loginButton}>로그인</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* 히어로 섹션 */}
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.tagline}>여행 플랜 · 동선 최적화</Text>
          <Text style={styles.title}>사진 한 장으로 시작하는{'\n'}나만의 동선 플래너</Text>
          <Text style={styles.description}>
            날짜·시간·교통수단만 입력하면{'\n'}
            혼잡도와 교통까지 반영한 여행 코스를 만들어 드려요.
          </Text>
          
          {/* CTA 버튼 */}
          <View style={styles.heroButtons}>
            <Pressable 
              style={styles.heroPrimaryButton}
              onPress={() => {
                clearPlaces();
                router.push('/course');
              }}>
              <LinearGradient 
                colors={['#6366f1', '#38bdf8']} 
                style={styles.heroPrimaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}>
                <Text style={styles.heroPrimaryButtonText}>새 여행 플랜 만들기</Text>
              </LinearGradient>
            </Pressable>
            
            <Pressable 
              style={styles.heroSecondaryButton}
              onPress={() => router.push('/records')}>
              <Text style={styles.heroSecondaryButtonText}>내 여행 기록에서 시작</Text>
            </Pressable>
          </View>
        </View>

        {/* 플랜 카드 - 실제 데이터 / 생성 중 / 예시 */}
        <Pressable
          style={[
            styles.exampleCard,
            isCourseGenerating && styles.exampleCardGenerating,
          ]}
          onPress={
            (isCourseGenerating || hasDisplayData)
              ? () => router.push('/(tabs)/results')
              : undefined
          }
          disabled={!isCourseGenerating && !hasDisplayData}
        >
          {/* 헤더 */}
          <View style={[
            styles.exampleHeader,
            isCourseGenerating && styles.exampleHeaderGenerating,
          ]}>
            <Text style={styles.exampleHeaderText}>
              {isCourseGenerating
                ? '실시간 코스 생성 중'
                : generatedPlan
                  ? `${generatedPlan.summary.region} 여행`
                  : recentPlan
                    ? (recentPlan.title || `${recentPlan.region} 여행`)
                    : (user ? '첫 여행을 시작해보세요!' : '오늘 같이 갈까?')
              }
            </Text>
            <View style={styles.pulse}>
              <Animated.View
                style={[
                  styles.pulseDot,
                  {
                    transform: [{ scale: pulseAnim }],
                    backgroundColor: isCourseGenerating ? '#34d399' : (hasDisplayData ? '#34d399' : '#94a3b8')
                  }
                ]}
              />
              <Text style={styles.exampleHeaderSubtext}>
                {isCourseGenerating
                  ? '생성 중...'
                  : generatedPlan
                    ? '마지막으로 본 플랜'
                    : recentPlan
                      ? '저장된 플랜'
                      : '플랜 생성 대기'
                }
              </Text>
            </View>
          </View>

          {/* 코스 생성 중 상태 */}
          {isCourseGenerating ? (
            <View style={styles.generatingCardContent}>
              <View style={styles.generatingProgressArea}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <View style={styles.generatingIconCircle}>
                    <Text style={styles.generatingIconText}>~</Text>
                  </View>
                </Animated.View>
                <Text style={styles.generatingMainText}>코스를 만들고 있어요</Text>
                <Text style={styles.generatingSubText}>
                  혼잡도와 교통 정보를 분석하여{'\n'}최적의 동선을 설계하고 있어요
                </Text>
              </View>

              <View style={styles.generatingSteps}>
                <View style={styles.generatingStepRow}>
                  <View style={[styles.generatingStepDot, styles.generatingStepDotDone]} />
                  <Text style={styles.generatingStepLabel}>장소 선정 및 필터링</Text>
                </View>
                <View style={styles.generatingStepRow}>
                  <View style={[styles.generatingStepDot, styles.generatingStepDotActive]} />
                  <Text style={[styles.generatingStepLabel, styles.generatingStepLabelActive]}>동선 최적화 · 혼잡도 반영</Text>
                </View>
                <View style={styles.generatingStepRow}>
                  <View style={styles.generatingStepDot} />
                  <Text style={[styles.generatingStepLabel, styles.generatingStepLabelPending]}>타임라인 생성</Text>
                </View>
              </View>

              <Pressable
                style={styles.generatingCta}
                onPress={() => router.push('/(tabs)/results')}
              >
                <Text style={styles.generatingCtaText}>결과 페이지에서 확인하기</Text>
                <Text style={styles.generatingCtaArrow}>→</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.exampleContent}>
                {/* 왼쪽: 일정 요약 카드 */}
                <View style={styles.exampleLeft}>
                  <View style={styles.exampleInfoCard}>
                    <Text style={styles.exampleInfoTitle}>
                      {generatedPlan
                        ? `${generatedPlan.summary.start_date} ~ ${generatedPlan.summary.end_date}`
                        : recentPlan
                          ? recentPlan.date
                          : '오늘'}
                    </Text>

                    {displayCourse ? (
                      (() => {
                        const dayVariants = Object.entries(displayCourse.variants).filter(
                          (entry): entry is [string, typeof entry[1] & { route: unknown[]; timelines?: any }] =>
                            Array.isArray(entry[1]?.route)
                        );

                        // 코스 개수는 결과 탭과 동일하게
                        // - 우선 timeline.fastest_version 길이
                        // - 없으면 route 길이
                        const totalCourses = dayVariants.reduce((sum, [, day]) => {
                          const timelines =
                            (day.timelines?.fastest_version?.length
                              ? day.timelines.fastest_version
                              : day.timelines?.min_transfer_version) || [];
                          if (timelines.length > 0) {
                            return sum + timelines.length;
                          }
                          const routeLen = Array.isArray(day.route) ? day.route.length : 0;
                          return sum + routeLen;
                        }, 0);

                        const activeDay = selectedDay || (dayVariants.length > 0 ? dayVariants[0][0] : null);

                        return (
                          <View style={styles.courseSummary}>
                            <View style={styles.courseSummaryHeader}>
                              <View style={styles.courseSummaryTag}>
                                <Text style={styles.courseSummaryTagText}>
                                  {dayVariants.length}일 여행
                                </Text>
                              </View>
                              <View style={styles.courseSummaryTag}>
                                <Text style={styles.courseSummaryTagText}>
                                  {totalCourses}개 코스
                                </Text>
                              </View>
                              <View style={styles.courseSummaryTag}>
                                <Text style={styles.courseSummaryTagText}>
                                  {displayCourse.summary?.transport === 'car' ? '차량' : '대중교통'}
                                </Text>
                              </View>
                              <View style={[styles.courseSummaryTag, styles.courseSummaryTagHighlight]}>
                                <Text style={styles.courseSummaryTagHighlightText}>혼잡도 반영</Text>
                              </View>
                            </View>

                            <View style={styles.daySelectorSection}>
                              <Text style={styles.courseSummaryLabel}>일자 선택</Text>
                              {dayVariants.map(([day, dayPlan]) => {
                                const isSelected = day === activeDay;

                                const timelines =
                                  (dayPlan.timelines?.fastest_version?.length
                                    ? dayPlan.timelines.fastest_version
                                    : dayPlan.timelines?.min_transfer_version) || [];

                                // 결과 탭과 동일하게: 타임라인이 있으면 타임라인 순서 기준,
                                // 없으면 route 기준으로 장소 이름 나열
                                const sourcePlaces: { name: string }[] =
                                  timelines.length > 0
                                    ? timelines
                                    : Array.isArray(dayPlan.route)
                                      ? dayPlan.route
                                      : [];

                                const placeNames = sourcePlaces.map((p) => p.name);

                                return (
                                  <Pressable
                                    key={day}
                                    onPress={() => setSelectedDay(day)}
                                    style={[
                                      styles.courseDayRow,
                                      isSelected && styles.courseDayRowSelected
                                    ]}
                                  >
                                    <View
                                      style={[
                                        styles.courseDayBadge,
                                        isSelected && styles.courseDayBadgeSelected
                                      ]}
                                    >
                                      <Text style={styles.courseDayBadgeText}>
                                        {day.replace('day', 'D')}
                                      </Text>
                                    </View>
                                    <Text style={styles.courseDayText} numberOfLines={1}>
                                      {placeNames.length > 0 ? placeNames.join(' → ') : '장소 정보 없음'}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })()
                    ) : (
                      <Text style={styles.exampleInfoDesc}>
                        코스 자동 구성 완료
                      </Text>
                    )}
                  </View>
                </View>

                {/* 오른쪽: 시간 정보 + 혼잡 구간 경고 */}
                <View style={styles.exampleRight}>
                  {displayCourse ? (
                    (() => {
                      const dayVariants = Object.entries(displayCourse.variants).filter(
                        (entry): entry is [string, typeof entry[1] & { route: unknown[] }] =>
                          Array.isArray(entry[1]?.route)
                      );

                      const calculateDayCongestion = (dayPlan: typeof dayVariants[0][1]) => {
                        let congestionCount = 0;
                        const timelines = dayPlan.timelines?.fastest_version || dayPlan.timelines?.min_transfer_version || [];
                        timelines.forEach((item: any) => {
                          if (
                            (item.traffic_level && typeof item.traffic_level === 'string' && item.traffic_level.includes('🔴')) ||
                            (item.population_level && typeof item.population_level === 'string' && item.population_level.includes('🔴'))
                          ) {
                            congestionCount++;
                          }
                        });
                        return congestionCount;
                      };

                      const formatTime = (minutes: number) => {
                        const hours = Math.floor(minutes / 60);
                        const mins = minutes % 60;
                        if (hours > 0) {
                          return `${hours}시간 ${mins > 0 ? `${mins}분` : ''}`;
                        }
                        return `${mins}분`;
                      };

                      const calculateDayTimes = (dayPlan: typeof dayVariants[0][1]) => {
                        let stayMinutes = 0;
                        let transitMinutes = 0;
                        let hasTimelineData = false;
                        const timelines = dayPlan.timelines?.fastest_version || dayPlan.timelines?.min_transfer_version || [];
                        if (timelines.length > 0) {
                          hasTimelineData = true;
                          timelines.forEach((item: { time?: string; transit_to_here?: string[] }) => {
                            if (item.time) {
                              const timeMatch = item.time.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
                              if (timeMatch) {
                                stayMinutes += (parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4])) - (parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]));
                              }
                            }
                            if (item.transit_to_here && Array.isArray(item.transit_to_here)) {
                              item.transit_to_here.forEach((transit: string) => {
                                const transitMatch = transit.match(/(\d+)\s*분/);
                                if (transitMatch) transitMinutes += parseInt(transitMatch[1]);
                              });
                            }
                          });
                        } else {
                          const routeCount = dayPlan.route?.length || 0;
                          if (routeCount > 0) {
                            stayMinutes = routeCount * 60;
                            transitMinutes = Math.max(0, (routeCount - 1) * 15);
                          }
                        }
                        return { stayMinutes, transitMinutes, hasTimelineData };
                      };

                      const dayInfoMap = new Map<string, { stayMinutes: number; transitMinutes: number; congestionCount: number; hasTimelineData: boolean }>();
                      dayVariants.forEach(([day, dayPlan]) => {
                        const { stayMinutes, transitMinutes, hasTimelineData } = calculateDayTimes(dayPlan);
                        dayInfoMap.set(day, { stayMinutes, transitMinutes, congestionCount: calculateDayCongestion(dayPlan), hasTimelineData });
                      });

                      const activeDay = selectedDay || (dayVariants.length > 0 ? dayVariants[0][0] : null);
                      const activeDayInfo = activeDay ? dayInfoMap.get(activeDay) : null;
                      const { stayMinutes = 0, transitMinutes = 0, congestionCount: activeDayCongestion = 0, hasTimelineData = false } = activeDayInfo || {};

                      return (
                        <>
                          {activeDay && (
                            <View style={styles.timeInfoSection}>
                              <Text style={styles.selectedDayLabel}>
                                {activeDay.replace('day', 'D')} 일정
                              </Text>
                              <View style={styles.statRow}>
                                <Text style={styles.statLabel}>예상 소요시간</Text>
                                {stayMinutes > 0 ? (
                                  <Text style={styles.statValue}>
                                    {formatTime(stayMinutes)}
                                    {!hasTimelineData && <Text style={styles.estimatedText}> (추정)</Text>}
                                  </Text>
                                ) : (
                                  <Text style={styles.statValue}>정보 없음</Text>
                                )}
                              </View>
                              <View style={styles.statRow}>
                                <Text style={styles.statLabel}>이동 시간</Text>
                                {transitMinutes > 0 ? (
                                  <Text style={styles.statValue}>
                                    {formatTime(transitMinutes)}
                                    {!hasTimelineData && <Text style={styles.estimatedText}> (추정)</Text>}
                                  </Text>
                                ) : (
                                  <Text style={styles.statValue}>정보 없음</Text>
                                )}
                              </View>
                            </View>
                          )}
                          {activeDay && (
                            <View style={[
                              styles.congestionRowSimple,
                              activeDayCongestion > 0 && styles.congestionRowHighlighted
                            ]}>
                              <Text style={styles.statLabel}>혼잡 구간 경고</Text>
                              {activeDayCongestion > 0 ? (
                                <View style={styles.warningBadge}>
                                  <View style={styles.warningDot} />
                                  <Text style={styles.warningText}>{activeDayCongestion}곳</Text>
                                </View>
                              ) : (
                                <Text style={styles.noCongestionText}>없음</Text>
                              )}
                            </View>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>혼잡 구간 경고</Text>
                      <View style={styles.warningBadge}>
                        <View style={styles.warningDot} />
                        <Text style={styles.warningText}>1곳</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* 하단 CTA */}
              {hasDisplayData ? (
                <View style={styles.planCardCta}>
                  <Text style={styles.planCardCtaText}>상세 일정 보기</Text>
                </View>
              ) : (
                <Pressable
                  style={styles.exampleCta}
                  onPress={() => {
                    clearPlaces();
                    router.push('/course');
                  }}
                >
                  <LinearGradient
                    colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                    style={styles.exampleCtaGradient}
                  >
                    <Text style={styles.exampleCtaText}>
                      {user ? '나만의 플랜 만들기' : '로그인하고 플랜 만들기'}
                    </Text>
                    <Text style={styles.exampleCtaArrow}>→</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </>
          )}
        </Pressable>
        </View>

      {/* 저장된 플랜 섹션 */}
      {user && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="bookmark" size={18} color="#6366f1" />
              <Text style={styles.sectionTitleText}>저장된 플랜</Text>
            </View>
            <Pressable onPress={() => router.push('/records?tab=plans')} style={styles.moreButton}>
              <Text style={styles.moreButtonText}>더보기</Text>
              <Ionicons name="chevron-forward" size={14} color="#6366f1" />
            </Pressable>
          </View>

          {savedPlans.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>저장된 플랜이 없습니다</Text>
              <Text style={styles.emptySectionSubtext}>추천 결과에서 플랜을 저장해보세요.</Text>
            </View>
          ) : (
            savedPlans.map((plan) => {
              const isOpening = openingPlanId === plan.saved_plan_id;
              const title = plan.title || `${plan.region} 여행`;
              const isBusy = openingPlanId !== null;
              return (
                <Pressable
                  key={plan.saved_plan_id}
                  style={[styles.savedPlanCard, isBusy && { opacity: 0.6 }]}
                  onPress={() => handleOpenSavedPlan(plan.saved_plan_id)}
                  disabled={isBusy}
                >
                  <View style={styles.savedPlanCardLeft}>
                    <View style={styles.savedPlanIcon}>
                      <Ionicons name="map" size={16} color="#6366f1" />
                    </View>
                    <View style={styles.savedPlanInfo}>
                      <Text style={styles.savedPlanTitle} numberOfLines={1}>{title}</Text>
                      <Text style={styles.savedPlanMeta}>{plan.region} · {plan.date}</Text>
                    </View>
                  </View>
                  {isOpening ? (
                    <ActivityIndicator size="small" color="#6366f1" />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {/* 개인 기록 섹션 */}
      {user && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="location" size={18} color="#6366f1" />
              <Text style={styles.sectionTitleText}>개인 기록</Text>
            </View>
            <Pressable onPress={() => router.push('/records')} style={styles.moreButton}>
              <Text style={styles.moreButtonText}>더보기</Text>
              <Ionicons name="chevron-forward" size={14} color="#6366f1" />
            </Pressable>
          </View>

          {spots.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>등록된 기록이 없습니다</Text>
              <Text style={styles.emptySectionSubtext}>사진 업로드 후 장소를 등록해보세요.</Text>
            </View>
          ) : (
            spots.map((spot) => {
              const thumbnailUrl = resolveStorageUrl(spot.thumbnail_url);
              return (
                <Pressable
                  key={spot.spot_id}
                  style={styles.spotCard}
                  onPress={() => router.push(`/record?spot_id=${spot.spot_id}`)}
                >
                  <View style={styles.spotThumbnail}>
                    {thumbnailUrl ? (
                      <Image source={{ uri: thumbnailUrl }} style={styles.spotThumbnailImage} />
                    ) : (
                      <LinearGradient colors={['#e0e7ff', '#c7d2fe']} style={styles.spotThumbnailPlaceholder}>
                        <Ionicons name="image-outline" size={20} color="#818cf8" />
                      </LinearGradient>
                    )}
                  </View>
                  <View style={styles.spotInfo}>
                    <Text style={styles.spotName} numberOfLines={1}>{spot.place.name}</Text>
                    <Text style={styles.spotAddress} numberOfLines={1}>{spot.place.address || '주소 없음'}</Text>
                    <View style={styles.spotMetaRow}>
                      <Text style={styles.spotDate}>{formatDate(spot.visited_at)}</Text>
                      <Text style={styles.spotCategory}>{spot.place.category || '기타'}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                </Pressable>
              );
            })
          )}
        </View>
      )}

      </ScrollView>

      {/* 로그아웃 확인 모달 */}
      <ConfirmModal
        visible={showLogoutModal}
        title="로그아웃"
        message="정말 로그아웃 하시겠습니까?"
        confirmText="로그아웃"
        cancelText="취소"
        type="warning"
        onConfirm={performLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
      
      {/* 전체 화면 로딩 - 데이터를 불러올 때 표시됩니다 */}
      <FullScreenLoader
        visible={isLoadingData && !isCourseGenerating && !generatedPlan}
        message="데이터를 불러오는 중..."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    boxShadow: '0 2px 3px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1e293b',
    flexShrink: 1,
  },
  exampleCardGenerating: {
    borderColor: '#c7d2fe',
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.18)',
  },
  exampleHeaderGenerating: {
    backgroundColor: '#312e81',
  },
  generatingCardContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  generatingProgressArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  generatingIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#c7d2fe',
  },
  generatingIconText: {
    fontSize: 22,
    color: '#6366f1',
    fontWeight: '700',
  },
  generatingMainText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e1b4b',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  generatingSubText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
  },
  generatingSteps: {
    width: '100%',
    gap: 10,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  generatingStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  generatingStepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#cbd5e1',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  generatingStepDotDone: {
    backgroundColor: '#34d399',
    borderColor: '#a7f3d0',
  },
  generatingStepDotActive: {
    backgroundColor: '#6366f1',
    borderColor: '#c7d2fe',
  },
  generatingStepLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  generatingStepLabelActive: {
    color: '#4338ca',
    fontWeight: '700',
  },
  generatingStepLabelPending: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  generatingCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    gap: 8,
  },
  generatingCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4338ca',
  },
  generatingCtaArrow: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },
  headerLink: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    flexShrink: 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userName: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  loginButton: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutButton: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
  },
  hero: {
    padding: 20,
  },
  heroText: {
    marginBottom: 24,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 14,
    lineHeight: 34,
    flexWrap: 'wrap',
  },
  description: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
    flexWrap: 'wrap',
  },
  heroButtons: {
    flexDirection: width < 400 ? 'column' : 'row',
    gap: 12,
    marginTop: 24,
  },
  heroPrimaryButton: {
    flex: width < 400 ? 0 : 1,
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 3px 6px rgba(199, 210, 254, 0.4)',
    elevation: 3,
  },
  heroPrimaryButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  heroSecondaryButton: {
    flex: width < 400 ? 0 : 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  heroSecondaryButtonText: {
    color: '#1e293b',
    fontSize: 15,
    fontWeight: '600',
  },
  exampleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8ecf4',
    padding: 18,
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.1)',
    elevation: 6,
  },
  exampleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e1b4b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  exampleHeaderText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  pulse: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34d399',
    marginRight: 6,
  },
  exampleHeaderSubtext: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '500',
  },
  exampleContent: {
    flexDirection: width < 400 ? 'column' : 'row',
    gap: 14,
  },
  exampleLeft: {
    flex: 1.2,
    minWidth: width < 400 ? '100%' : undefined,
  },
  exampleImageContainer: {
    marginBottom: 12,
  },
  exampleImage: {
    height: 140,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exampleImageText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 8,
  },
  // 지도 경로 시각화 스타일
  mapRouteContainer: {
    position: 'relative',
    width: '80%',
    height: 60,
    marginBottom: 8,
  },
  routeLine: {
    position: 'absolute',
    top: '50%',
    left: 10,
    right: 10,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2,
  },
  routePoint: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  routePointStart: {
    left: 0,
    top: '50%',
    marginTop: -12,
    backgroundColor: '#34d399',
  },
  routePointMid: {
    left: '50%',
    marginLeft: -12,
    top: '50%',
    marginTop: -12,
    backgroundColor: '#fbbf24',
  },
  routePointEnd: {
    right: 0,
    top: '50%',
    marginTop: -12,
    backgroundColor: '#f87171',
  },
  routePointText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  exampleBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  exampleBadgeText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
  },
  exampleInfoCard: {
    backgroundColor: '#f8f9ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    borderRadius: 16,
    padding: 16,
  },
  exampleInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  exampleInfoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e1b4b',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  exampleInfoBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  exampleInfoBadgeText: {
    fontSize: 10,
    color: '#4338ca',
    fontWeight: '600',
  },
  exampleInfoDesc: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
  },
  courseSummary: {
    gap: 10,
    marginTop: 6,
  },
  daySelectorSection: {
    gap: 6,
    marginTop: 10,
  },
  timeInfoSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2ff',
  },
  congestionSection: {
    gap: 10,
  },
  congestionDayRow: {
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  congestionRowSimple: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  congestionRowHighlighted: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  congestionDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  courseSummaryHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  courseSummaryTag: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  courseSummaryTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5b21b6',
  },
  courseSummaryTagHighlight: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  courseSummaryTagHighlightText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  courseSummaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: 0.2,
  },
  courseDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  courseDayRowSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#818cf8',
  },
  courseDayBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 36,
    alignItems: 'center',
  },
  courseDayBadgeSelected: {
    backgroundColor: '#6366f1',
  },
  courseDayBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  courseDayText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  courseSummaryRight: {
    gap: 8,
    marginBottom: 12,
  },
  exampleRight: {
    flex: 1,
    minWidth: width < 400 ? '100%' : undefined,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statsSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  selectedDayLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4338ca',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  congestionRow: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  noCongestionText: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '700',
  },
  estimatedText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '400',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  warningDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
    marginRight: 5,
  },
  warningText: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '700',
  },
  courseComparison: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    marginTop: 4,
  },
  courseARow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  courseAText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
  },
  recommendBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  courseBRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseBText: {
    fontSize: 11,
    color: '#64748b',
  },
  compareLink: {
    fontSize: 11,
    color: '#6366f1',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  compareHint: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  // 실제 플랜 카드 스타일
  planCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  planCardGradient: {
    padding: 20,
    borderRadius: 20,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planCardHeaderLeft: {
    flex: 1,
  },
  planCardLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginBottom: 4,
  },
  planCardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  planCardBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  planCardBadgeText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  planCardBody: {
    marginBottom: 16,
  },
  planCardInfo: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  planInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planInfoIcon: {
    fontSize: 14,
  },
  planInfoText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  planVariants: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  planVariantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planVariantDay: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.7)',
    width: 40,
  },
  planVariantText: {
    flex: 1,
    fontSize: 13,
    color: '#ffffff',
  },
  planCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  planCardFooterText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  planCardArrow: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '300',
  },
  morePlansHint: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -4,
  },
  morePlansText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
  // 예시 카드 개선 스타일
  exampleImageContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  exampleEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  exampleImageSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  exampleCta: {
    marginTop: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  exampleCtaGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  exampleCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4338ca',
  },
  exampleCtaArrow: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },
  // 실제 플랜 카드 하단 CTA
  planCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    gap: 8,
  },
  planCardCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4338ca',
  },
  planCardCtaArrow: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },
  morePlansBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 4,
  },
  morePlansBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  entryCards: {
    gap: 16,
    flexDirection: 'column',
  },
  entryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  entryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  entryCardTag: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  entryCardTagGreen: {
    color: '#059669',
  },
  entryCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.3,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  entryCardDesc: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  entryCardArrow: {
    fontSize: 24,
    color: '#cbd5e1',
    fontWeight: '300',
  },
  entryCardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  entryTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  entryTagText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoColumn: {
    gap: 10,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  infoItem: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },

  // ── 저장된 플랜 & 개인 기록 섹션 ──
  sectionContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  moreButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
  },
  emptySection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  emptySectionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  emptySectionSubtext: {
    fontSize: 12,
    color: '#cbd5e1',
  },

  // 저장된 플랜 카드
  savedPlanCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  savedPlanCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  savedPlanIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedPlanInfo: {
    flex: 1,
    gap: 2,
  },
  savedPlanTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  savedPlanMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },

  // 개인 기록 카드
  spotCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  spotThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
  },
  spotThumbnailImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  spotThumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotInfo: {
    flex: 1,
    gap: 2,
  },
  spotName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  spotAddress: {
    fontSize: 12,
    color: '#94a3b8',
  },
  spotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  spotDate: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  spotCategory: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '500',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
