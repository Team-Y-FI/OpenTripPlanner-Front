import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { usePlaces } from '@/contexts/PlacesContext';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL, recordService, type SpotListItem } from '@/services';

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
  const { user } = useAuth();
  const { setSelectedPlaces } = usePlaces();
  const [activeTab, setActiveTab] = useState('spots');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [spots, setSpots] = useState<SpotListItem[]>([]);
  const [selectedSpotIds, setSelectedSpotIds] = useState<Set<string>>(new Set());

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

  useFocusEffect(
    useCallback(() => {
      void loadSpots();
    }, [loadSpots])
  );

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

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedSpotIds);
    if (ids.length === 0) {
      Toast.show({
        type: 'info',
        text1: '선택된 장소 없음',
        text2: '삭제할 장소를 선택해주세요.',
      });
      return;
    }

    Alert.alert('선택 삭제', `${ids.length}개 스팟을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          try {
            await Promise.all(ids.map((id) => recordService.deleteSpot(id)));
            setSelectedSpotIds(new Set());
            await loadSpots();
            Toast.show({
              type: 'success',
              text1: '삭제 완료',
              text2: `${ids.length}개 스팟을 삭제했습니다.`,
            });
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
        },
      },
    ]);
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
          <View style={styles.headerContent}>
            <LinearGradient colors={['#6366f1', '#38bdf8']} style={styles.logo}>
              <Text style={styles.logoText}>O</Text>
            </LinearGradient>
            <Text style={styles.headerTitle}>OpenTripPlanner</Text>
          </View>
          <View style={{ width: 40 }} />
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
              <Text style={styles.sectionCount}>총 0개</Text>
            </View>
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>저장된 플랜이 없습니다</Text>
              <Text style={styles.emptyStateSubtext}>추천 결과에서 플랜을 저장해보세요.</Text>
            </View>
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
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
    justifyContent: 'space-between',
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
});
