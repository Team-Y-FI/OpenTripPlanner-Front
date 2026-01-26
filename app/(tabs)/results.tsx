import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function ResultsScreen() {
  const [activeCourse, setActiveCourse] = useState('A');

  const courseA = [
    { time: '14:00', name: '출발', type: 'start' },
    { time: '14:20', name: '마들렌 카페', category: '카페/브런치', duration: '40분', crowdLevel: 'low' },
    { time: '15:10', name: '홍대 갤러리', category: '전시', duration: '30분', crowdLevel: 'medium' },
    { time: '16:00', name: '야경 전망대', category: '야경', duration: '40분', crowdLevel: 'high' },
    { time: '17:10', name: '종료', type: 'end' },
  ];

  const courseB = [
    { time: '14:00', name: '출발', type: 'start' },
    { time: '14:20', name: '성수 카페', category: '카페', duration: '40분', crowdLevel: 'low' },
    { time: '15:10', name: '대안 갤러리', category: '전시', duration: '30분', crowdLevel: 'low' },
    { time: '16:00', name: '루프탑 카페', category: '야경', duration: '40분', crowdLevel: 'medium' },
    { time: '17:10', name: '종료', type: 'end' },
  ];

  const currentCourse = activeCourse === 'A' ? courseA : courseB;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <LinearGradient colors={['#6366f1', '#38bdf8']} style={styles.logo}>
            <Text style={styles.logoText}>T</Text>
          </LinearGradient>
          <Text style={styles.headerTitle}>여행 코스 결과</Text>
        </View>
        <View style={styles.headerButtons}>
          <Pressable style={styles.headerButton}>
            <Text style={styles.headerButtonText}>플랜 저장</Text>
          </Pressable>
          <Pressable style={styles.headerButtonPrimary}>
            <Text style={styles.headerButtonPrimaryText}>URL 공유</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* 요약 */}
        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryTag}>여행 플랜 결과</Text>
            <Text style={styles.summaryTitle}>오늘 3시간 · 대중교통 · 홍대입구역 기준</Text>
            <Text style={styles.summarySubtitle}>데이트 · 카페 · 전시 / 혼잡도·교통 반영 완료</Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeLabel}>총 소요시간</Text>
              <Text style={styles.statBadgeValue}>3시간 10분</Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeLabel}>이동시간</Text>
              <Text style={styles.statBadgeValue}>42분</Text>
            </View>
          </View>
        </View>

        {/* 지도 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>지도 + 동선</Text>
            <View style={styles.courseBadge}>
              <Text style={styles.courseBadgeText}>코스 {activeCourse}</Text>
            </View>
          </View>
          <View style={styles.mapPlaceholder}>
            <LinearGradient colors={['#dbeafe', '#e0e7ff', '#f1f5f9']} style={styles.mapBg}>
              <Text style={styles.mapText}>지도 예시 (API 연동 전)</Text>
              <Text style={styles.mapSubtext}>스팟 위치 + A/B 동선 · 구간별 이동 시간/혼잡도 표시</Text>
            </LinearGradient>
          </View>
        </View>

        {/* 타임라인 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>타임라인</Text>
            <View style={styles.courseToggle}>
              <Pressable
                style={[styles.courseTab, activeCourse === 'A' && styles.courseTabActive]}
                onPress={() => setActiveCourse('A')}>
                <Text style={[styles.courseTabText, activeCourse === 'A' && styles.courseTabTextActive]}>
                  코스 A
                </Text>
              </Pressable>
              <Pressable
                style={[styles.courseTab, activeCourse === 'B' && styles.courseTabActive]}
                onPress={() => setActiveCourse('B')}>
                <Text style={[styles.courseTabText, activeCourse === 'B' && styles.courseTabTextActive]}>
                  코스 B
                </Text>
              </Pressable>
            </View>
          </View>

          {currentCourse.map((item, idx) => (
            <View key={idx} style={styles.timelineItem}>
              <View style={styles.timelineTime}>
                <Text style={styles.timelineTimeText}>{item.time}</Text>
              </View>
              <View style={styles.timelineDot}>
                {item.type === 'start' || item.type === 'end' ? (
                  <View style={styles.timelineDotSpecial} />
                ) : (
                  <View
                    style={[
                      styles.timelineDotNormal,
                      item.crowdLevel === 'low' && styles.timelineDotLow,
                      item.crowdLevel === 'medium' && styles.timelineDotMedium,
                      item.crowdLevel === 'high' && styles.timelineDotHigh,
                    ]}
                  />
                )}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineName}>{item.name}</Text>
                {item.category && (
                  <Text style={styles.timelineCategory}>{item.category} · {item.duration}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* 혼잡 경고 */}
        <View style={styles.warningSection}>
          <View style={styles.warningHeader}>
            <Ionicons name="warning" size={16} color="#f59e0b" />
            <Text style={styles.warningTitle}>혼잡/교통 경고 구간</Text>
          </View>
          <Text style={styles.warningItem}>• 야경 전망대: 주말 저녁 혼잡 예상 (대기 시간 15-20분)</Text>
          <Text style={styles.warningItem}>• 코스 B로 변경 시 혼잡 구간 회피 가능</Text>
        </View>

        {/* A/B 비교 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>A안 / B안 비교</Text>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonCard}>
              <Text style={styles.comparisonTitle}>코스 A · 기본 추천</Text>
              <Text style={styles.comparisonItem}>• 총 시간: 3시간 10분</Text>
              <Text style={styles.comparisonItem}>• 이동 시간: 42분</Text>
              <Text style={styles.comparisonItem}>• 혼잡 구간: 1곳</Text>
            </View>
            <View style={styles.comparisonCard}>
              <Text style={styles.comparisonTitle}>코스 B · 대체 플랜</Text>
              <Text style={styles.comparisonItem}>• 총 시간: 3시간 20분</Text>
              <Text style={styles.comparisonItem}>• 이동 시간: 35분</Text>
              <Text style={styles.comparisonItem}>• 혼잡 구간: 0곳</Text>
            </View>
          </View>
        </View>
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
    flexShrink: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  headerButtonText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  headerButtonPrimary: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  headerButtonPrimaryText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  summary: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  summaryTag: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.3,
    flexWrap: 'wrap',
  },
  summarySubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statBadgeLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  statBadgeValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  section: {
    padding: 20,
    backgroundColor: '#ffffff',
    marginTop: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  courseBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  courseBadgeText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  mapPlaceholder: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
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
    marginBottom: 6,
  },
  mapSubtext: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  courseToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  courseTab: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  courseTabActive: {
    backgroundColor: '#0f172a',
  },
  courseTabText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  courseTabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineTime: {
    width: 60,
  },
  timelineTimeText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  timelineDot: {
    width: 36,
    alignItems: 'center',
  },
  timelineDotSpecial: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0f172a',
  },
  timelineDotNormal: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  timelineDotLow: {
    borderColor: '#34d399',
    backgroundColor: '#d1fae5',
  },
  timelineDotMedium: {
    borderColor: '#fbbf24',
    backgroundColor: '#fef3c7',
  },
  timelineDotHigh: {
    borderColor: '#f87171',
    backgroundColor: '#fee2e2',
  },
  timelineContent: {
    flex: 1,
  },
  timelineName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  timelineCategory: {
    fontSize: 13,
    color: '#64748b',
    flexWrap: 'wrap',
  },
  warningSection: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 16,
    padding: 16,
    margin: 20,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  warningItem: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
    lineHeight: 18,
  },
  comparisonRow: {
    flexDirection: width < 400 ? 'column' : 'row',
    gap: 14,
  },
  comparisonCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  comparisonItem: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
    lineHeight: 18,
  },
});
