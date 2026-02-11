import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions, Image, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { API_URL, recordService, type SpotDetail } from '@/services';
import SpotMap from '@/components/SpotMap';

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

export default function RecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spot_id?: string }>();
  const spotId = params.spot_id;
  const [spot, setSpot] = useState<SpotDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [memoDraft, setMemoDraft] = useState('');
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [isSavingMemo, setIsSavingMemo] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/records');
    }
  };

  useEffect(() => {
    if (!spotId) return;
    setIsLoading(true);
    recordService
      .getSpot(String(spotId))
      .then((data) => {
        setSpot(data);
      })
      .catch((error) => {
        console.error('기록 불러오기 실패:', error);
        Toast.show({
          type: 'error',
          text1: '불러오기 실패',
          text2: '기록을 불러오는 중 오류가 발생했습니다.',
        });
      })
      .finally(() => setIsLoading(false));
  }, [spotId]);

  useEffect(() => {
    if (!spot) return;
    setMemoDraft(spot.memo || '');
    setIsEditingMemo(false);
  }, [spot?.spot_id, spot?.memo]);

  const handleCancelMemo = () => {
    if (!spot) return;
    setMemoDraft(spot.memo || '');
    setIsEditingMemo(false);
  };

  const handleSaveMemo = async () => {
    if (!spot) return;
    const cleaned = memoDraft.trim();
    const nextMemo = cleaned.length ? cleaned : null;

    setIsSavingMemo(true);
    try {
      await recordService.updateSpot(spot.spot_id, { memo: nextMemo });
      setSpot({ ...spot, memo: nextMemo });
      setIsEditingMemo(false);
      Toast.show({
        type: 'success',
        text1: '메모 저장 완료',
        text2: '메모가 업데이트되었습니다.',
      });
    } catch (error) {
      console.error('메모 저장 실패:', error);
      Toast.show({
        type: 'error',
        text1: '저장 실패',
        text2: '메모를 저장하는 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSavingMemo(false);
    }
  };

  const heroUrl = spot ? resolveStorageUrl(spot.photos?.[0]?.url) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 헤더 */}
      <View style={styles.header}>
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

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color="#6366f1" />
          <Text style={styles.loadingText}>기록을 불러오는 중...</Text>
        </View>
      ) : !spot ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>기록을 찾을 수 없습니다</Text>
          <Text style={styles.emptyStateSubtext}>다시 시도해주세요.</Text>
        </View>
      ) : (
        <>
          {/* 스팟 요약 */}
          <View style={styles.summaryCard}>
            <View style={styles.imagePlaceholder}>
              {heroUrl ? (
                <Image source={{ uri: heroUrl }} style={styles.imageBg} />
              ) : (
                <LinearGradient colors={['#cbd5e1', '#94a3b8']} style={styles.imageBg}>
                  <Text style={styles.imageText}>사진</Text>
                </LinearGradient>
              )}
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryTag}>내 지도 스팟</Text>
              <Text style={styles.summaryTitle}>{spot.place.name}</Text>
              <Text style={styles.summaryAddress}>{spot.place.address || '주소 없음'}</Text>
              <Text style={styles.summaryDate}>{formatDate(spot.visited_at)} 방문</Text>
              <View style={styles.tags}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{spot.place.category || '기타'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 메모 */}
          <View style={styles.section}>
            <View style={styles.memoHeader}>
              <Text style={styles.cardTitle}>메모</Text>
              {isEditingMemo ? (
                <View style={styles.memoActions}>
                  <Pressable
                    style={styles.memoActionButton}
                    onPress={handleCancelMemo}
                    disabled={isSavingMemo}>
                    <Text style={styles.memoActionText}>취소</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.memoActionButton,
                      styles.memoSaveButton,
                      isSavingMemo && styles.memoActionButtonDisabled,
                    ]}
                    onPress={handleSaveMemo}
                    disabled={isSavingMemo}>
                    <Text style={[styles.memoActionText, styles.memoSaveText]}>
                      {isSavingMemo ? '저장 중...' : '저장'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setIsEditingMemo(true)}>
                  <Text style={styles.memoEditText}>메모 수정</Text>
                </Pressable>
              )}
            </View>
            {isEditingMemo ? (
              <>
                <TextInput
                  style={styles.memoInput}
                  placeholder="메모를 입력해주세요"
                  placeholderTextColor="#94a3b8"
                  value={memoDraft}
                  onChangeText={setMemoDraft}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                />
                <Text style={styles.memoHint}>최대 2000자</Text>
              </>
            ) : (
              <Text style={styles.memoText}>{spot.memo || '메모가 없습니다.'}</Text>
            )}
          </View>

          {/* 위치 지도 */}
          {spot.place.lat && spot.place.lng && (
            <View style={styles.section}>
              <Text style={styles.cardTitle}>위치</Text>
              <SpotMap
                lat={spot.place.lat}
                lng={spot.place.lng}
                name={spot.place.name}
                address={spot.place.address || undefined}
              />
            </View>
          )}

          {/* 관련 플랜 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>이 스팟이 포함된 여행 플랜</Text>
              <Text style={styles.sectionSubtitle}>최근 {spot.related_plans?.length || 0}개</Text>
            </View>
            {spot.related_plans?.length ? (
              spot.related_plans.map((plan) => (
                <View key={plan.plan_id} style={styles.planCard}>
                  <View>
                    <Text style={styles.planTitle}>{plan.title || '저장된 플랜'}</Text>
                    <Text style={styles.planSubtitle}>{plan.date || '날짜 없음'}</Text>
                  </View>
                  <Pressable style={styles.planButton} onPress={() => router.push('/(tabs)/results')}>
                    <Text style={styles.planButtonText}>플랜 보기</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateSubtext}>연결된 플랜이 없습니다.</Text>
              </View>
            )}
          </View>
        </>
      )}
      </ScrollView>
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
    justifyContent: 'flex-start',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    elevation: 3,
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
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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
  loadingState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    flexDirection: width < 400 ? 'column' : 'row',
    gap: 20,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    elevation: 2,
    marginBottom: 16,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  imageBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryTag: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  summaryAddress: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  summaryDate: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 10,
  },
  tags: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  memoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  memoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  memoActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  memoActionButtonDisabled: {
    opacity: 0.6,
  },
  memoActionText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  memoSaveButton: {
    backgroundColor: '#6366f1',
  },
  memoSaveText: {
    color: '#ffffff',
  },
  memoEditText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
  },
  memoInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 110,
    fontSize: 14,
    color: '#0f172a',
  },
  memoHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#94a3b8',
  },
  memoText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  planCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 16,
    flexDirection: width < 400 ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: width < 400 ? 'flex-start' : 'center',
    gap: 12,
    marginBottom: 10,
  },
  planTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  planSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  planButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  planButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
});
