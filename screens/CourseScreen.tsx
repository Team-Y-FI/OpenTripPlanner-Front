import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Dimensions, Modal, LayoutAnimation, Platform, UIManager, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlaces } from '@/contexts/PlacesContext';
import { planService, CreateCourseRequest, FixedEvent, utilsService } from '@/services';

// Android에서 LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

const KAKAO_API_KEY = process.env.EXPO_PUBLIC_KAKAO_MAPS_KEY || '';

interface SearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
}

// 카카오 맵 타입 선언
declare global {
  interface Window {
    kakao: any;
  }
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

// 서울특별시 경계 좌표 (남서·북동)
const SEOUL_BOUNDS = {
  south: 37.413,
  north: 37.715,
  west: 126.735,
  east: 127.147,
};

// 좌표가 서울특별시 범위 내인지 확인
function isWithinSeoul(lat: number, lng: number): boolean {
  return (
    lat >= SEOUL_BOUNDS.south &&
    lat <= SEOUL_BOUNDS.north &&
    lng >= SEOUL_BOUNDS.west &&
    lng <= SEOUL_BOUNDS.east
  );
}

function parseDate(s: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// react-native-web TextInput는 type prop을 전달하지 않아 브라우저 피커 미동작 → 웹용 HTML input 사용
const webInputBaseStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: '12px 14px',
  fontSize: 14,
  color: '#0f172a',
};

function WebDateInput({
  value,
  onChange,
  disabled,
  hasError,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        ...webInputBaseStyle,
        ...(hasError ? { border: '2px solid #ef4444' } : {}),
      }}
      {...rest}
    />
  );
}

function WebTimeInput({
  value,
  onChange,
  disabled,
  hasError,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        ...webInputBaseStyle,
        ...(hasError ? { border: '2px solid #ef4444' } : {}),
      }}
      {...rest}
    />
  );
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

