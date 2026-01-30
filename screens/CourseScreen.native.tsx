import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Dimensions, ActivityIndicator, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlaces } from '@/contexts/PlacesContext';
import MapView, { Marker, Polyline } from 'react-native-maps';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

const { width } = Dimensions.get('window');

interface SearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
}

export default function CourseScreen() {
  const router = useRouter();
  const { selectedPlaces, setSelectedPlaces, removePlace, setPlanFormField, resetPlanForm, clearGeneratedPlan } = usePlaces();
  const [duration, setDuration] = useState('');
  const [selectedMove, setSelectedMove] = useState('walk');
  const [selectedCrowd, setSelectedCrowd] = useState('avoid');
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const mapRef = useRef<MapView>(null);

  // 검색 관련 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 장소 검색 함수 (Google Places API)
  const searchPlaces = async (query: string) => {
    if (!query.trim() || !GOOGLE_PLACES_API_KEY) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=ko&key=${GOOGLE_PLACES_API_KEY}`
      );
      const data = await response.json();

      if (data.results) {
        setSearchResults(data.results.slice(0, 5).map((r: any) => ({
          place_id: r.place_id,
          name: r.name,
          formatted_address: r.formatted_address,
          geometry: { location: { lat: r.geometry.location.lat, lng: r.geometry.location.lng } }
        })));
        setShowResults(true);
      }
    } catch (error) {
      console.error('장소 검색 오류:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 테스트용 가데이터
  useEffect(() => {
    if (selectedPlaces.length === 0) {
      setSelectedPlaces([
        {
          id: 'test1',
          filename: '',
          placeName: '경복궁',
          placeAddress: '서울특별시 종로구 사직로 161',
          category: '관광명소',
          timestamp: '',
          lat: 37.5796,
          lng: 126.9770,
        },
        {
          id: 'test2',
          filename: '',
          placeName: '북촌한옥마을',
          placeAddress: '서울특별시 종로구 계동길 37',
          category: '관광명소',
          timestamp: '',
          lat: 37.5826,
          lng: 126.9831,
        },
        {
          id: 'test3',
          filename: '',
          placeName: '인사동 쌈지길',
          placeAddress: '서울특별시 종로구 인사동길 44',
          category: '쇼핑',
          timestamp: '',
          lat: 37.5742,
          lng: 126.9856,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 검색어 변경 시 debounce 적용
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(searchQuery);
      }, 500);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // 검색 결과에서 장소 선택
  const selectPlace = (result: SearchResult) => {
    const newPlace = {
      id: result.place_id,
      filename: '',
      placeName: result.name,
      placeAddress: result.formatted_address,
      category: '',
      timestamp: '',
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    };

    if (!selectedPlaces.find(p => p.id === newPlace.id)) {
      setSelectedPlaces([...selectedPlaces, newPlace]);
    }

    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    Keyboard.dismiss();

    // 지도 이동
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
  };

  const getInitialRegion = () => {
    if (selectedPlaces.length > 0 && selectedPlaces[0].lat && selectedPlaces[0].lng) {
      return { latitude: selectedPlaces[0].lat, longitude: selectedPlaces[0].lng, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    }
    return { latitude: 37.5665, longitude: 126.9780, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  };

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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleGenerate = () => {
    // 사용자가 입력한 값들을 전역 플랜 폼에 반영
    resetPlanForm();
    clearGeneratedPlan();

    // 소요 시간은 예시로 숫자만 추출해서 durationHours 로 저장
    const durationHours =
      typeof duration === 'string'
        ? parseInt(duration.replace(/[^0-9]/g, ''), 10) || null
        : null;

    setPlanFormField('durationHours', durationHours);

    // 이동 수단 매핑
    setPlanFormField(
      'transport',
      selectedMove === 'walk' ? 'walk' : selectedMove === 'public' ? 'public' : 'car',
    );

    // 혼잡도 옵션 매핑
    setPlanFormField(
      'crowdMode',
      selectedCrowd === 'avoid' ? 'quiet' : selectedCrowd === 'ok' ? 'hot' : 'normal',
    );

    // 카테고리/목적은 문자열 배열 그대로 저장 (백엔드 스키마에 맞게 후처리 가능)
    setPlanFormField('categories', selectedCategories);

    router.push('/(tabs)/results');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
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

      {/* 장소 검색은 지도 위에 오버레이로 표시 */}

      {/* 지도 섹션 */}
      <View style={styles.mapSection}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            1. 여행 기본 정보
          </Text>
          <View style={styles.mapContainer}>
            {/* 검색 오버레이 (지도 위에 고정) */}
            <View style={styles.mapSearchOverlay}>
              <View style={styles.searchInputWrapper}>
                <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="가고 싶은 장소를 검색하세요"
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {isSearching && (
                  <ActivityIndicator size="small" color="#6366f1" style={styles.searchLoading} />
                )}
                {searchQuery.length > 0 && !isSearching && (
                  <Pressable onPress={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}>
                    <Ionicons name="close-circle" size={20} color="#94a3b8" />
                  </Pressable>
                )}
              </View>

              {/* 검색 결과 (오버레이 아래에 나타남) */}
              {showResults && searchResults.length > 0 && (
                <View style={styles.searchResultsOverlay}>
                  {searchResults.map((result) => (
                    <Pressable
                      key={result.place_id}
                      style={styles.searchResultItem}
                      onPress={() => selectPlace(result)}
                    >
                      <View style={styles.searchResultIcon}>
                        <Ionicons name="location" size={16} color="#6366f1" />
                      </View>
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName} numberOfLines={1}>{result.name}</Text>
                        <Text style={styles.searchResultAddress} numberOfLines={1}>{result.formatted_address}</Text>
                      </View>
                      <Ionicons name="add-circle" size={24} color="#6366f1" />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={getInitialRegion()}
            >
              {selectedPlaces.filter(p => p.lat && p.lng).map((place, idx) => (
                <Marker
                  key={place.id}
                  coordinate={{ latitude: place.lat!, longitude: place.lng! }}
                  title={place.placeName}
                >
                  <View style={styles.markerContainer}>
                    <View style={styles.markerCircle}>
                      <Text style={styles.markerText}>{idx + 1}</Text>
                    </View>
                  </View>
                </Marker>
              ))}
              {selectedPlaces.filter(p => p.lat && p.lng).length > 1 && (
                <Polyline
                  coordinates={selectedPlaces.filter(p => p.lat && p.lng).map(p => ({ latitude: p.lat!, longitude: p.lng! }))}
                  strokeColor="#6366f1"
                  strokeWidth={3}
                  lineDashPattern={[6, 4]}
                />
              )}
            </MapView>
          </View>
        </View>
      </View>

      {/* 선택된 장소 */}
      {selectedPlaces.length > 0 && (
        <View style={styles.section}>
          <View style={styles.selectedHeader}>
            <Text style={styles.sectionTitle}>선택된 장소 ({selectedPlaces.length})</Text>
            <Text style={styles.selectedSubtitle}>이 장소들로 코스를 만들어요</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.placeCardScroll}>
              {selectedPlaces.map((place, i) => (
                <Pressable key={place.id} style={styles.placeCard}>
                  <View style={styles.placeIndex}><Text style={styles.placeIndexText}>{i + 1}</Text></View>
                  <View style={styles.placeInfo}>
                    <Text style={styles.placeName} numberOfLines={1}>{place.placeName}</Text>
                    <Text style={styles.placeAddr} numberOfLines={1}>{place.placeAddress || '주소 정보 없음'}</Text>
                  </View>
                  <Pressable style={styles.placeRemove} onPress={() => removePlace(place.id)}>
                    <Ionicons name="trash" size={16} color="#ef4444" />
                  </Pressable>
                </Pressable>
              ))}
            </ScrollView>
        </View>
      )}

      {/* 여행 기본 정보 */}
      <View style={styles.section}>
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
          2. 코스 조건
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
    boxShadow: '0 2px 3px rgba(0, 0, 0, 0.05)',
    elevation: 2,
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
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
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
  mapSection: {
    backgroundColor: '#ffffff',
    marginBottom: 1,
  },
  mapContainer: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  mapSearchOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 20,
    // 반투명 배경으로 지도 위에서 돋보이게
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 8,
  },
  searchResultsOverlay: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    maxHeight: 180,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  map: {
    width: '100%',
    height: 250,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  placeCardContainer: {
    padding: 16,
  },
  placeCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  placeCardScroll: {
    flexDirection: 'row',
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginRight: 10,
    minWidth: 200,
  },
  placeIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  placeIndexText: {
    color: '#6366f1',
    fontWeight: '700',
    fontSize: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  placeAddr: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  placeRemove: {
    padding: 6,
  },
  searchSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 1,
  },
  searchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  searchBarContainer: {
    marginBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 2,
  },
  searchLoading: {
    marginLeft: 8,
  },
  searchResultsContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    marginTop: 8,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchResultIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  searchResultAddress: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
