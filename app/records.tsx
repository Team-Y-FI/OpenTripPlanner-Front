import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { usePlaces } from '@/contexts/PlacesContext';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL, recordService, planService, type SpotListItem, type SavedPlanListItem } from '@/services';

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

export default function RecordsScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const { setSelectedPlaces, setLastGeneratedPlan } = usePlaces();
  const [activeTab, setActiveTab] = useState(tab === 'plans' ? 'plans' : 'spots');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [spots, setSpots] = useState<SpotListItem[]>([]);
  const [selectedSpotIds, setSelectedSpotIds] = useState<Set<string>>(new Set());
  const [savedPlans, setSavedPlans] = useState<SavedPlanListItem[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [openingPlanId, setOpeningPlanId] = useState<string | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const loadSpots = useCallback(async () => {
    if (!user) {
      setSpots([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await recordService.listSpots({ limit: 50 });
      setSpots(response.items || []);
    } catch (error) {
      console.error('기록 로딩 실패:', error);
      Toast.show({
        type: 'error',
        text1: '불러오기 실패',
        text2: '기록을 불러오는 중 오류가 발생했습니다.',
      });
      setSpots([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const loadSavedPlans = useCallback(async () => {
    if (!user) {
      setSavedPlans([]);
      return;
    }
    setIsLoadingPlans(true);
    try {
      const response = await planService.getSavedPlans(50);
      setSavedPlans(response.items || []);
    } catch (error) {
      console.error('저장된 플랜 로딩 실패:', error);
      Toast.show({
        type: 'error',
        text1: '불러오기 실패',
        text2: '저장된 플랜을 불러오는 중 오류가 발생했습니다.',
      });
      setSavedPlans([]);
    } finally {
      setIsLoadingPlans(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadSpots();
      void loadSavedPlans();
    }, [loadSpots, loadSavedPlans])
  );

  useEffect(() => {
    if (activeTab === 'plans') {
      void loadSavedPlans();
    }
  }, [activeTab, loadSavedPlans]);

  const toggleSelect = (spotId: string) => {
    setSelectedSpotIds((prev) => {
      const next = new Set(prev);
      if (next.has(spotId)) next.delete(spotId);
      else next.add(spotId);
      return next;
    });
  };

  const handleCreateCourse = () => {
    const selected = spots.filter((s) => selectedSpotIds.has(s.spot_id));
    if (selected.length === 0) {
      Toast.show({
        type: 'info',
        text1: '선택된 장소 없음',
        text2: '코스 생성을 위해 장소를 선택해주세요.',
      });
      return;
    }

    const mapped = selected.map((s) => ({
      id: s.spot_id,
      filename: '',
      placeName: s.place.name,
      placeAddress: s.place.address || '',
      category: s.place.category || '기타',
      timestamp: s.visited_at || '',
      lat: s.place.lat,
      lng: s.place.lng,
    }));

    setSelectedPlaces(mapped);
    router.push('/course');
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

      setLastGeneratedPlan({
        plan_id: detail.plan_id,
        summary,
        variants,
      });

      router.push('/(tabs)/results');
    } catch (error) {
      console.error('플랜 불러오기 실패:', error);
      Toast.show({
        type: 'error',
        text1: '불러오기 실패',
        text2: '플랜을 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setOpeningPlanId(null);
    }
  }, [openingPlanId, router, setLastGeneratedPlan]);

  const confirmDelete = (count: number) => {
    const message = `${count}개 스팟을 삭제할까요?`;
    if (Platform.OS === 'web') {
      return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
    }
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        '선택 삭제',
        message,
        [
          { text: '취소', style: 'cancel', onPress: () => resolve(false) },
          { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedSpotIds);
    if (ids.length === 0) {
      Toast.show({
        type: 'info',
        text1: '선택된 장소 없음',
        text2: '삭제할 장소를 선택해주세요.',
      });
      return;
    }

    const confirmed = await confirmDelete(ids.length);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => recordService.deleteSpot(id)));
      const failed = results.filter((r) => r.status === 'rejected');

      setSelectedSpotIds(new Set());
      await loadSpots();

      if (failed.length > 0) {
        Toast.show({
          type: 'error',
          text1: '일부 삭제 실패',
          text2: `${failed.length}개 스팟 삭제 중 오류가 발생했습니다.`,
        });
      } else {
        Toast.show({
          type: 'success',
          text1: '삭제 완료',
          text2: `${ids.length}개 스팟을 삭제했습니다.`,
        });
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      Toast.show({
        type: 'error',
        text1: '삭제 실패',
        text2: '스팟 삭제 중 오류가 발생했습니다.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#64748b" />
          </Pressable>
          <Pressable style={styles.headerContent} onPress={() => router.push('/')}>
            <LinearGradient colors={['#6366f1', '#38bdf8']} style={styles.logo}>
              <Text style={styles.logoText}>O</Text>
            </LinearGradient>
            <Text style={styles.headerTitle}>OpenTripPlanner</Text>
          </Pressable>
        </View>
        <View style={styles.headerButtons}>
          <Pressable style={styles.headerButton} onPress={() => router.push('/upload')}>
            <Ionicons name="image" size={18} color="#64748b" style={{ marginRight: 6 }} />
            <Text style={styles.headerButtonText}>사진 기록</Text>
          </Pressable>
          <Pressable style={styles.headerButtonPrimary} onPress={handleCreateCourse}>
            <Ionicons name="add-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.headerButtonPrimaryText}>코스 생성</Text>
          </Pressable>
        </View>
      </View>

      {/* 탭 */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'spots' && styles.tabActive]}
          onPress={() => setActiveTab('spots')}>
          <Text style={[styles.tabText, activeTab === 'spots' && styles.tabTextActive]}>개인 기록</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'plans' && styles.tabActive]}
          onPress={() => setActiveTab('plans')}>
          <Text style={[styles.tabText, activeTab === 'plans' && styles.tabTextActive]}>저장된 플랜</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView}>
        {activeTab === 'spots' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>개인 기록 스팟</Text>
              <View style={styles.sectionHeaderActions}>
                <Text style={styles.sectionCount}>총 {spots.length}개</Text>
                <Pressable
                  style={[
                    styles.deleteButton,
                    (selectedSpotIds.size === 0 || isDeleting) && styles.deleteButtonDisabled,
                  ]}
                  onPress={handleDeleteSelected}
                  disabled={selectedSpotIds.size === 0 || isDeleting}>
                  <Ionicons name="trash-outline" size={14} color="#dc2626" style={{ marginRight: 4 }} />
                  <Text style={styles.deleteButtonText}>선택 삭제</Text>
                </Pressable>
              </View>
            </View>

            {isLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.loadingText}>기록을 불러오는 중...</Text>
              </View>
            ) : spots.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>등록된 장소가 없습니다</Text>
                <Text style={styles.emptyStateSubtext}>사진 업로드 후 장소 등록을 완료해주세요.</Text>
              </View>
            ) : (
              spots.map((spot) => {
                const selected = selectedSpotIds.has(spot.spot_id);
                const thumbnailUrl = resolveStorageUrl(spot.thumbnail_url);
                return (
                  <View key={spot.spot_id} style={[styles.card, selected && styles.cardSelected]}>
                    <View style={styles.cardRow}>
                      <View style={styles.cardThumbnail}>
                        {thumbnailUrl ? (
                          <Image source={{ uri: thumbnailUrl }} style={styles.cardThumbnailImage} />
                        ) : (
                          <LinearGradient colors={['#cbd5e1', '#94a3b8']} style={styles.cardThumbnailPlaceholder}>
                            <Text style={styles.cardThumbnailText}>사진</Text>
                          </LinearGradient>
                        )}
                      </View>
                      <View style={styles.cardContent}>
                        <View style={styles.cardHeaderRow}>
                          <Text style={styles.cardTitle} numberOfLines={1}>{spot.place.name}</Text>
                          <Pressable onPress={() => toggleSelect(spot.spot_id)} style={styles.selectButton}>
                            <Ionicons
                              name={selected ? 'checkbox' : 'square-outline'}
                              size={20}
                              color={selected ? '#6366f1' : '#94a3b8'}
                            />
                          </Pressable>
                        </View>
                        <Text style={styles.cardSubtitle} numberOfLines={1}>{spot.place.address || '주소 없음'}</Text>
                        <View style={styles.cardMetaRow}>
                          <Text style={styles.cardDate}>{formatDate(spot.visited_at)}</Text>
                          <Text style={styles.cardCategory}>{spot.place.category || '기타'}</Text>
                        </View>
                        <Pressable onPress={() => router.push(`/record?spot_id=${spot.spot_id}`)}>
                          <Text style={styles.cardLink}>상세 보기</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'plans' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>저장된 여행 플랜</Text>
              <Text style={styles.sectionCount}>총 {savedPlans.length}개</Text>
            </View>

            {isLoadingPlans ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.loadingText}>저장된 플랜을 불러오는 중...</Text>
              </View>
            ) : savedPlans.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>저장된 플랜이 없습니다</Text>
                <Text style={styles.emptyStateSubtext}>추천 결과에서 플랜을 저장해보세요.</Text>
              </View>
            ) : (
              savedPlans.map((plan) => {
                const isOpening = openingPlanId === plan.saved_plan_id;
                const variants = plan.variants_summary;
                const title = plan.title || `${plan.region} 여행`;
                const isBusy = openingPlanId !== null;

                return (
                  <Pressable
                    key={plan.saved_plan_id}
                    style={[styles.planCard, isBusy && styles.planCardDisabled]}
                    onPress={() => handleOpenSavedPlan(plan.saved_plan_id)}
                    disabled={isBusy}
                  >
                    <View style={styles.planHeaderRow}>
                      <Text style={styles.planTitle} numberOfLines={1}>{title}</Text>
                      {isOpening ? (
                        <ActivityIndicator size="small" color="#6366f1" />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                      )}
                    </View>
                    <Text style={styles.planMeta}>{plan.region} · {plan.date}</Text>
                    {variants && (
                      <View style={styles.planVariantRow}>
                        <View style={styles.planVariantBadge}>
                          <Text style={styles.planVariantLabel}>A</Text>
                          <Text style={styles.planVariantText}>{variants.A || '기본 추천'}</Text>
                        </View>
                        <View style={styles.planVariantBadge}>
                          <Text style={styles.planVariantLabel}>B</Text>
                          <Text style={styles.planVariantText}>{variants.B || '대체 추천'}</Text>
                        </View>
                      </View>
                    )}
                  </Pressable>
                );
              })
            )}
          </View>
        )}

      </ScrollView>
      </View>
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
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    elevation: 3,
    gap: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backButton: {
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
    gap: 10,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerButtonText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  headerButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerButtonPrimaryText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  tabText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#6366f1',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'center',
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  sectionCount: {
    fontSize: 13,
    color: '#64748b',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  loadingState: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  emptyState: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#94a3b8',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  cardRow: {
    flexDirection: width < 400 ? 'column' : 'row',
    gap: 14,
  },
  cardThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  cardThumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardThumbnailText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  selectButton: {
    padding: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  cardCategory: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
  },
  cardLink: {
    fontSize: 13,
    color: '#6366f1',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  planCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  planCardDisabled: {
    opacity: 0.6,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  planTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  planMeta: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  planVariantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  planVariantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  planVariantLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
  },
  planVariantText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
});