export default function CourseWeb() {
  const router = useRouter();
  const { resetPlanForm, clearGeneratedPlan, setLastGeneratedPlan, isCourseGenerating, setIsCourseGenerating, reportCourseGenerationComplete } = usePlaces();
  const [selectedMove, setSelectedMove] = useState('walkAndPublic');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districtModalVisible, setDistrictModalVisible] = useState(false);
  const [formData, setFormData] = useState<CourseFormData>(initialFormData);
  const [isGenerating, setIsGenerating] = useState(false);

  // 코스 생성 페이지 진입 시마다 이동수단 기본값을 도보+대중교통으로 설정
  useEffect(() => {
    setSelectedMove('walkAndPublic');
  }, []);

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
  const shouldMoveMapRef = useRef(false); // 검색 결과 선택 시에만 true (ref로 변경하여 불필요한 리렌더링 방지)
  const modalSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalMapContainerRef = useRef<HTMLDivElement | null>(null);
  const modalMapInstance = useRef<any>(null);
  const modalMarkerRef = useRef<any>(null);

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
    if (modalMarkerRef.current) {
      modalMarkerRef.current.setMap(null);
      modalMarkerRef.current = null;
    }
    if (modalMapInstance.current) {
      modalMapInstance.current = null;
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    // 서울특별시 경계 체크
    if (!isWithinSeoul(lat, lng)) {
      Toast.show({
        type: 'error',
        text1: '알림',
        text2: '서울특별시 지역만 선택할 수 있습니다.',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    const noAddressText = '주소를 찾을 수 없습니다';
    setReverseGeocoding(true);

    try {
      // 1순위: 카카오 JS SDK로 바로 역지오코딩 (웹에서 훨씬 빠름)
      let addrFromKakao: string | null = null;
      if (window.kakao?.maps?.services) {
        addrFromKakao = await new Promise<string | null>((resolve) => {
          const geocoder = new window.kakao.maps.services.Geocoder();
          geocoder.coord2Address(lng, lat, (result: any[], status: any) => {
            if (status === window.kakao.maps.services.Status.OK && result[0]) {
              const road = result[0].road_address?.address_name;
              const jibun = result[0].address?.address_name;
              resolve(road || jibun || null);
            } else {
              resolve(null);
            }
          });
        });
      }

      if (addrFromKakao) {
        setDraftPlace({ lat, lng, placeName: addrFromKakao, address: addrFromKakao });
        return;
      }

      // 2순위: 백엔드 유틸 API (Google/Kakao REST)
      const res = await utilsService.reverseGeocode(lat, lng);
      const addr = res.road_address ?? res.address ?? '';

      if (addr) {
        setDraftPlace({ lat, lng, placeName: addr, address: addr });
      } else {
        setDraftPlace({ lat, lng, placeName: noAddressText, address: '' });
      }
    } catch (err) {
      console.error('역지오코딩 실패:', err);
      setDraftPlace({ lat, lng, placeName: noAddressText, address: '' });
    } finally {
      setReverseGeocoding(false);
    }
  };


  const modalSearchPlaces = async (query: string) => {
    if (!query.trim() || !window.kakao || !window.kakao.maps) {
      setModalSearchResults([]);
      return;
    }
    setModalIsSearching(true);
    try {
      const ps = new window.kakao.maps.services.Places();
      // 지역 필터링: selectedDistrict가 있으면 해당 구로, 없으면 서울특별시 전체로 검색
      let searchQuery = query.trim();
      if (selectedDistrict) {
        searchQuery = `${query} 서울특별시 ${selectedDistrict}`;
      } else {
        searchQuery = `${query} 서울특별시`;
      }
      
      // 서울특별시 지역으로 검색 제한 (남서·북동 좌표)
      const bounds = new window.kakao.maps.LatLngBounds(
        new window.kakao.maps.LatLng(37.413, 126.735), // 남서쪽
        new window.kakao.maps.LatLng(37.715, 127.147)  // 북동쪽
      );
      ps.keywordSearch(searchQuery, (data: any, status: any) => {
        setModalIsSearching(false);
        if (status === window.kakao.maps.services.Status.OK && data) {
          setModalSearchResults(data.map((r: any) => ({
            place_id: r.id,
            name: r.place_name,
            formatted_address: r.road_address_name || r.address_name,
            geometry: { location: { lat: parseFloat(r.y), lng: parseFloat(r.x) } },
          })));
          setModalShowResults(true);
        } else {
          setModalSearchResults([]);
        }
      }, { bounds });
    } catch (error) {
      console.error('장소 검색 오류:', error);
      setModalIsSearching(false);
    }
  };

  const selectModalSearchResult = (result: SearchResult) => {
    const { lat, lng } = result.geometry.location;
    shouldMoveMapRef.current = true; // 검색 결과 선택 시 지도 이동 필요
    setDraftPlace({
      lat,
      lng,
      placeName: result.name,
      address: result.formatted_address,
    });
    setModalSearchQuery('');
    setModalSearchResults([]);
    setModalShowResults(false);
  };

  const setDraftFormField = <K extends keyof typeof draftForm>(key: K, value: typeof draftForm[K]) => {
    setDraftForm((prev) => ({ ...prev, [key]: value }));
  };

  const confirmAddFixed = () => {
    const err = draftForm.startTime && draftForm.endTime
      ? (isTimeEndAfterStart(draftForm.startTime, draftForm.endTime) ? null : '종료 시간은 시작 시간보다 빠를 수 없습니다.')
      : null;
    if (err) return;
    if (!draftPlace) return;
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
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
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setFormData((prev) => ({ ...prev, fixedSchedules: prev.fixedSchedules.filter((item) => item.id !== id) }));
  };

  const validateFixedScheduleItem = (item: FixedScheduleItem): string | null => {
    if (!item.startTime || !item.endTime) return null;
    if (!isTimeEndAfterStart(item.startTime, item.endTime)) return '종료 시간은 시작 시간보다 빠를 수 없습니다.';
    return null;
  };

  const isFixedSchedule = formData.hasFixedSchedule;
  const setIsFixedSchedule = (v: boolean) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setFormField('hasFixedSchedule', v);
  };

  const seoulDistricts = [
    '강남구', '강동구', '강북구', '강서구', '관악구',
    '광진구', '구로구', '금천구', '노원구', '도봉구',
    '동대문구', '동작구', '마포구', '서대문구', '서초구',
    '성동구', '성북구', '송파구', '양천구', '영등포구',
    '용산구', '은평구', '종로구', '중구', '중랑구',
  ];

  const purposes = ['데이트', '혼자 시간', '친구들과', '가족 나들이', '사진 찍기', '맛집 위주'];
  const categories = ['카페', '관광지', '문화시설', '쇼핑', '음식점'];

  // UI 카테고리를 API category 값으로 매핑
  const categoryMap: Record<string, CreateCourseRequest['category']> = {
    '카페': 'cafe',
    '음식점': 'restaurant',
    '문화시설': 'culture',
    '관광지': 'attraction',
    '쇼핑': 'shopping',
  };

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

  const loadKakaoMapsScript = () =>
    new Promise<void>((resolve, reject) => {
      if (!KAKAO_API_KEY) return reject(new Error('NO_API_KEY'));
      if (window.kakao && window.kakao.maps && window.kakao.maps.services) return resolve();
      const id = 'kakao-maps-script';
      if (document.getElementById(id)) {
        const check = setInterval(() => {
          if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
            clearInterval(check);
            resolve();
          }
        }, 100);
        return;
      }
      const script = document.createElement('script');
      script.id = id;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}&libraries=services&autoload=false`;
      script.async = true;
      script.onload = () => {
        window.kakao.maps.load(() => resolve());
      };
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });

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

  // 고정 일정 추가 모달: 지도 초기화 및 클릭 리스너
  useEffect(() => {
    if (!addFixedModalVisible || !KAKAO_API_KEY) return;
    loadKakaoMapsScript().then(() => {
      const container = modalMapContainerRef.current;
      if (!container || !window.kakao) return;
      const center = draftPlace
        ? new window.kakao.maps.LatLng(draftPlace.lat, draftPlace.lng)
        : new window.kakao.maps.LatLng(37.5665, 126.9780);
      const options = {
        center,
        level: draftPlace ? 3 : 8,
      };
      modalMapInstance.current = new window.kakao.maps.Map(container, options);
      window.kakao.maps.event.addListener(modalMapInstance.current, 'click', (mouseEvent: any) => {
        const latlng = mouseEvent.latLng;
        reverseGeocode(latlng.getLat(), latlng.getLng());
      });
    }).catch((e) => console.error('모달 지도 초기화 실패', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addFixedModalVisible]);

  // 모달 지도: draftPlace 변경 시 마커 갱신 (검색 결과 선택 시에만 지도 이동)
  useEffect(() => {
    if (!window.kakao || !modalMapInstance.current || !addFixedModalVisible) return;
    if (modalMarkerRef.current) {
      modalMarkerRef.current.setMap(null);
      modalMarkerRef.current = null;
    }
    if (draftPlace) {
      const markerPosition = new window.kakao.maps.LatLng(draftPlace.lat, draftPlace.lng);
      modalMarkerRef.current = new window.kakao.maps.Marker({
        position: markerPosition,
        map: modalMapInstance.current,
      });
      // 검색 결과 선택 시에만 지도 이동 (지도 클릭 시에는 이동하지 않음)
      if (shouldMoveMapRef.current) {
        modalMapInstance.current.panTo(markerPosition);
        modalMapInstance.current.setLevel(3);
        shouldMoveMapRef.current = false;
      }
    }
  }, [addFixedModalVisible, draftPlace]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleGenerate = async () => {
    // 필수 입력 검증 (웹/앱 공통)
    if (selectedDistrict === undefined || selectedDistrict === null) {
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
    // 당일 여행이면서 시작 시간과 종료 시간이 같은 경우 검증
    if (formData.startDate === formData.endDate && formData.firstDayStartTime === formData.lastDayEndTime) {
      Toast.show({ type: 'error', text1: '알림', text2: '시작 시간과 종료 시간이 같으면 코스를 생성할 수 없습니다.', position: 'top', visibilityTime: 3000 });
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

    // 이미 다른 곳에서 코스 생성 중이면 중복 요청 방지
    if (isCourseGenerating) {
      Toast.show({ type: 'info', text1: '알림', text2: '이미 코스 생성이 진행 중입니다.', position: 'top', visibilityTime: 3000 });
      return;
    }

    // API 요청 데이터 생성
    // 선택된 카테고리 중 첫 번째를 API category로 사용 (기본값: attraction)
    const selectedApiCategory: CreateCourseRequest['category'] =
      selectedCategories.length > 0
        ? (categoryMap[selectedCategories[0]] || 'attraction')
        : 'attraction';

    const requestData: CreateCourseRequest = {
      region: selectedDistrict || '서울특별시',
      start_date: formData.startDate,
      end_date: formData.endDate,
      first_day_start_time: formData.firstDayStartTime,
      last_day_end_time: formData.lastDayEndTime,
      fixed_events: fixedEvents,
      transport_mode: selectedMove === 'car' ? 'car' : 'walkAndPublic',
      category: selectedApiCategory,
    };

    setIsGenerating(true);
    setIsCourseGenerating(true);

    try {
      const response = await planService.createCourse(requestData);

      // 플랜 폼 리셋 및 결과 저장
      resetPlanForm();
      clearGeneratedPlan();

      // 응답 데이터를 context에 저장 (성공/이동·토스트는 전역 리스너에서 처리)
      setLastGeneratedPlan(response);
      reportCourseGenerationComplete('success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '코스 생성에 실패했습니다.';
      reportCourseGenerationComplete('error', errorMessage);
    } finally {
      setIsGenerating(false);
    }
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

        {/* 여행 기본 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 여행 기본 정보</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>지역 선택</Text>
            <Pressable
              style={[styles.selectBox, isGenerating && styles.inputDisabled]}
              onPress={() => !isGenerating && setDistrictModalVisible(true)}
              disabled={isGenerating}
            >
              <Text style={selectedDistrict !== undefined ? styles.selectBoxText : styles.selectBoxPlaceholder}>
                {selectedDistrict ? selectedDistrict : selectedDistrict === '' ? '전체 (서울특별시)' : '서울특별시 구를 선택하세요'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#64748b" />
            </Pressable>
          </View>
          {/* 고정 일정 */} 
          <Pressable
            style={[styles.fixedScheduleRow, isGenerating && styles.inputDisabled]}
            onPress={() => !isGenerating && setIsFixedSchedule(!isFixedSchedule)}
            disabled={isGenerating}
          >
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
                      <Text style={styles.label}>날짜</Text>
                      <WebDateInput
                        value={item.date}
                        onChange={(v) => updateFixedScheduleItem(item.id, 'date', v)}
                        disabled={isGenerating}
                        placeholder="2026-01-31"
                      />
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
                    <View style={[styles.row, styles.rowTimeInputs]}>
                      <View style={styles.inputGroupFlex}>
                        <Text style={styles.label}>시작</Text>
                        <WebTimeInput
                          value={item.startTime}
                          onChange={(v) => updateFixedScheduleItem(item.id, 'startTime', v)}
                          disabled={isGenerating}
                          placeholder="14:00"
                        />
                      </View>
                      <View style={styles.inputGroupFlex}>
                        <Text style={styles.label}>종료</Text>
                        <WebTimeInput
                          value={item.endTime}
                          onChange={(v) => updateFixedScheduleItem(item.id, 'endTime', v)}
                          disabled={isGenerating}
                          hasError={!!err}
                          placeholder="16:00"
                        />
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
                      <Text style={styles.label}>날짜</Text>
                      <WebDateInput
                        value={item.date}
                        onChange={(v) => updateFixedScheduleItem(item.id, 'date', v)}
                        disabled={isGenerating}
                        placeholder="2026-01-31"
                      />
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
                    <View style={[styles.row, styles.rowTimeInputs]}>
                      <View style={styles.inputGroupFlex}>
                        <Text style={styles.label}>시작</Text>
                        <WebTimeInput
                          value={item.startTime}
                          onChange={(v) => updateFixedScheduleItem(item.id, 'startTime', v)}
                          disabled={isGenerating}
                          placeholder="14:00"
                        />
                      </View>
                      <View style={styles.inputGroupFlex}>
                        <Text style={styles.label}>종료</Text>
                        <WebTimeInput
                          value={item.endTime}
                          onChange={(v) => updateFixedScheduleItem(item.id, 'endTime', v)}
                          disabled={isGenerating}
                          hasError={!!err}
                          placeholder="16:00"
                        />
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

          {/* 날짜 및 시간 (터미널 로직 대응) */}
          <View style={styles.inputGroup}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>여행 시작 일자</Text>
              <WebDateInput
                value={formData.startDate}
                onChange={(v) => setFormField('startDate', v)}
                disabled={isGenerating}
                hasError={!!(formData.startDate && !isStartDateValid(formData.startDate))}
                placeholder="2026-01-20"
              />
              {formData.startDate && !isStartDateValid(formData.startDate) && (
                <Text style={styles.validationError}>여행 시작 일자는 오늘 이후여야 합니다.</Text>
              )}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>여행 종료 일자</Text>
              <WebDateInput
                value={formData.endDate}
                onChange={(v) => setFormField('endDate', v)}
                disabled={isGenerating}
                hasError={(() => {
                  const start = parseDate(formData.startDate);
                  const end = parseDate(formData.endDate);
                  return !!(start && end && end < start);
                })()}
                placeholder="2026-01-25"
              />
              {formData.startDate && formData.endDate && totalDays >= 1 && (
                <Text style={styles.totalDaysText}>총 여행 일수 : {totalDays}일</Text>
              )}
            </View>
            <View style={[styles.row, styles.rowTimeInputs]}>
              <View style={styles.inputGroupFlex}>
                <Text style={styles.label}>여행 첫날 시작 시간</Text>
                <WebTimeInput
                  placeholder="14:00"
                  value={formData.firstDayStartTime}
                  onChange={(v) => setFormField('firstDayStartTime', v)}
                  disabled={isGenerating}
                />
              </View>
              <View style={styles.inputGroupFlex}>
                <Text style={styles.label}>여행 마지막 날 종료 시간</Text>
                <WebTimeInput
                  value={formData.lastDayEndTime}
                  onChange={(v) => setFormField('lastDayEndTime', v)}
                  disabled={isGenerating}
                  placeholder="18:00"
                />
              </View>
            </View>
          </View>
        </View>

        {/* 코스 조건 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            2. 코스 조건
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>이동수단</Text>
            <View style={styles.buttonRow}>
              {[{ key: 'walkAndPublic', label: '도보 + 대중교통' }, { key: 'car', label: '차량' }].map(option => (
                <Pressable
                  key={option.key}
                  style={[styles.optionButton, selectedMove === option.key && styles.optionButtonActive]}
                  onPress={() => setSelectedMove(option.key)}
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
              <Text style={styles.generateItem}>2  시작점 기준 최적 동선 코스 A안 · 교통 반영</Text>
              <Text style={styles.generateItem}>3  지도 기반 일정표 + 타임라인 한 화면 제공</Text>
            </View>
            <Pressable
              style={[styles.generateButton, (isGenerating || isCourseGenerating) && styles.generateButtonDisabled]}
              onPress={handleGenerate}
              disabled={isGenerating || isCourseGenerating}
            >
              {(isGenerating || isCourseGenerating) ? (
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
                <Pressable
                  style={[styles.districtItem, selectedDistrict === '' && styles.districtItemActive]}
                  onPress={() => {
                    setSelectedDistrict('');
                    setDistrictModalVisible(false);
                  }}
                >
                  <Text style={[styles.districtItemText, selectedDistrict === '' && styles.districtItemTextActive]}>
                    전체 (서울특별시)
                  </Text>
                </Pressable>
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
            <ScrollView style={styles.addFixedModalScroll} contentContainerStyle={styles.addFixedModalScrollContent} keyboardShouldPersistTaps="handled">
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
                      <ScrollView
                        style={styles.searchResultsScroll}
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="handled"
                      >
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
                              <Text style={styles.searchResultAddress} numberOfLines={1}>{result.formatted_address ?? ''}</Text>
                            </View>
                            <Ionicons name="pin" size={24} color="#6366f1" />
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                <div
                  ref={modalMapContainerRef as any}
                  style={{ width: '100%', height: '100%', minHeight: width * 0.3 }}
                />
                {reverseGeocoding && (
                  <View style={styles.reverseGeocodeOverlay}>
                    <ActivityIndicator size="small" color="#6366f1" />
                    <Text style={styles.reverseGeocodeText}>주소 조회 중...</Text>
                  </View>
                )}
              </View>
              <View style={styles.addFixedModalFormSection}>
              <View style={styles.addFixedFormBlock}>
                <Text style={styles.label}>선택한 장소</Text>
                <View style={styles.placeReadOnly}>
                  <Ionicons name="location" size={18} color="#6366f1" />
                  <Text style={styles.placeReadOnlyText} numberOfLines={2}>
                    {draftPlace ? (draftPlace.placeName || draftPlace.address || '주소를 찾을 수 없습니다') : '지도를 클릭하거나 검색해서 장소를 선택하세요'}
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
                <Text style={styles.label}>날짜</Text>
                <WebDateInput
                  value={draftForm.date}
                  onChange={(v) => setDraftFormField('date', v)}
                  placeholder="2026-01-31"
                />
              </View>
              <View style={[styles.row, styles.rowTimeInputs]}>
                <View style={styles.inputGroupFlex}>
                  <Text style={styles.label}>시작 시간</Text>
                  <WebTimeInput
                    value={draftForm.startTime}
                    onChange={(v) => setDraftFormField('startTime', v)}
                    placeholder="12:00"
                  />
                </View>
                <View style={styles.inputGroupFlex}>
                  <Text style={styles.label}>종료 시간</Text>
                  <WebTimeInput
                    value={draftForm.endTime}
                    onChange={(v) => setDraftFormField('endTime', v)}
                    placeholder="14:00"
                  />
                </View>
              </View>
              <View style={styles.addFixedModalActions}>
                <Pressable style={styles.addFixedCancelButton} onPress={closeAddFixedModal}>
                  <Text style={styles.addFixedCancelButtonText}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.addFixedConfirmButton, (!draftPlace || !draftForm.startTime || !draftForm.endTime || !draftForm.date) && styles.addFixedConfirmButtonDisabled]}
                  onPress={confirmAddFixed}
                  disabled={!draftPlace || !draftForm.startTime || !draftForm.endTime || !draftForm.date}
                >
                  <Text style={styles.addFixedConfirmButtonText}>확인</Text>
                </Pressable>
              </View>
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
    maxWidth: '100%',
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
    minHeight: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  searchBar: {
    marginBottom: 8,
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  placeCardFixed: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  checkbox: {
    marginRight: 10,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  fixedBadgeText: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '600',
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
    width: width * 0.88,
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
  fixedSchedulePlaceBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  mapSearchOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchLoading: {
    marginLeft: 8,
  },
  searchResultsOverlay: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginTop: 8,
    maxHeight: 220,
    overflow: 'hidden',
  },
  searchResultsScroll: {
    maxHeight: 220,
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
  addFixedModalScroll: {
    flex: 1,
  },
  addFixedModalScrollContent: {
    paddingBottom: 20,
  },
  addFixedModalMapSection: {
    height: width * 0.3,
    position: 'relative',
    marginBottom: 16,
  },
  addFixedModalFormSection: {
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
  fixedScheduleHint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
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
    overflow: 'hidden',
  },
  inputGroup: {
    marginBottom: 16,
    minWidth: 0,
    overflow: 'hidden',
  },
  inputGroupFlex: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: width < 400 ? 'column' : 'row',
    gap: 14,
    marginBottom: 16,
  },
  rowTimeInputs: {
    flexDirection: 'column',
    gap: 14,
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
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
