import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlaces } from '@/contexts/PlacesContext';

const { width } = Dimensions.get('window');

export default function CourseWeb() {
  const router = useRouter();
  const { selectedPlaces, setSelectedPlaces, removePlace, setPlanFormField, resetPlanForm, clearGeneratedPlan } = usePlaces();
  const [query, setQuery] = useState('');
  const [duration, setDuration] = useState('');
  const [selectedMove, setSelectedMove] = useState('walk');
  const [selectedCrowd, setSelectedCrowd] = useState('avoid');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);

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

  const webMapContainerRef = useRef<HTMLDivElement | null>(null);
  const webMapInstance = useRef<any>(null);
  const webMarkers = useRef<any[]>([]);
  const webPolyline = useRef<any>(null);
  const searchInputRef = useRef<any>(null);
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

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
        {
          id: 'test26',
          filename: '',
          placeName: '북촌한옥마을',
          placeAddress: '서울특별시 종로구 계동길 37',
          category: '관광명소',
          timestamp: '',
          lat: 37.5826,
          lng: 126.9831,
        },
        {
          id: 'test25',
          filename: '',
          placeName: '북촌한옥마을',
          placeAddress: '서울특별시 종로구 계동길 37',
          category: '관광명소',
          timestamp: '',
          lat: 37.5826,
          lng: 126.9831,
        },
        {
          id: 'test24',
          filename: '',
          placeName: '북촌한옥마을',
          placeAddress: '서울특별시 종로구 계동길 37',
          category: '관광명소',
          timestamp: '',
          lat: 37.5826,
          lng: 126.9831,
        },
        {
          id: 'test23',
          filename: '',
          placeName: '북촌한옥마을',
          placeAddress: '서울특별시 종로구 계동길 37',
          category: '관광명소',
          timestamp: '',
          lat: 37.5826,
          lng: 126.9831,
        },
        {
          id: 'test22',
          filename: '',
          placeName: '북촌한옥마을',
          placeAddress: '서울특별시 종로구 계동길 37',
          category: '관광명소',
          timestamp: '',
          lat: 37.5826,
          lng: 126.9831,
        },
        {
          id: 'test21',
          filename: '',
          placeName: '북촌한옥마을',
          placeAddress: '서울특별시 종로구 계동길 37',
          category: '관광명소',
          timestamp: '',
          lat: 37.5826,
          lng: 126.9831,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGoogleMapsScript = () =>
    new Promise<void>((resolve, reject) => {
      if (!apiKey) return reject(new Error('NO_API_KEY'));
      if ((window as any).google && (window as any).google.maps) return resolve();
      const id = 'google-maps-script';
      if (document.getElementById(id)) {
        const check = setInterval(() => {
          if ((window as any).google && (window as any).google.maps) {
            clearInterval(check);
            resolve();
          }
        }, 100);
        return;
      }
      const script = document.createElement('script');
      script.id = id;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });

  const addPlaceToPlan = (place: any) => {
    const id = place.id || `${Date.now()}`;
    const p = {
      id,
      filename: '',
      placeName: place.placeName || place.name || place.description,
      placeAddress: place.placeAddress || place.formatted_address || '',
      category: place.category || '',
      timestamp: place.timestamp || '',
      lat: place.lat,
      lng: place.lng,
    };
    if (!selectedPlaces.find((s) => s.id === p.id)) {
      setSelectedPlaces([...selectedPlaces, p]);
    }
  };

  const initWebMap = async () => {
    if (!apiKey) return;
    try {
      await loadGoogleMapsScript();
      const google = (window as any).google;
      const container = webMapContainerRef.current;
      if (!container) return;
      const center = { lat: selectedPlaces[0]?.lat ?? 37.5665, lng: selectedPlaces[0]?.lng ?? 126.9780 };
      webMapInstance.current = new google.maps.Map(container, {
        center,
        zoom: 13,
        disableDefaultUI: true,
      });

      if (searchInputRef.current) {
        const ac = new google.maps.places.Autocomplete(searchInputRef.current, { fields: ['place_id', 'geometry', 'name', 'formatted_address'] });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (place && place.geometry && place.geometry.location) {
            addPlaceToPlan({
              id: place.place_id || `${Date.now()}`,
              placeName: place.name,
              placeAddress: place.formatted_address || '',
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
            if (searchInputRef.current) searchInputRef.current.value = '';
          }
        });
      }
      updateWebMap();
    } catch (e) {
      console.error('웹 지도 초기화 실패', e);
    }
  };

  const updateWebMap = () => {
    const google = (window as any).google;
    if (!google || !webMapInstance.current) return;
    webMarkers.current.forEach((m) => m.setMap(null));
    webMarkers.current = [];
    const map = webMapInstance.current;
    const coords: any[] = [];
    selectedPlaces.forEach((p: any, idx: number) => {
      if (typeof p.lat === 'number' && typeof p.lng === 'number') {
        const marker = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map,
          label: { text: `${idx + 1}`, color: '#fff', fontWeight: '700' },
        });
        webMarkers.current.push(marker);
        coords.push({ lat: p.lat, lng: p.lng });
      }
    });
    if (webPolyline.current) {
      webPolyline.current.setMap(null);
      webPolyline.current = null;
    }
    if (coords.length > 1) {
      webPolyline.current = new google.maps.Polyline({
        path: coords,
        geodesic: true,
        strokeColor: '#6366f1',
        strokeOpacity: 1.0,
        strokeWeight: 3,
      });
      webPolyline.current.setMap(map);
    }
    if (coords.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      coords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, 80);
    }
  };

  useEffect(() => {
    initWebMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateWebMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlaces]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleGenerate = () => {
    resetPlanForm();
    clearGeneratedPlan();

    const durationHours =
      typeof duration === 'string'
        ? parseInt(duration.replace(/[^0-9]/g, ''), 10) || null
        : null;

    setPlanFormField('durationHours', durationHours);
    setPlanFormField(
      'transport',
      selectedMove === 'walk' ? 'walk' : selectedMove === 'public' ? 'public' : 'car',
    );
    setPlanFormField(
      'crowdMode',
      selectedCrowd === 'avoid' ? 'quiet' : selectedCrowd === 'ok' ? 'hot' : 'normal',
    );
    setPlanFormField('categories', selectedCategories);

    router.push('/(tabs)/results');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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

        {/* 지도 섹션 */}
        <View style={styles.mapSection}>
          <Text style={styles.sectionTitle}>1. 여행 기본 정보</Text>
          <View style={styles.mapContainer}>
            <div ref={webMapContainerRef as any} style={{ width: '100%', height: 360, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eef2ff' }} />
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
              <TextInput ref={searchInputRef as any} placeholder="가고 싶은 장소를 검색하세요" placeholderTextColor="#94a3b8" value={query} onChangeText={setQuery} style={styles.searchInput} />
              {/* <Pressable style={styles.searchButton}><Ionicons name="search" size={18} color="#fff" /></Pressable> */}
            </View>
          </View>
        </View>

        {/* 선택된 장소 */}
        {selectedPlaces.length > 0 && (
          <View style={styles.section}>
            <View style={styles.selectedHeader}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>선택된 장소 ({selectedPlaces.length})</Text>
              <Text style={styles.selectedSubtitle}>이 장소들로 코스를 만들어요</Text>
            </View>
            <ScrollView
              style={selectedPlaces.length >= 3 ? styles.placeCardScrollContainer : undefined}
              contentContainerStyle={styles.placeCardGrid}
              nestedScrollEnabled
              showsVerticalScrollIndicator={selectedPlaces.length >= 3}
            >
              {selectedPlaces.map((place, i) => (
                <View key={place.id} style={styles.placeCard}>
                  <View style={styles.placeIndex}><Text style={styles.placeIndexText}>{i + 1}</Text></View>
                  <View style={styles.placeInfo}>
                    <Text style={styles.placeName} numberOfLines={1}>{place.placeName}</Text>
                    <Text style={styles.placeAddr} numberOfLines={1}>{place.placeAddress || '주소 정보 없음'}</Text>
                  </View>
                  <Pressable style={styles.placeRemove} onPress={() => removePlace(place.id)}>
                    <Ionicons name="trash" size={18} color="#ef4444" />
                  </Pressable>
                </View>
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
  searchIcon: {
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  mapSection: {
    padding: 20,
    backgroundColor: '#ffffff',
    marginBottom: 1,
  },
  mapContainer: {
    width: '100%',
    minHeight: 320,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  searchBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: '#6366f1',
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
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
  placeCardScrollContainer: {
    maxHeight: 200,
  },
  placeCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    minWidth: 420,
    flexBasis: width < 600 ? '100%' : '48%',
    flexGrow: width < 600 ? 1 : 0,
  },
  placeIndex: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  placeIndexText: {
    color: '#6366f1',
    fontWeight: '700',
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  placeAddr: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  placeRemove: {
    paddingLeft: 8,
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 1,
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
  },
  generateSection: {
    padding: 20,
  },
  generateCard: {
    borderRadius: 20,
    padding: 20,
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
