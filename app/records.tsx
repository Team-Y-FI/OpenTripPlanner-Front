import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlaces } from '@/contexts/PlacesContext';

const { width } = Dimensions.get('window');

export default function RecordsScreen() {
  const router = useRouter();
  const { clearPlaces } = usePlaces();
  const [activeTab, setActiveTab] = useState('spots');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const spots = [
    { id: '1', name: '마들렌 카페 홍대점', address: '서울 마포구 양화로 00길 12', date: '2024-05-03', tags: ['데이트', '브런치'] },
    { id: '2', name: '성수동 카페 거리', address: '서울 성동구 성수이로 123', date: '2024-04-20', tags: ['혼자', '감성'] },
  ];

  const plans = [
    { id: '1', location: '홍대입구역', duration: '3시간', moveMode: '대중교통', purposes: ['데이트'], categories: ['카페', '전시'], savedAt: '2024-05-03' },
  ];

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
          <Pressable style={styles.headerButtonPrimary} onPress={() => {
            clearPlaces();
            router.push('/course');
          }}>
            <Ionicons name="add-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.headerButtonPrimaryText}>새 플랜</Text>
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
              <Text style={styles.sectionCount}>총 {spots.length}개</Text>
            </View>
            {spots.map(spot => (
              <Pressable
                key={spot.id}
                style={styles.card}
                onPress={() => router.push('/record')}>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{spot.name}</Text>
                  <Text style={styles.cardSubtitle}>{spot.address}</Text>
                  <Text style={styles.cardDate}>{spot.date}</Text>
                </View>
                <View style={styles.cardTags}>
                  {spot.tags.map((tag, idx) => (
                    <View key={idx} style={styles.cardTag}>
                      <Text style={styles.cardTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {activeTab === 'plans' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>저장된 여행 플랜</Text>
              <Text style={styles.sectionCount}>총 {plans.length}개</Text>
            </View>
            {plans.map(plan => (
              <View key={plan.id} style={styles.planCard}>
                <View style={styles.planContent}>
                  <Text style={styles.planTitle}>
                    {plan.location} · {plan.duration} · {plan.moveMode}
                  </Text>
                  <Text style={styles.planSubtitle}>
                    {plan.purposes.join(', ')} / {plan.categories.join(', ')}
                  </Text>
                  <Text style={styles.planDate}>저장일: {plan.savedAt}</Text>
                </View>
                <View style={styles.planActions}>
                  <Pressable
                    style={styles.planButton}
                    onPress={() => router.push('/(tabs)/results')}>
                    <Text style={styles.planButtonText}>플랜 열기</Text>
                  </Pressable>
                  <Text style={styles.planNote}>A/B 코스 포함</Text>
                </View>
              </View>
            ))}
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
    flex: 1,
    marginLeft: 8,
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
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerButtonText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  headerButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    boxShadow: '0 3px 6px rgba(15, 23, 42, 0.3)',
    elevation: 4,
  },
  headerButtonPrimaryText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  tabBar: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
  },
  tabActive: {
    backgroundColor: '#0f172a',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  tabText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: width < 400 ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: width < 400 ? 'flex-start' : 'center',
    gap: width < 400 ? 12 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
  },
  cardDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  cardTag: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTagText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: width < 400 ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: width < 400 ? 'flex-start' : 'center',
    gap: width < 400 ? 12 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#38bdf8',
  },
  planContent: {
    flex: 1,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  planSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
  },
  planDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  planActions: {
    alignItems: 'flex-end',
  },
  planButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 6,
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
  planNote: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
