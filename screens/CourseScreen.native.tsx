import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Dimensions, ActivityIndicator, Keyboard, Modal, LayoutAnimation, Platform, UIManager } from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlaces } from '@/contexts/PlacesContext';
import MapView, { Marker } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { planService, CreateCourseRequest, FixedEvent } from '@/services';

// Android에서 LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

const { width } = Dimensions.get('window');

interface SearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
}

// 고정 일정 한 건 타입 (지도 선택 장소 연동)
type FixedScheduleItem = {
  id: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  placeName?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

// 코스 조건 입력 폼 데이터 (터미널 로직 대응)
type CourseFormData = {
  startDate: string;
  endDate: string;
  firstDayStartTime: string;
  lastDayEndTime: string;
  hasFixedSchedule: boolean;
  fixedSchedules: FixedScheduleItem[];
};

const initialFormData: CourseFormData = {
  startDate: '',
  endDate: '',
  firstDayStartTime: '',
  lastDayEndTime: '',
  hasFixedSchedule: false,
  fixedSchedules: [],
};

// HH:MM 비교: 종료 시간이 시작 시간보다 빠를 수 없음 (end >= start)
function isTimeEndAfterStart(start: string, end: string): boolean {
  if (!start || !end) return true;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh > sh || (eh === sh && em >= sm);
}

function parseDate(s: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// 여행 시작 날짜가 현재 날짜보다 이전인지 확인 (오늘 포함 가능)
function isStartDateValid(startDate: string): boolean {
  if (!startDate) return true; // 빈 값은 유효 (다른 검사에서 처리)
  const start = parseDate(startDate);
  if (!start) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  return start >= today;
}

export default function CourseScreen() {
  const router = useRouter();
  const { selectedPlaces, setSelectedPlaces, removePlace, resetPlanForm, clearGeneratedPlan, setLastGeneratedPlan } = usePlaces();
  const [duration, setDuration] = useState('');
  const [selectedMove, setSelectedMove] = useState('walk');
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districtModalVisible, setDistrictModalVisible] = useState(false);
  const [formData, setFormData] = useState<CourseFormData>(initialFormData);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 날짜/시간 picker 상태
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showFirstDayStartTimePicker, setShowFirstDayStartTimePicker] = useState(false);
  const [showLastDayEndTimePicker, setShowLastDayEndTimePicker] = useState(false);
  const [showFixedDatePicker, setShowFixedDatePicker] = useState<string | null>(null); // item.id or null
  const [showFixedStartTimePicker, setShowFixedStartTimePicker] = useState<string | null>(null);
  const [showFixedEndTimePicker, setShowFixedEndTimePicker] = useState<string | null>(null);
  const [showModalDatePicker, setShowModalDatePicker] = useState(false);
  const [showModalStartTimePicker, setShowModalStartTimePicker] = useState(false);
  const [showModalEndTimePicker, setShowModalEndTimePicker] = useState(false);

  // 총 여행 일수 (시작/종료 일자 기반)
  const totalDays = (() => {
    const start = parseDate(formData.startDate);
    const end = parseDate(formData.endDate);
    if (!start || !end || end < start) return 0;
    return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  })();

  const setFormField = <K extends keyof CourseFormData>(key: K, value: CourseFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // 고정 일정 추가 모달: 지도에서 장소 선택 후 제목·시간만 입력
  const [addFixedModalVisible, setAddFixedModalVisible] = useState(false);
  const [draftPlace, setDraftPlace] = useState<{ lat: number; lng: number; placeName?: string; address?: string } | null>(null);
  const [draftForm, setDraftForm] = useState<{ date: string; title: string; startTime: string; endTime: string }>({
    date: '', title: '', startTime: '', endTime: '',
  });
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalSearchResults, setModalSearchResults] = useState<SearchResult[]>([]);
  const [modalShowResults, setModalShowResults] = useState(false);
  const [modalIsSearching, setModalIsSearching] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const modalMapRef = useRef<MapView>(null);
  const modalSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openAddFixedModal = () => {
    setAddFixedModalVisible(true);
    setDraftPlace(null);
    setDraftForm({ date: formData.startDate || '', title: '', startTime: '', endTime: '' });
    setModalSearchQuery('');
    setModalSearchResults([]);
    setModalShowResults(false);
  };

  const closeAddFixedModal = () => {
    setAddFixedModalVisible(false);
    setDraftPlace(null);
    setModalSearchQuery('');
    setModalSearchResults([]);
    setModalShowResults(false);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    const noAddressText = '주소를 찾을 수 없습니다';
    if (!GOOGLE_PLACES_API_KEY) {
      setDraftPlace({ lat, lng, placeName: noAddressText, address: '' });
      return;
    }
    setReverseGeocoding(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_PLACES_API_KEY}&language=ko`
      );
      const data = await res.json();
      const addr = data.results?.[0]?.formatted_address ?? '';
      const placeName = addr || noAddressText;
      setDraftPlace({ lat, lng, placeName, address: addr });
    } catch {
      setDraftPlace({ lat, lng, placeName: noAddressText, address: '' });
    } finally {
      setReverseGeocoding(false);
    }
  };

  const modalSearchPlaces = async (query: string) => {
    if (!query.trim() || !GOOGLE_PLACES_API_KEY) {
      setModalSearchResults([]);
      return;
    }
    setModalIsSearching(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=ko&key=${GOOGLE_PLACES_API_KEY}`
      );
      const data = await response.json();
      if (data.results) {
        setModalSearchResults(data.results.slice(0, 5).map((r: any) => ({
          place_id: r.place_id,
          name: r.name,
          formatted_address: r.formatted_address,
          geometry: { location: { lat: r.geometry.location.lat, lng: r.geometry.location.lng } },
        })));
        setModalShowResults(true);
      }
    } catch (error) {
      console.error('장소 검색 오류:', error);
    } finally {
      setModalIsSearching(false);
    }
  };

  const selectModalSearchResult = (result: SearchResult) => {
    const { lat, lng } = result.geometry.location;
    setDraftPlace({
      lat,
      lng,
      placeName: result.name,
      address: result.formatted_address,
    });
    setModalSearchQuery('');
    setModalSearchResults([]);
    setModalShowResults(false);
    if (modalMapRef.current) {
      modalMapRef.current.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 400);
    }
  };

  const setDraftFormField = <K extends keyof typeof draftForm>(key: K, value: typeof draftForm[K]) => {
    setDraftForm((prev) => ({ ...prev, [key]: value }));
  };

  const confirmAddFixed = () => {
    const err = draftForm.startTime && draftForm.endTime
      ? (isTimeEndAfterStart(draftForm.startTime, draftForm.endTime) ? null : '종료 시간은 시작 시간보다 빠를 수 없습니다.')
      : null;
    if (err) return; // optional: show alert
    if (!draftPlace) return; // 장소 선택 필수
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFormData((prev) => ({
      ...prev,
      fixedSchedules: [
        ...prev.fixedSchedules,
        {
          id: `fixed-${Date.now()}`,
          date: draftForm.date,
          title: draftForm.title,
          startTime: draftForm.startTime,
          endTime: draftForm.endTime,
          placeName: draftPlace.placeName,
          address: draftPlace.address,
          lat: draftPlace.lat,
          lng: draftPlace.lng,
        },
      ],
    }));
    closeAddFixedModal();
  };

  const addFixedScheduleItem = () => {
    openAddFixedModal();
  };

  const updateFixedScheduleItem = (id: string, field: keyof FixedScheduleItem, value: string) => {
    setFormData((prev) => ({
      ...prev,
      fixedSchedules: prev.fixedSchedules.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeFixedScheduleItem = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFormData((prev) => ({ ...prev, fixedSchedules: prev.fixedSchedules.filter((item) => item.id !== id) }));
  };

  const validateFixedScheduleItem = (item: FixedScheduleItem): string | null => {
    if (!item.startTime || !item.endTime) return null;
    if (!isTimeEndAfterStart(item.startTime, item.endTime)) return '종료 시간은 시작 시간보다 빠를 수 없습니다.';
    return null;
  };

  const isFixedSchedule = formData.hasFixedSchedule;
  const setIsFixedSchedule = (v: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFormField('hasFixedSchedule', v);
  };

  const seoulDistricts = [
    '강남구', '강동구', '강북구', '강서구', '관악구',
    '광진구', '구로구', '금천구', '노원구', '도봉구',
    '동대문구', '동작구', '마포구', '서대문구', '서초구',
    '성동구', '성북구', '송파구', '양천구', '영등포구',
    '용산구', '은평구', '종로구', '중구', '중랑구',
  ];
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

  // 모달 내 장소 검색 debounce
  useEffect(() => {
    if (modalSearchTimeoutRef.current) clearTimeout(modalSearchTimeoutRef.current);
    if (modalSearchQuery.trim()) {
      modalSearchTimeoutRef.current = setTimeout(() => modalSearchPlaces(modalSearchQuery), 500);
    } else {
      setModalSearchResults([]);
      setModalShowResults(false);
    }
    return () => {
      if (modalSearchTimeoutRef.current) clearTimeout(modalSearchTimeoutRef.current);
    };
  }, [modalSearchQuery]);

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

  const handleGenerate = async () => {
    // 필수 입력 검증 (웹/앱 공통)
    if (!selectedDistrict) {
      Toast.show({ type: 'error', text1: '알림', text2: '지역을 선택해주세요.', position: 'top', visibilityTime: 3000 });
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      Toast.show({ type: 'error', text1: '알림', text2: '여행 시작/종료 일자를 입력해주세요.', position: 'top', visibilityTime: 3000 });
      return;
    }
    const start = parseDate(formData.startDate);
    const end = parseDate(formData.endDate);
    if (!start || !end) {
      Toast.show({ type: 'error', text1: '알림', text2: '올바른 날짜 형식(YYYY-MM-DD)으로 입력해주세요.', position: 'top', visibilityTime: 3000 });
      return;
    }
    if (end < start) {
      Toast.show({ type: 'error', text1: '알림', text2: '종료 일자는 시작 일자보다 빠를 수 없습니다.', position: 'top', visibilityTime: 3000 });
      return;
    }
    if (!formData.firstDayStartTime || !formData.lastDayEndTime) {
      Toast.show({ type: 'error', text1: '알림', text2: '여행 시작/종료 시간을 입력해주세요.', position: 'top', visibilityTime: 3000 });
      return;
    }
    if (!isStartDateValid(formData.startDate)) {
      Toast.show({ type: 'error', text1: '알림', text2: '여행 시작 일자는 오늘 이후여야 합니다.', position: 'top', visibilityTime: 3000 });
      return;
    }
    for (const item of formData.fixedSchedules) {
      const err = validateFixedScheduleItem(item);
      if (err) {
        Toast.show({ type: 'error', text1: '알림', text2: `${item.title || '고정 일정'}: ${err}`, position: 'top', visibilityTime: 3000 });
        return;
      }
    }

    // 고정 일정 변환
    const fixedEvents: FixedEvent[] = formData.fixedSchedules.map((item) => ({
      date: item.date,
      title: item.title,
      start_time: item.startTime,
      end_time: item.endTime,
      place_name: item.placeName,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
    }));

    // API 요청 데이터 생성
    const requestData: CreateCourseRequest = {
      region: selectedDistrict,
      start_date: formData.startDate,
      end_date: formData.endDate,
      first_day_start_time: formData.firstDayStartTime,
      last_day_end_time: formData.lastDayEndTime,
      fixed_events: fixedEvents,
      transport_mode: selectedMove === 'car' ? 'car' : 'walkAndPublic',
    };

    setIsGenerating(true);

    try {
      const response = await planService.createCourse(requestData);

      // 플랜 폼 리셋 및 결과 저장
      resetPlanForm();
      clearGeneratedPlan();

      // 응답 데이터를 context에 저장
      setLastGeneratedPlan(response);

      // 결과 페이지로 이동
      router.push('/(tabs)/results');
    } catch (error) {
      console.error('코스 생성 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '코스 생성에 실패했습니다.';
      Toast.show({ type: 'error', text1: '오류', text2: errorMessage, position: 'top', visibilityTime: 3000 });
    } finally {
      setIsGenerating(false);
    }
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

        {/* 여행 기본 정보 (지도는 여기서 표시) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 여행 기본 정보</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>지역 선택</Text>
            <Pressable
              style={[styles.selectBox, isGenerating && styles.inputDisabled]}
              onPress={() => !isGenerating && setDistrictModalVisible(true)}
              disabled={isGenerating}
            >
              <Text style={selectedDistrict ? styles.selectBoxText : styles.selectBoxPlaceholder}>
                {selectedDistrict || '서울특별시 구를 선택하세요'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#64748b" />
            </Pressable>
          </View>
          {/* 고정 일정 */}
          <Pressable style={[styles.fixedScheduleRow, isGenerating && styles.inputDisabled]} onPress={() => !isGenerating && setIsFixedSchedule(!isFixedSchedule)} disabled={isGenerating}>
            <View style={[styles.checkboxBox, isFixedSchedule && styles.checkboxBoxChecked]}>
              {isFixedSchedule && <Ionicons name="checkmark" size={14} color="#ffffff" />}
            </View>
            <Text style={styles.fixedScheduleLabel}>고정 일정이 있나요?</Text>
          </Pressable>
          {isFixedSchedule && (
            <View style={styles.fixedScheduleContent}>
              <Pressable style={[styles.addFixedButton, isGenerating && styles.inputDisabled]} onPress={() => !isGenerating && addFixedScheduleItem()} disabled={isGenerating}>
                <Ionicons name="add-circle" size={20} color="#6366f1" />
                <Text style={styles.addFixedButtonText}>항목 추가</Text>
              </Pressable>
              {formData.fixedSchedules.length >= 2 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fixedScheduleCardScroll}
              style={styles.fixedScheduleCardScrollContainer}
            >
              {formData.fixedSchedules.map((item) => {
                const err = validateFixedScheduleItem(item);
                return (
                  <View key={item.id} style={[styles.fixedScheduleCard, styles.fixedScheduleCardSlide]}>
                    <View style={styles.fixedScheduleCardHeader}>
                      <Text style={styles.fixedScheduleCardTitle}>{item.title || '고정 일정'}</Text>
                      <Pressable style={styles.fixedScheduleRemove} onPress={() => !isGenerating && removeFixedScheduleItem(item.id)} disabled={isGenerating}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </Pressable>
                    </View>
                    {(item.placeName || item.address) ? (
                      <View style={styles.fixedSchedulePlaceBlock}>
                        <Ionicons name="location" size={16} color="#6366f1" style={styles.fixedSchedulePlaceIcon} />
                        <View style={styles.fixedSchedulePlaceText}>
                          {item.placeName ? <Text style={styles.fixedSchedulePlaceName} numberOfLines={1}>{item.placeName}</Text> : null}
                          {(item.address && String(item.address).trim()) ? (
                            <Text style={styles.fixedSchedulePlaceAddr} numberOfLines={1}>{item.address}</Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>날짜 (YYYY-MM-DD)</Text>
                      <Pressable onPress={() => !isGenerating && setShowFixedDatePicker(item.id)} disabled={isGenerating}>
                        <TextInput
                          style={styles.input}
                          placeholder="2026-01-31"
                          placeholderTextColor="#94a3b8"
                          value={item.date}
                          editable={false}
                        />
                      </Pressable>
                      {showFixedDatePicker === item.id && (
                        <DateTimePicker
                          value={item.date ? new Date(item.date) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedDate) => {
                            setShowFixedDatePicker(Platform.OS === 'ios' ? item.id : null);
                            if (Platform.OS === 'android' && event.type === 'dismissed') {
                              updateFixedScheduleItem(item.id, 'date', '');
                            } else if (selectedDate) {
                              const dateStr = selectedDate.toISOString().split('T')[0];
                              updateFixedScheduleItem(item.id, 'date', dateStr);
                            }
                          }}
                        />
                      )}
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>일정 제목 (예: 점심 식사)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="예: 점심 식사"
                        placeholderTextColor="#94a3b8"
                        value={item.title}
                        onChangeText={(v) => updateFixedScheduleItem(item.id, 'title', v)}
                        editable={!isGenerating}
                      />
                    </View>
                    <View style={styles.row}>
                      <View style={styles.inputGroupFlex}>
                        <Text style={styles.label}>시작 (HH:MM)</Text>
                        <Pressable onPress={() => !isGenerating && setShowFixedStartTimePicker(item.id)} disabled={isGenerating}>
                          <TextInput
                            style={styles.input}
                            placeholder="14:00"
                            placeholderTextColor="#94a3b8"
                            value={item.startTime}
                            editable={false}
                          />
                        </Pressable>
                          {showFixedStartTimePicker === item.id && (
                            <DateTimePicker
                              value={item.startTime ? (() => {
                                const [h, m] = item.startTime.split(':').map(Number);
                                const d = new Date();
                                d.setHours(h || 14, m || 0, 0, 0);
                                return d;
                              })() : new Date()}
                              mode="time"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, selectedTime) => {
                                setShowFixedStartTimePicker(Platform.OS === 'ios' ? item.id : null);
                                if (Platform.OS === 'android' && event.type === 'dismissed') {
                                  updateFixedScheduleItem(item.id, 'startTime', '');
                                } else if (selectedTime) {
                                  const timeStr = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
                                  updateFixedScheduleItem(item.id, 'startTime', timeStr);
                                }
                              }}
                            />
                          )}
                      </View>
                      <View style={styles.inputGroupFlex}>
                        <Text style={styles.label}>종료 (HH:MM)</Text>
                        <Pressable onPress={() => !isGenerating && setShowFixedEndTimePicker(item.id)} disabled={isGenerating}>
                          <TextInput
                            style={[styles.input, err ? styles.inputError : undefined]}
                            placeholder="16:00"
                            placeholderTextColor="#94a3b8"
                            value={item.endTime}
                            editable={false}
                          />
                        </Pressable>
                          {showFixedEndTimePicker === item.id && (
                            <DateTimePicker
                              value={item.endTime ? (() => {
                                const [h, m] = item.endTime.split(':').map(Number);
                                const d = new Date();
                                d.setHours(h || 16, m || 0, 0, 0);
                                return d;
                              })() : new Date()}
                              mode="time"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, selectedTime) => {
                                setShowFixedEndTimePicker(Platform.OS === 'ios' ? item.id : null);
                                if (Platform.OS === 'android' && event.type === 'dismissed') {
                                  updateFixedScheduleItem(item.id, 'endTime', '');
                                } else if (selectedTime) {
                                  const timeStr = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
                                  updateFixedScheduleItem(item.id, 'endTime', timeStr);
                                }
                              }}
                            />
                          )}
                      </View>
                    </View>
                    {err ? <Text style={styles.validationError}>{err}</Text> : null}
                  </View>
                );
              })}
              </ScrollView>
              ) : (
              formData.fixedSchedules.map((item) => {
                const err = validateFixedScheduleItem(item);
                return (
                  <View key={item.id} style={[styles.fixedScheduleCard, styles.fixedScheduleCardSingle]}>
                    <View style={styles.fixedScheduleCardHeader}>
                      <Text style={styles.fixedScheduleCardTitle}>{item.title || '고정 일정'}</Text>
                      <Pressable style={styles.fixedScheduleRemove} onPress={() => !isGenerating && removeFixedScheduleItem(item.id)} disabled={isGenerating}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </Pressable>
                    </View>
                    {(item.placeName || item.address) ? (
                      <View style={styles.fixedSchedulePlaceBlock}>
                        <Ionicons name="location" size={16} color="#6366f1" style={styles.fixedSchedulePlaceIcon} />
                        <View style={styles.fixedSchedulePlaceText}>
                          {item.placeName ? <Text style={styles.fixedSchedulePlaceName} numberOfLines={1}>{item.placeName}</Text> : null}
                          {(item.address && String(item.address).trim()) ? (
                            <Text style={styles.fixedSchedulePlaceAddr} numberOfLines={1}>{item.address}</Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>날짜 (YYYY-MM-DD)</Text>
                      <Pressable onPress={() => !isGenerating && setShowFixedDatePicker(item.id)} disabled={isGenerating}>
                        <TextInput
                          style={styles.input}
                          placeholder="2026-01-31"
                          placeholderTextColor="#94a3b8"
                          value={item.date}
                          editable={false}
                        />
                      </Pressable>
                      {showFixedDatePicker === item.id && (
                        <DateTimePicker
                          value={item.date ? new Date(item.date) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedDate) => {
                            setShowFixedDatePicker(Platform.OS === 'ios' ? item.id : null);
                            if (Platform.OS === 'android' && event.type === 'dismissed') {
                              updateFixedScheduleItem(item.id, 'date', '');
                            } else if (selectedDate) {
                              const dateStr = selectedDate.toISOString().split('T')[0];
                              updateFixedScheduleItem(item.id, 'date', dateStr);
                            }
                          }}
                        />
                      )}
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>일정 제목 (예: 점심 식사)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="예: 점심 식사"
                        placeholderTextColor="#94a3b8"
                        value={item.title}
                        onChangeText={(v) => updateFixedScheduleItem(item.id, 'title', v)}
                        editable={!isGenerating}
                      />
                    </View>
                    <View style={styles.row}>
                      <View style={styles.inputGroupFlex}>
                        <Text style={styles.label}>시작 (HH:MM)</Text>
                        <Pressable onPress={() => !isGenerating && setShowFixedStartTimePicker(item.id)} disabled={isGenerating}>
                          <TextInput
                            style={styles.input}
                            placeholder="14:00"
                            placeholderTextColor="#94a3b8"
                            value={item.startTime}
                            editable={false}
                          />
                        </Pressable>
                          {showFixedStartTimePicker === item.id && (
                            <DateTimePicker
                              value={item.startTime ? (() => {
                                const [h, m] = item.startTime.split(':').map(Number);
                                const d = new Date();
                                d.setHours(h || 14, m || 0, 0, 0);
                                return d;
                              })() : new Date()}
                              mode="time"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, selectedTime) => {
                                setShowFixedStartTimePicker(Platform.OS === 'ios' ? item.id : null);
                                if (Platform.OS === 'android' && event.type === 'dismissed') {
                                  updateFixedScheduleItem(item.id, 'startTime', '');
                                } else if (selectedTime) {
                                  const timeStr = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
                                  updateFixedScheduleItem(item.id, 'startTime', timeStr);
                                }
                              }}
                            />
                          )}
                      </View>
                      <View style={styles.inputGroupFlex}>
                        <Text style={styles.label}>종료 (HH:MM)</Text>
                        <Pressable onPress={() => !isGenerating && setShowFixedEndTimePicker(item.id)} disabled={isGenerating}>
                          <TextInput
                            style={[styles.input, err ? styles.inputError : undefined]}
                            placeholder="16:00"
                            placeholderTextColor="#94a3b8"
                            value={item.endTime}
                            editable={false}
                          />
                        </Pressable>
                          {showFixedEndTimePicker === item.id && (
                            <DateTimePicker
                              value={item.endTime ? (() => {
                                const [h, m] = item.endTime.split(':').map(Number);
                                const d = new Date();
                                d.setHours(h || 16, m || 0, 0, 0);
                                return d;
                              })() : new Date()}
                              mode="time"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, selectedTime) => {
                                setShowFixedEndTimePicker(Platform.OS === 'ios' ? item.id : null);
                                if (Platform.OS === 'android' && event.type === 'dismissed') {
                                  updateFixedScheduleItem(item.id, 'endTime', '');
                                } else if (selectedTime) {
                                  const timeStr = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
                                  updateFixedScheduleItem(item.id, 'endTime', timeStr);
                                }
                              }}
                            />
                          )}
                      </View>
                    </View>
                    {err ? <Text style={styles.validationError}>{err}</Text> : null}
                  </View>
                );
              })
              )}
            </View>
          )}
        </View>

        {/* 선택된 장소 (지도에서 선택한 장소) */}
        {selectedPlaces.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>선택된 장소 ({selectedPlaces.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.placeCardScroll}>
              {selectedPlaces.map((place, i) => (
                <View key={place.id} style={styles.placeCard}>
                  <View style={styles.placeIndex}><Text style={styles.placeIndexText}>{i + 1}</Text></View>
                  <View style={styles.placeInfo}>
                    <Text style={styles.placeName} numberOfLines={1}>{place.placeName}</Text>
                    <Text style={styles.placeAddr} numberOfLines={1}>{place.placeAddress || '주소 정보 없음'}</Text>
                  </View>
                  <Pressable style={styles.placeRemove} onPress={() => removePlace(place.id)}>
                    <Ionicons name="trash" size={16} color="#ef4444" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        
        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>여행 목적</Text>
            <View style={styles.pillContainer}>
              {purposes.map(purpose => (
                <Pressable
                  key={purpose}
                  style={[styles.pill, selectedPurposes.includes(purpose) && styles.pillActive, isGenerating && styles.inputDisabled]}
                  onPress={() => !isGenerating && togglePurpose(purpose)}
                  disabled={isGenerating}>
                  <Text style={[styles.pillText, selectedPurposes.includes(purpose) && styles.pillTextActive]}>
                    {purpose}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.inputGroupFlex}>
              <Text style={styles.label}>여행 시작 일자 (예: 2026-01-20)</Text>
              <Pressable onPress={() => !isGenerating && setShowStartDatePicker(true)} disabled={isGenerating}>
                <TextInput
                  style={[styles.input, formData.startDate && !isStartDateValid(formData.startDate) ? styles.inputError : undefined]}
                  placeholder="2026-01-20"
                  placeholderTextColor="#94a3b8"
                  value={formData.startDate}
                  editable={false}
                />
              </Pressable>
              {formData.startDate && !isStartDateValid(formData.startDate) && (
                <Text style={styles.validationError}>여행 시작 일자는 오늘 이후여야 합니다.</Text>
              )}
              {showStartDatePicker && (
                <DateTimePicker
                  value={formData.startDate ? new Date(formData.startDate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowStartDatePicker(Platform.OS === 'ios');
                    if (Platform.OS === 'android' && event.type === 'dismissed') {
                      setFormField('startDate', '');
                    } else if (selectedDate) {
                      const dateStr = selectedDate.toISOString().split('T')[0];
                      setFormField('startDate', dateStr);
                    }
                  }}
                />
              )}
            </View>
            <View style={styles.inputGroupFlex}>
              <Text style={styles.label}>여행 종료 일자 (예: 2026-01-25)</Text>
              <Pressable onPress={() => !isGenerating && setShowEndDatePicker(true)} disabled={isGenerating}>
                <TextInput
                  style={[styles.input, (() => {
                    const start = parseDate(formData.startDate);
                    const end = parseDate(formData.endDate);
                    return start && end && end < start ? styles.inputError : undefined;
                  })()]}
                  placeholder="2026-01-25"
                  placeholderTextColor="#94a3b8"
                  value={formData.endDate}
                  editable={false}
                />
              </Pressable>
              {showEndDatePicker && (
                <DateTimePicker
                  value={formData.endDate ? new Date(formData.endDate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowEndDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      const dateStr = selectedDate.toISOString().split('T')[0];
                      setFormField('endDate', dateStr);
                    }
                  }}
                />
              )}
              {formData.startDate && formData.endDate && totalDays >= 1 && (
                <Text style={styles.totalDaysText}>총 여행 일수 : {totalDays}일</Text>
              )}
            </View>
            <View style={styles.row}>
              <View style={styles.inputGroupFlex}>
                <Text style={styles.label}>여행 첫날 시작 시간 (예: 14:00)</Text>
                <Pressable onPress={() => !isGenerating && setShowFirstDayStartTimePicker(true)} disabled={isGenerating}>
                  <TextInput
                    style={styles.input}
                    placeholder="14:00"
                    placeholderTextColor="#94a3b8"
                    value={formData.firstDayStartTime}
                    editable={false}
                  />
                </Pressable>
                {showFirstDayStartTimePicker && (
                  <DateTimePicker
                    value={formData.firstDayStartTime ? (() => {
                      const [h, m] = formData.firstDayStartTime.split(':').map(Number);
                      const d = new Date();
                      d.setHours(h || 14, m || 0, 0, 0);
                      return d;
                    })() : new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedTime) => {
                      setShowFirstDayStartTimePicker(Platform.OS === 'ios');
                      if (Platform.OS === 'android' && event.type === 'dismissed') {
                        setFormField('firstDayStartTime', '');
                      } else if (selectedTime) {
                        const timeStr = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
                        setFormField('firstDayStartTime', timeStr);
                      }
                    }}
                  />
                )}
              </View>
              <View style={styles.inputGroupFlex}>
                <Text style={styles.label}>여행 마지막 날 종료 시간 (예: 18:00)</Text>
                <Pressable onPress={() => !isGenerating && setShowLastDayEndTimePicker(true)} disabled={isGenerating}>
                  <TextInput
                    style={styles.input}
                    placeholder="18:00"
                    placeholderTextColor="#94a3b8"
                    value={formData.lastDayEndTime}
                    editable={false}
                  />
                </Pressable>
                {showLastDayEndTimePicker && (
                  <DateTimePicker
                    value={formData.lastDayEndTime ? (() => {
                      const [h, m] = formData.lastDayEndTime.split(':').map(Number);
                      const d = new Date();
                      d.setHours(h || 18, m || 0, 0, 0);
                      return d;
                    })() : new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedTime) => {
                      setShowLastDayEndTimePicker(Platform.OS === 'ios');
                      if (Platform.OS === 'android' && event.type === 'dismissed') {
                        setFormField('lastDayEndTime', '');
                      } else if (selectedTime) {
                        const timeStr = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
                        setFormField('lastDayEndTime', timeStr);
                      }
                    }}
                  />
                )}
              </View>
            </View>
            <View style={styles.inputGroupFlex}>
              <Text style={styles.label}>예산 (1인 기준, 선택)</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 30000원"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                editable={!isGenerating}
              />
            </View>
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
              editable={!isGenerating}
            />
            <Text style={styles.inputHint}>숫자 + 시간 단위 또는 표현을 자유롭게 입력하세요</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>이동수단</Text>
            <View style={styles.buttonRow}>
              {[{ key: 'walkAndPublic', label: '도보 + 대중교통' }, { key: 'car', label: '차량' }].map(option => (
                <Pressable
                  key={option.key}
                  style={[styles.optionButton, selectedMove === option.key && styles.optionButtonActive, isGenerating && styles.inputDisabled]}
                  onPress={() => !isGenerating && setSelectedMove(option.key)}
                  disabled={isGenerating}>
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
                  style={[styles.pill, selectedCategories.includes(category) && styles.pillActive, isGenerating && styles.inputDisabled]}
                  onPress={() => !isGenerating && toggleCategory(category)}
                  disabled={isGenerating}>
                  <Text style={[styles.pillText, selectedCategories.includes(category) && styles.pillTextActive]}>
                    {category}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* 생성 버튼 */}
        <View style={styles.generateSection}>
          <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.generateCard}>
            <Text style={styles.generateTitle}>이번 플랜에서 만들어 드릴 것</Text>
            <View style={styles.generateList}>
              <Text style={styles.generateItem}>1  조건에 맞는 추천 스팟 리스트 (카테고리별)</Text>
              <Text style={styles.generateItem}>2  시작점 기준 최적 동선 코스 A안 · 혼잡/교통 반영</Text>
              <Text style={styles.generateItem}>3  지도 기반 일정표 + 타임라인 한 화면 제공</Text>
            </View>
            <Pressable
              style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
              onPress={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <View style={styles.generateButtonLoading}>
                  <ActivityIndicator size="small" color="#0f172a" />
                  <Text style={styles.generateButtonText}>생성 중...</Text>
                </View>
              ) : (
                <Text style={styles.generateButtonText}>코스 생성하기 →</Text>
              )}
            </Pressable>
          </LinearGradient>
        </View>
      </ScrollView>
      
      {/* 지역 선택 모달 */}
      <Modal
        visible={districtModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDistrictModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDistrictModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>서울특별시 구 선택</Text>
              <Pressable style={styles.modalCloseButton} onPress={() => setDistrictModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>
            <ScrollView style={styles.districtList}>
              {seoulDistricts.map((district) => (
                <Pressable
                  key={district}
                  style={[styles.districtItem, selectedDistrict === district && styles.districtItemActive]}
                  onPress={() => {
                    setSelectedDistrict(district);
                    setDistrictModalVisible(false);
                  }}
                >
                  <Text style={[styles.districtItemText, selectedDistrict === district && styles.districtItemTextActive]}>
                    {district}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* 고정 일정 추가 모달: 지도에서 장소 선택 후 제목·시간 입력 */}
      <Modal
        visible={addFixedModalVisible}
        animationType="slide"
        onRequestClose={closeAddFixedModal}
      >
        <SafeAreaView style={styles.addFixedModalSafe} edges={['top', 'left', 'right']}>
          <View style={styles.addFixedModalHeader}>
            <Text style={styles.addFixedModalTitle}>고정 일정 추가</Text>
            <Pressable onPress={closeAddFixedModal} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#64748b" />
            </Pressable>
          </View>
          <View style={styles.addFixedModalMapSection}>
            <View style={styles.mapSearchOverlay}>
              <View style={styles.searchInputWrapper}>
                <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="장소를 검색하세요"
                  placeholderTextColor="#94a3b8"
                  value={modalSearchQuery}
                  onChangeText={setModalSearchQuery}
                  returnKeyType="search"
                />
                {modalIsSearching && (
                  <ActivityIndicator size="small" color="#6366f1" style={styles.searchLoading} />
                )}
                {modalSearchQuery.length > 0 && !modalIsSearching && (
                  <Pressable onPress={() => { setModalSearchQuery(''); setModalSearchResults([]); setModalShowResults(false); }}>
                    <Ionicons name="close-circle" size={20} color="#94a3b8" />
                  </Pressable>
                )}
              </View>
              {modalShowResults && modalSearchResults.length > 0 && (
                <View style={styles.searchResultsOverlay}>
                  {modalSearchResults.map((result) => (
                    <Pressable
                      key={result.place_id}
                      style={styles.searchResultItem}
                      onPress={() => selectModalSearchResult(result)}
                    >
                      <View style={styles.searchResultIcon}>
                        <Ionicons name="location" size={16} color="#6366f1" />
                      </View>
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName} numberOfLines={1}>{result.name}</Text>
                        <Text style={styles.searchResultAddress} numberOfLines={1}>{result.formatted_address}</Text>
                      </View>
                      <Ionicons name="pin" size={24} color="#6366f1" />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <MapView
              ref={modalMapRef}
              style={styles.addFixedModalMap}
              initialRegion={
                draftPlace
                  ? { latitude: draftPlace.lat, longitude: draftPlace.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
                  : { latitude: 37.5665, longitude: 126.9780, latitudeDelta: 0.1, longitudeDelta: 0.1 }
              }
              onPress={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                reverseGeocode(latitude, longitude);
              }}
            >
              {draftPlace && (
                <Marker
                  coordinate={{ latitude: draftPlace.lat, longitude: draftPlace.lng }}
                  title={draftPlace.placeName}
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.markerCircle, styles.markerCircleFixed]}>
                      <Ionicons name="pin" size={18} color="#fff" />
                    </View>
                  </View>
                </Marker>
              )}
            </MapView>
            {reverseGeocoding && (
              <View style={styles.reverseGeocodeOverlay}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.reverseGeocodeText}>주소 조회 중...</Text>
              </View>
            )}
          </View>
          <ScrollView style={styles.addFixedModalFormSection} keyboardShouldPersistTaps="handled">
            <View style={styles.addFixedFormBlock}>
              <Text style={styles.label}>선택한 장소</Text>
              <View style={styles.placeReadOnly}>
                <Ionicons name="location" size={18} color="#6366f1" />
                <Text style={styles.placeReadOnlyText} numberOfLines={2}>
                  {draftPlace ? (draftPlace.placeName || draftPlace.address || '주소를 찾을 수 없습니다') : '지도를 탭하거나 검색해서 장소를 선택하세요'}
                </Text>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>일정 제목 (예: 점심 식사)</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 점심 식사"
                placeholderTextColor="#94a3b8"
                value={draftForm.title}
                onChangeText={(v) => setDraftFormField('title', v)}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>날짜 (YYYY-MM-DD)</Text>
              <Pressable onPress={() => setShowModalDatePicker(true)}>
                <TextInput
                  style={styles.input}
                  placeholder="2026-01-31"
                  placeholderTextColor="#94a3b8"
                  value={draftForm.date}
                  editable={false}
                />
              </Pressable>
              {showModalDatePicker && (
                <DateTimePicker
                  value={draftForm.date ? new Date(draftForm.date) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowModalDatePicker(Platform.OS === 'ios');
                    if (Platform.OS === 'android' && event.type === 'dismissed') {
                      setDraftFormField('date', '');
                    } else if (selectedDate) {
                      const dateStr = selectedDate.toISOString().split('T')[0];
                      setDraftFormField('date', dateStr);
                    }
                  }}
                />
              )}
            </View>
            <View style={styles.row}>
              <View style={styles.inputGroupFlex}>
                <Text style={styles.label}>시작 시간 (HH:MM)</Text>
                <Pressable onPress={() => setShowModalStartTimePicker(true)}>
                  <TextInput
                    style={styles.input}
                    placeholder="12:00"
                    placeholderTextColor="#94a3b8"
                    value={draftForm.startTime}
                    editable={false}
                  />
                </Pressable>
                {showModalStartTimePicker && (
                  <DateTimePicker
                    value={draftForm.startTime ? (() => {
                      const [h, m] = draftForm.startTime.split(':').map(Number);
                      const d = new Date();
                      d.setHours(h || 12, m || 0, 0, 0);
                      return d;
                    })() : new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedTime) => {
                      setShowModalStartTimePicker(Platform.OS === 'ios');
                      if (selectedTime) {
                        const timeStr = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
                        setDraftFormField('startTime', timeStr);
                      }
                    }}
                  />
                )}
              </View>
              <View style={styles.inputGroupFlex}>
                <Text style={styles.label}>종료 시간 (HH:MM)</Text>
                <Pressable onPress={() => setShowModalEndTimePicker(true)}>
                  <TextInput
                    style={styles.input}
                    placeholder="14:00"
                    placeholderTextColor="#94a3b8"
                    value={draftForm.endTime}
                    editable={false}
                  />
                </Pressable>
                {showModalEndTimePicker && (
                  <DateTimePicker
                    value={draftForm.endTime ? (() => {
                      const [h, m] = draftForm.endTime.split(':').map(Number);
                      const d = new Date();
                      d.setHours(h || 14, m || 0, 0, 0);
                      return d;
                    })() : new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedTime) => {
                      setShowModalEndTimePicker(Platform.OS === 'ios');
                      if (Platform.OS === 'android' && event.type === 'dismissed') {
                        setDraftFormField('endTime', '');
                      } else if (selectedTime) {
                        const timeStr = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
                        setDraftFormField('endTime', timeStr);
                      }
                    }}
                  />
                )}
              </View>
            </View>
            <View style={styles.addFixedModalActions}>
              <Pressable style={styles.addFixedCancelButton} onPress={closeAddFixedModal}>
                <Text style={styles.addFixedCancelButtonText}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.addFixedConfirmButton, !draftPlace && styles.addFixedConfirmButtonDisabled]}
                onPress={confirmAddFixed}
                disabled={!draftPlace}
              >
                <Text style={styles.addFixedConfirmButtonText}>확인</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  fixedScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  fixedScheduleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  fixedScheduleContent: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  totalDaysText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  addFixedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
    backgroundColor: '#faf5ff',
  },
  addFixedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  fixedScheduleCardScrollContainer: {
    flexGrow: 0,
  },
  fixedScheduleCardScroll: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingRight: 16,
    alignItems: 'flex-start',
  },
  fixedScheduleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fixedScheduleCardSlide: {
    width: width * 0.805,
    marginRight: 12,
  },
  fixedScheduleCardSingle: {
    marginBottom: 12,
  },
  fixedScheduleCardInnerScroll: {
    flex: 1,
  },
  fixedScheduleCardInnerContent: {
    paddingBottom: 20,
  },
  fixedScheduleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fixedScheduleCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  fixedScheduleRemove: {
    padding: 6,
  },
  validationError: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
  },
  fixedScheduleHint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
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
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    marginBottom: 15,
    borderRadius: 12,
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
  markerCircleFixed: {
    backgroundColor: '#6366f1',
  },
  reverseGeocodeOverlay: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  reverseGeocodeText: {
    fontSize: 13,
    color: '#64748b',
  },
  fixedSchedulePlaceBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  fixedSchedulePlaceIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  fixedSchedulePlaceText: {
    flex: 1,
  },
  fixedSchedulePlaceName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  fixedSchedulePlaceAddr: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  addFixedModalSafe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  addFixedModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  addFixedModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  addFixedModalMapSection: {
    height: width * 0.5,
    position: 'relative',
    paddingHorizontal: 14,
  },
  addFixedModalMap: {
    width: '100%',
    height: '100%',
  },
  addFixedModalFormSection: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  addFixedFormBlock: {
    marginBottom: 12,
  },
  placeReadOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  placeReadOnlyText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
  },
  addFixedModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 24,
  },
  addFixedCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
  },
  addFixedCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  addFixedConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  addFixedConfirmButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.8,
  },
  addFixedConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  placeCardFixed: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  checkbox: {
    marginRight: 8,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  fixedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
    gap: 3,
  },
  fixedBadgeText: {
    fontSize: 10,
    color: '#6366f1',
    fontWeight: '600',
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
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
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
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectBoxText: {
    fontSize: 14,
    color: '#0f172a',
  },
  selectBoxPlaceholder: {
    fontSize: 14,
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalCloseButton: {
    padding: 4,
  },
  districtList: {
    padding: 10,
  },
  districtItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  districtItemActive: {
    backgroundColor: '#eef2ff',
  },
  districtItemText: {
    fontSize: 15,
    color: '#475569',
  },
  districtItemTextActive: {
    color: '#4f46e5',
    fontWeight: '600',
  },
});
