import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { usePlaces } from '@/contexts/PlacesContext';
import { useAuth } from '@/contexts/AuthContext';
import Toast from 'react-native-toast-message';
import ConfirmModal from '@/components/ConfirmModal';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { clearPlaces } = usePlaces();
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
            사진 업로드로 장소를 자동 인식하고, 시간·예산·교통수단만 입력하면{'\n'}
            혼잡도와 교통까지 반영한 A/B 여행 코스를 만들어 드려요.
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

        {/* 예시 카드 */}
        <View style={styles.exampleCard}>
          <View style={styles.exampleHeader}>
            <Text style={styles.exampleHeaderText}>오늘 같이 갈까?</Text>
            <View style={styles.pulse}>
              <View style={styles.pulseDot} />
              <Text style={styles.exampleHeaderSubtext}>실시간 플랜 생성 중</Text>
            </View>
          </View>

          <View style={styles.exampleContent}>
            <View style={styles.exampleLeft}>
              <View style={styles.exampleImageContainer}>
                <LinearGradient colors={['#cbd5e1', '#94a3b8']} style={styles.exampleImage}>
                  <Text style={styles.exampleImageText}>홍대 카페</Text>
                </LinearGradient>
                <View style={styles.exampleBadge}>
                  <Text style={styles.exampleBadgeText}>사진 기반 스팟 인식 완료 · 홍대입구 인근</Text>
                </View>
              </View>

              <View style={styles.exampleInfoCard}>
                <View style={styles.exampleInfoHeader}>
                  <Text style={styles.exampleInfoTitle}>오늘 3시간 · 대중교통</Text>
                  <View style={styles.exampleInfoBadge}>
                    <Text style={styles.exampleInfoBadgeText}>혼잡도 반영</Text>
                  </View>
                </View>
                <Text style={styles.exampleInfoDesc}>카페 → 전시 → 야경 루트 자동 구성 완료</Text>
              </View>
            </View>

            <View style={styles.exampleRight}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>예상 소요시간</Text>
                <Text style={styles.statValue}>3시간 10분</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>이동 시간</Text>
                <Text style={styles.statValue}>42분</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>혼잡 구간 경고</Text>
                <View style={styles.warningBadge}>
                  <View style={styles.warningDot} />
                  <Text style={styles.warningText}>1곳</Text>
                </View>
              </View>

              <View style={styles.courseComparison}>
                <View style={styles.courseARow}>
                  <Text style={styles.courseAText}>코스 A · 감성 카페 위주</Text>
                  <Text style={styles.recommendBadge}>추천</Text>
                </View>
                <View style={styles.courseBRow}>
                  <Text style={styles.courseBText}>코스 B · 야경/전망 위주</Text>
                  <Pressable onPress={() => router.push('/(tabs)/results')}>
                    <Text style={styles.compareLink}>A/B 코스 비교 보기</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 진입 방식 선택 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. 어떻게 시작할까요?</Text>

        <View style={styles.entryCards}>
          {/* 새 플랜 */}
          <Pressable style={styles.entryCard} onPress={() => {
            clearPlaces();
            router.push('/course');
          }}>
            <View style={styles.entryCardHeader}>
              <View>
                <Text style={styles.entryCardTag}>새로운 여행 계획</Text>
                <Text style={styles.entryCardTitle}>빈 캘린더에서 시작</Text>
                <Text style={styles.entryCardDesc}>
                  목적 · 지역 · 교통수단 · 예산만 입력하면{'\n'}
                  추천 스팟과 최적 동선을 자동으로 만들어 드려요.
                </Text>
              </View>
              <Text style={styles.entryCardArrow}>→</Text>
            </View>
            <View style={styles.entryCardTags}>
              <View style={styles.entryTag}>
                <Text style={styles.entryTagText}>3시간 / 반나절 / 1일</Text>
              </View>
              <View style={styles.entryTag}>
                <Text style={styles.entryTagText}>도보 · 대중교통 · 차량</Text>
              </View>
              <View style={styles.entryTag}>
                <Text style={styles.entryTagText}>혼잡도·교통 반영</Text>
              </View>
            </View>
          </Pressable>

          {/* 사진 기록 */}
          <Pressable style={styles.entryCard} onPress={() => router.push('/upload')}>
            <View style={styles.entryCardHeader}>
              <View>
                <Text style={[styles.entryCardTag, styles.entryCardTagGreen]}>사진 기반 기록</Text>
                <Text style={styles.entryCardTitle}>사진으로 장소부터 기록</Text>
                <Text style={styles.entryCardDesc}>
                  여행 사진을 올리면 위치를 자동 인식하고,{'\n'}
                  내 지도에 스팟과 개인 기록으로 차곡차곡 쌓여요.
                </Text>
              </View>
              <Text style={styles.entryCardArrow}>→</Text>
            </View>
            <View style={styles.entryCardTags}>
              <View style={styles.entryTag}>
                <Text style={styles.entryTagText}>EXIF 위치 자동 읽기</Text>
              </View>
              <View style={styles.entryTag}>
                <Text style={styles.entryTagText}>지도에서 직접 핀 지정</Text>
              </View>
              <View style={styles.entryTag}>
                <Text style={styles.entryTagText}>사진·메모·태그 기록</Text>
              </View>
            </View>
          </Pressable>
        </View>
      </View>

      {/* 필수 정보 카드 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. 어떤 정보가 필요해요?</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoColumn}>
            <View style={styles.infoHeader}>
              <View style={styles.infoNumber}>
                <Text style={styles.infoNumberText}>①</Text>
              </View>
              <Text style={styles.infoTitle}>여행 기본 정보</Text>
            </View>
            <Text style={styles.infoItem}>· 지역 / 목적 (데이트, 혼자, 가족 등)</Text>
            <Text style={styles.infoItem}>· 날짜 / 시작 시간</Text>
            <Text style={styles.infoItem}>· 교통수단 (도보 / 대중교통 / 차량)</Text>
            <Text style={styles.infoItem}>· 예산 대략 범위</Text>
          </View>

          <View style={styles.infoColumn}>
            <View style={styles.infoHeader}>
              <View style={styles.infoNumber}>
                <Text style={styles.infoNumberText}>②</Text>
              </View>
              <Text style={styles.infoTitle}>코스 조건</Text>
            </View>
            <Text style={styles.infoItem}>· 소요 시간 (3시간 / 반나절 / 1일)</Text>
            <Text style={styles.infoItem}>· 카테고리 (카페, 전시, 자연 등)</Text>
            <Text style={styles.infoItem}>· 이동 속도 / 휴식 선호</Text>
          </View>

          <View style={styles.infoColumn}>
            <View style={styles.infoHeader}>
              <View style={styles.infoNumber}>
                <Text style={styles.infoNumberText}>③</Text>
              </View>
              <Text style={styles.infoTitle}>결과 확인 & 공유</Text>
            </View>
            <Text style={styles.infoItem}>· A안 / B안 동선 비교</Text>
            <Text style={styles.infoItem}>· 혼잡·교통 경고 확인</Text>
            <Text style={styles.infoItem}>· 플랜 저장 & URL 공유</Text>
          </View>
        </View>
      </View>
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
    borderColor: '#f1f5f9',
    padding: 18,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.08)',
    elevation: 4,
  },
  exampleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  exampleHeaderText: {
    color: '#ffffff',
    fontSize: 13,
    opacity: 0.9,
    fontWeight: '500',
  },
  pulse: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34d399',
    marginRight: 6,
  },
  exampleHeaderSubtext: {
    color: '#ffffff',
    fontSize: 13,
    opacity: 0.9,
    fontWeight: '500',
  },
  exampleContent: {
    flexDirection: width < 400 ? 'column' : 'row',
    gap: 12,
  },
  exampleLeft: {
    flex: 1,
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
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 14,
    padding: 14,
  },
  exampleInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  exampleInfoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#312e81',
  },
  exampleInfoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  exampleInfoBadgeText: {
    fontSize: 10,
    color: '#312e81',
    fontWeight: '500',
  },
  exampleInfoDesc: {
    fontSize: 12,
    color: '#312e81',
  },
  exampleRight: {
    flex: 1,
    minWidth: width < 400 ? '100%' : undefined,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
    marginRight: 5,
  },
  warningText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
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
});
