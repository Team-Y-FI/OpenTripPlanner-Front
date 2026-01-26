import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlaces } from '@/contexts/PlacesContext';

const { width } = Dimensions.get('window');

export default function CourseScreen() {
  const router = useRouter();
  const { selectedPlaces } = usePlaces();
  const [duration, setDuration] = useState('');
  const [selectedMove, setSelectedMove] = useState('walk');
  const [selectedCrowd, setSelectedCrowd] = useState('avoid');
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const purposes = ['데이트', '혼자 시간', '친구들과', '가족 나들이', '사진 찍기', '맛집 위주'];
  const categories = ['카페', '맛집', '전시/미술관', '공원/산책', '야경/전망', '쇼핑'];

  const togglePurpose = (purpose: string) => {
    setSelectedPurposes(prev =>
      prev.includes(purpose) ? prev.filter(p => p !== purpose) : [...prev, purpose]
    );
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleGenerate = () => {
    router.push('/(tabs)/results');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#64748b" />
        </Pressable>
        <View style={styles.headerContent}>
          <LinearGradient colors={['#6366f1', '#38bdf8']} style={styles.logo}>
            <Text style={styles.logoText}>O</Text>
          </LinearGradient>
          <Text style={styles.headerTitle}>OpenTripPlanner</Text>
        </View>
        <Text style={styles.headerStep}>코스 조건 입력</Text>
      </View>

      {/* 요약 배지 */}
      <View style={styles.summary}>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>오늘의 여행 플랜</Text>
        </View>
        <Text style={styles.summaryText}>목적·시간·이동수단만 알려주시면 돼요</Text>
      </View>

      {/* 선택된 장소 */}
      {selectedPlaces.length > 0 && (
        <View style={styles.section}>
          <View style={styles.selectedHeader}>
            <Text style={styles.sectionTitle}>선택된 장소 ({selectedPlaces.length})</Text>
            <Text style={styles.selectedSubtitle}>이 장소들로 코스를 만들어요</Text>
          </View>
          <View style={styles.selectedPlaces}>
            {selectedPlaces.map((place) => (
              <View key={place.id} style={styles.selectedPlaceCard}>
                <View style={styles.selectedPlaceIcon}>
                  <Ionicons name="location" size={16} color="#6366f1" />
                </View>
                <View style={styles.selectedPlaceInfo}>
                  <Text style={styles.selectedPlaceName}>{place.placeName}</Text>
                  {place.category && (
                    <Text style={styles.selectedPlaceCategory}>{place.category}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 여행 기본 정보 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {selectedPlaces.length > 0 ? '2' : '1'}. 여행 기본 정보
        </Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>지역 / 출발 기준</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 홍대입구역, 성수동, 부산 서면"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>여행 목적</Text>
          <View style={styles.pillContainer}>
            {purposes.map(purpose => (
              <Pressable
                key={purpose}
                style={[styles.pill, selectedPurposes.includes(purpose) && styles.pillActive]}
                onPress={() => togglePurpose(purpose)}>
                <Text style={[styles.pillText, selectedPurposes.includes(purpose) && styles.pillTextActive]}>
                  {purpose}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.inputGroupFlex}>
            <Text style={styles.label}>날짜</Text>
            <TextInput style={styles.input} placeholder="2024-05-03" placeholderTextColor="#94a3b8" />
          </View>
          <View style={styles.inputGroupFlex}>
            <Text style={styles.label}>시작 시간</Text>
            <TextInput style={styles.input} placeholder="14:00" placeholderTextColor="#94a3b8" />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>예산 (1인 기준, 선택)</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 30000원"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* 코스 조건 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {selectedPlaces.length > 0 ? '3' : '2'}. 코스 조건
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>소요 시간</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 3시간, 반나절, 1일"
            placeholderTextColor="#94a3b8"
            value={duration}
            onChangeText={setDuration}
          />
          <Text style={styles.inputHint}>숫자 + 시간 단위 또는 표현을 자유롭게 입력하세요</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>이동수단</Text>
          <View style={styles.buttonRow}>
            {[{ key: 'walk', label: '도보' }, { key: 'public', label: '대중교통' }, { key: 'car', label: '차량' }].map(option => (
              <Pressable
                key={option.key}
                style={[styles.optionButton, selectedMove === option.key && styles.optionButtonActive]}
                onPress={() => setSelectedMove(option.key)}>
                <Text style={[styles.optionButtonText, selectedMove === option.key && styles.optionButtonTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>방문하고 싶은 카테고리</Text>
          <View style={styles.pillContainer}>
            {categories.map(category => (
              <Pressable
                key={category}
                style={[styles.pill, selectedCategories.includes(category) && styles.pillActive]}
                onPress={() => toggleCategory(category)}>
                <Text style={[styles.pillText, selectedCategories.includes(category) && styles.pillTextActive]}>
                  {category}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* 혼잡도 옵션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. 혼잡도 · 교통 옵션</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>혼잡도 기준</Text>
          <View style={styles.buttonRow}>
            {[{ key: 'avoid', label: '붐비는 곳 피하기' }, { key: 'neutral', label: '기본' }, { key: 'ok', label: '인기 장소 위주' }].map(option => (
              <Pressable
                key={option.key}
                style={[styles.optionButton, selectedCrowd === option.key && styles.optionButtonActive]}
                onPress={() => setSelectedCrowd(option.key)}>
                <Text style={[styles.optionButtonText, selectedCrowd === option.key && styles.optionButtonTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoBoxHeader}>
            <Text style={styles.infoBoxTitle}>혼잡/휴무/비효율 구간 발견 시</Text>
            <View style={styles.infoBoxBadge}>
              <Text style={styles.infoBoxBadgeText}>B안 자동 생성</Text>
            </View>
          </View>
          <Text style={styles.infoBoxItem}>• 동일 카테고리 · 가까운 거리의 대체 장소 추천</Text>
          <Text style={styles.infoBoxItem}>• 동선 순서 변경 또는 우회 경로 제안</Text>
          <Text style={styles.infoBoxItem}>• A안 / B안 이동시간·혼잡·거리 비교 카드 제공</Text>
        </View>
      </View>

      {/* 생성 버튼 */}
      <View style={styles.generateSection}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.generateCard}>
          <Text style={styles.generateTitle}>이번 플랜에서 만들어 드릴 것</Text>
          <View style={styles.generateList}>
            <Text style={styles.generateItem}>1  조건에 맞는 추천 스팟 리스트 (카테고리별)</Text>
            <Text style={styles.generateItem}>2  시작점 기준 최적 동선 코스 A안 · 혼잡/교통 반영</Text>
            <Text style={styles.generateItem}>3  문제 구간에 대해 대체 플랜 B안 자동 생성</Text>
            <Text style={styles.generateItem}>4  지도 기반 일정표 + 타임라인 한 화면 제공</Text>
          </View>
          <Pressable style={styles.generateButton} onPress={handleGenerate}>
            <Text style={styles.generateButtonText}>코스 생성하기 →</Text>
          </Pressable>
        </LinearGradient>
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
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  backButton: {
    padding: 4,
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
    flexShrink: 1,
  },
  headerStep: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    flexShrink: 0,
  },
  summary: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    marginBottom: 1,
    gap: 12,
  },
  summaryBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  summaryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedSubtitle: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
  },
  selectedPlaces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectedPlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  selectedPlaceIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPlaceInfo: {
    gap: 2,
  },
  selectedPlaceName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#312e81',
  },
  selectedPlaceCategory: {
    fontSize: 11,
    color: '#6366f1',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupFlex: {
    flex: 1,
  },
  row: {
    flexDirection: width < 400 ? 'column' : 'row',
    gap: 14,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  inputHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
    lineHeight: 16,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  pillActive: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  pillText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  optionButtonActive: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  optionButtonText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'center',
  },
  optionButtonTextActive: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  infoBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoBoxTitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  infoBoxBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  infoBoxBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366f1',
  },
  infoBoxItem: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  generateSection: {
    padding: 20,
  },
  generateCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  generateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  generateList: {
    marginBottom: 16,
  },
  generateItem: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 10,
    lineHeight: 18,
  },
  generateButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
});
