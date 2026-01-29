import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function RecordScreen() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/records');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#64748b" />
        </Pressable>
        <View style={styles.headerContent}>
          <LinearGradient colors={['#6366f1', '#38bdf8']} style={styles.logo}>
            <Text style={styles.logoText}>O</Text>
          </LinearGradient>
          <Text style={styles.headerTitle}>OpenTripPlanner</Text>
        </View>
        <Pressable onPress={() => router.push('/records')}>
          <Text style={styles.headerLink}>내 기록 전체 보기</Text>
        </Pressable>
      </View>

      {/* 스팟 요약 */}
      <View style={styles.summaryCard}>
        <View style={styles.imagePlaceholder}>
          <LinearGradient colors={['#cbd5e1', '#94a3b8']} style={styles.imageBg}>
            <Text style={styles.imageText}>사진</Text>
          </LinearGradient>
        </View>
        <View style={styles.summaryInfo}>
          <Text style={styles.summaryTag}>내 지도 스팟</Text>
          <Text style={styles.summaryTitle}>마들렌 카페 홍대점</Text>
          <Text style={styles.summaryAddress}>서울 마포구 양화로 00길 12</Text>
          <Text style={styles.summaryDate}>2024-05-03 방문</Text>
          <View style={styles.tags}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>데이트</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>브런치</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>야경</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 메모 & 지도 */}
      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>메모</Text>
          <Text style={styles.memoText}>
            오늘 데이트로 방문했던 카페.{'\n'}
            디저트가 맛있고, 창가 자리 뷰가 좋아서 다음에도 다시 오고 싶다.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>지도에서 보기 (예시)</Text>
          <View style={styles.mapPlaceholder}>
            <LinearGradient colors={['#dbeafe', '#e0e7ff']} style={styles.mapBg}>
              <Text style={styles.mapText}>지도 예시</Text>
              <Text style={styles.mapSubtext}>스팟 위치와 과거에 실행한{'\n'}플랜을 겹쳐볼 수 있어요.</Text>
            </LinearGradient>
            <View style={styles.mapPin}>
              <Text style={styles.mapPinText}>●</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 관련 플랜 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>이 스팟이 포함된 여행 플랜</Text>
          <Text style={styles.sectionSubtitle}>최근 1개 플랜 (예시)</Text>
        </View>
        <View style={styles.planCard}>
          <View>
            <Text style={styles.planTitle}>홍대 데이트 3시간 루트</Text>
            <Text style={styles.planSubtitle}>카페 → 전시 → 야경 · 2024-05-03 생성</Text>
          </View>
          <Pressable style={styles.planButton} onPress={() => router.push('/(tabs)/results')}>
            <Text style={styles.planButtonText}>플랜 다시 보기</Text>
          </Pressable>
        </View>
      </View>
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
    justifyContent: 'space-between',
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
    boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)',
    elevation: 3,
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
  headerLink: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '600',
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
    flex: 1,
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
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  summaryAddress: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  summaryDate: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 12,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tagText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  row: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  memoText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  mapPlaceholder: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  mapBg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  mapSubtext: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  mapPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -14,
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinText: {
    fontSize: 10,
    color: '#ffffff',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#38bdf8',
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  planSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  planButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  planButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
});
