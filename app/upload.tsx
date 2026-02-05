import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions, Modal, TextInput, Image, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlaces } from '@/contexts/PlacesContext';
import * as ImagePicker from 'expo-image-picker';
import { api, metaService } from '@/services';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import FullScreenLoader from '@/components/FullScreenLoader';

const { width } = Dimensions.get('window');

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000/otp';
const STORAGE_BASE = API_URL.replace(/\/otp\/?$/, '');

const PICKER_MEDIA_TYPES = (ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images;

interface ExifData {
  lat: number;
  lng: number;
  taken_at: string | null;
}

interface PlaceData {
  name: string;
  address: string | null;
  category: string | null;
  lat: number;
  lng: number;
}



type UploadLimits = {
  max_photos: number;
  max_file_size_mb: number;
  allowed_exts: string[];
};

const DEFAULT_LIMITS: UploadLimits = {
  max_photos: 20,
  max_file_size_mb: 10,
  allowed_exts: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
};

const DEFAULT_PLACE_CATEGORIES = ["??", "??", "??", "??", "??", "??"];
interface PhotoData {
  photo_id: string;
  file_name: string;
  status: 'recognized' | 'needs_manual';
  exif: ExifData | null;
  place: PlaceData | null;
  thumbnail_url: string | null;
  selected: boolean;
  editingPlace?: boolean; // 장소 수정 중인지 여부
}

export default function UploadScreen() {
  const router = useRouter();
  const { setSelectedPlaces } = usePlaces();
  const { user } = useAuth();
  const { startGlobalLoading, endGlobalLoading } = useSession();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeCategory, setPlaceCategory] = useState('');
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [limits, setLimits] = useState<UploadLimits>(DEFAULT_LIMITS);
  const [placeCategories, setPlaceCategories] = useState<string[]>(DEFAULT_PLACE_CATEGORIES);

  useEffect(() => {
    metaService
      .getOptions()
      .then((opts) => {
        if (opts.place_categories?.length) {
          setPlaceCategories(opts.place_categories.map((o) => o.label));
        }
      })
      .catch(() => {});
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  // 이미지 선택 및 업로드
  const handlePickImages = async () => {
    // 권한 요청
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '사진을 선택하려면 갤러리 접근 권한이 필요합니다.');
        return;
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: PICKER_MEDIA_TYPES,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: Math.max(0, limits.max_photos - photos.length), // 최대 20장 제한
      });

      if (!result.canceled && result.assets.length > 0) {
        await uploadImages(result.assets);
      }
    } catch (error) {
      console.error('이미지 선택 실패:', error);
      Toast.show({
        type: 'error',
        text1: '이미지 선택 실패',
        text2: '이미지를 선택하는 중 오류가 발생했습니다.',
      });
    }
  };

  // 이미지 업로드
  const uploadImages = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!user) {
      Toast.show({
        type: 'error',
        text1: '로그인 필요',
        text2: '사진을 업로드하려면 로그인이 필요합니다.',
      });
      return;
    }

    setIsUploading(true);
    startGlobalLoading();

    try {
      const allowedExts = new Set(limits.allowed_exts.map((ext) => ext.toLowerCase()));
      const maxBytes = limits.max_file_size_mb * 1024 * 1024;

      const invalidExts: string[] = [];
      const invalidSizes: string[] = [];

      const validAssets = assets.filter((asset) => {
        const name = asset.fileName || asset.uri.split('/').pop() || '';
        const ext = name.split('.').pop()?.toLowerCase() || '';

        if (ext && !allowedExts.has(ext)) {
          invalidExts.push(name);
          return false;
        }

        const size = (asset as any).fileSize;
        if (typeof size === 'number' && size > maxBytes) {
          invalidSizes.push(name);
          return false;
        }

        return true;
      });

      if (invalidExts.length || invalidSizes.length) {
        const messages: string[] = [];
        if (invalidExts.length) {
          messages.push(`???? ?? ???: ${invalidExts.slice(0, 3).join(', ')}`);
        }
        if (invalidSizes.length) {
          messages.push(`?? ??: ${invalidSizes.slice(0, 3).join(', ')}`);
        }
        Toast.show({
          type: 'error',
          text1: '??? ??',
          text2: messages.join(' / '),
        });
      }

      if (validAssets.length === 0) {
        return;
      }

      const formData = new FormData();
      
      // FormData에 이미지 추가
      for (const asset of validAssets) {
        const uri = asset.uri;
        const filename = asset.fileName || uri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        const filenameWithExt = match ? filename : `${filename}.${type.split('/')[1] || 'jpg'}`;

        if (Platform.OS === 'web') {
          const resp = await fetch(uri);
          const blob = await resp.blob();
          const file = new File([blob], filenameWithExt, { type });
          formData.append('files', file);
        } else {
          formData.append('files', {
            uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
            name: filenameWithExt,
            type: type,
          } as any);
        }
      }

      // 백엔드 API 호출
      const response = await api.postFormData<{
        upload_id: string;
        limits: { max_photos: number; max_file_size_mb: number; allowed_exts: string[] };
        photos: Array<{
          photo_id: string;
          file_name: string;
          status: 'recognized' | 'needs_manual';
          exif: ExifData | null;
          place: PlaceData | null;
          thumbnail_url: string | null;
        }>;
      }>('/uploads/photos', formData, {
        requiresAuth: true,
      });

      setLimits({
        max_photos: response.limits?.max_photos ?? DEFAULT_LIMITS.max_photos,
        max_file_size_mb: response.limits?.max_file_size_mb ?? DEFAULT_LIMITS.max_file_size_mb,
        allowed_exts: response.limits?.allowed_exts ?? DEFAULT_LIMITS.allowed_exts,
      });

      // 업로드된 사진들을 상태에 추가
      const newPhotos: PhotoData[] = response.photos.map((photo) => ({
        ...photo,
        thumbnail_url: photo.thumbnail_url ? `${STORAGE_BASE}${photo.thumbnail_url}` : null,
        selected: false,
      }));

      setPhotos((prev) => [...prev, ...newPhotos]);

      Toast.show({
        type: 'success',
        text1: '업로드 완료',
        text2: `${newPhotos.length}개의 사진이 업로드되었습니다.`,
      });
    } catch (error: any) {
      console.error('이미지 업로드 실패:', error);
      Toast.show({
        type: 'error',
        text1: '업로드 실패',
        text2: error.message || '사진을 업로드하는 중 오류가 발생했습니다.',
      });
    } finally {
      setIsUploading(false);
      endGlobalLoading();
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    setPhotos((prev) =>
      prev.map((photo) =>
        photo.photo_id === photoId
          ? { ...photo, selected: !photo.selected }
          : photo
      )
    );
  };

  const handleCreateCourse = () => {
    const selected = photos
      .filter((photo) => photo.selected && photo.place)
      .map((photo) => ({
        id: photo.photo_id,
        filename: photo.file_name,
        placeName: photo.place!.name,
        placeAddress: photo.place!.address || '',
        category: photo.place!.category || '',
        timestamp: photo.exif?.taken_at || '',
      }));

    if (selected.length === 0) {
      Toast.show({
        type: 'info',
        text1: '선택된 항목 없음',
        text2: '코스를 만들려면 장소가 인식된 사진을 선택해주세요.',
      });
      return;
    }

    setSelectedPlaces(selected);
    router.push('/course');
  };

  const openPlaceModal = (photoId: string) => {
    const photo = photos.find((p) => p.photo_id === photoId);
    if (photo) {
      setEditingPhotoId(photoId);
      setPlaceName(photo.place?.name || '');
      setPlaceAddress(photo.place?.address || '');
      setPlaceCategory(photo.place?.category || '');
      setModalVisible(true);
    }
  };

  const handleSavePlace = async () => {
    if (!editingPhotoId || !placeName) {
      return;
    }

    const target = photos.find((p) => p.photo_id === editingPhotoId);
    const lat = target?.exif?.lat ?? null;
    const lng = target?.exif?.lng ?? null;

    if (!placeCategory) {
      Toast.show({
        type: 'error',
        text1: '???? ??',
        text2: '?? ????? ??? ???.',
      });
      return;
    }

    if (lat == null || lng == null) {
      Toast.show({
        type: 'error',
        text1: '?? ?? ??',
        text2: 'EXIF ?? ??? ??? ??? ? ????.',
      });
      return;
    }

    startGlobalLoading();

    try {
      const response = await api.patch<{
        photo_id: string;
        status: string;
        place: PlaceData;
        thumbnail_url: string | null;
      }>(
        `/photos/${editingPhotoId}/place`,
        {
          name: placeName,
          address: placeAddress || null,
          category: placeCategory || null,
          lat,
          lng,
        },
        { requiresAuth: true }
      );

      // 사진 정보 업데이트
      setPhotos((prev) =>
        prev.map((photo) =>
          photo.photo_id === editingPhotoId
            ? {
                ...photo,
                place: response.place,
                status: 'recognized' as const,
                thumbnail_url: response.thumbnail_url ? `${STORAGE_BASE}${response.thumbnail_url}` : photo.thumbnail_url,
              }
            : photo
        )
      );

      setModalVisible(false);
      setEditingPhotoId(null);
      setPlaceName('');
      setPlaceAddress('');
      setPlaceCategory('');

      Toast.show({
        type: 'success',
        text1: '저장 완료',
        text2: '장소 정보가 저장되었습니다.',
      });
    } catch (error: any) {
      console.error('장소 정보 저장 실패:', error);
      Toast.show({
        type: 'error',
        text1: '저장 실패',
        text2: error.message || '장소 정보를 저장하는 중 오류가 발생했습니다.',
      });
    } finally {
      endGlobalLoading();
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}.${month}.${day} ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FullScreenLoader visible={isUploading} message="사진을 업로드하는 중..." />
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
        <Pressable onPress={() => router.push('/records')}>
          <Text style={styles.headerLink}>내 기록 보기</Text>
        </Pressable>
      </View>

      {/* 진행 단계 */}
      <View style={styles.stepBanner}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>STEP 1</Text>
        </View>
        <Text style={styles.stepTitle}>사진 업로드 & 장소 인식</Text>
      </View>

      {/* 업로드 영역 */}
      <View style={styles.section}>
        <LinearGradient
          colors={['#eef2ff', '#e0e7ff']}
          style={styles.uploadBox}>
          <View style={styles.uploadIcon}>
            <Text style={styles.uploadEmoji}>📷</Text>
          </View>
          <Text style={styles.uploadTitle}>여행 사진을 업로드해 보세요</Text>
          <Text style={styles.uploadDesc}>
            위치 정보가 있는 사진은 자동으로 장소를 인식하고,{'\n'}
            없는 사진은 최소 질문으로 빠르게 확인할게요.
          </Text>
          <Pressable 
            style={styles.uploadButton}
            onPress={handlePickImages}
            disabled={isUploading || photos.length >= limits.max_photos}>
            <Text style={styles.uploadButtonText}>파일 선택</Text>
          </Pressable>
          <Text style={styles.uploadNote}>
            ?? {limits.max_photos}? ? {limits.max_file_size_mb}MB ? {limits.allowed_exts.join(' / ').toUpperCase()}
          </Text>
        </LinearGradient>
      </View>

      {/* 업로드된 사진 리스트 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>업로드된 사진 ({photos.length})</Text>
          <Text style={styles.sectionSubtitle}>선택한 장소로 코스 생성</Text>
        </View>

        {photos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>업로드된 사진이 없습니다</Text>
            <Text style={styles.emptyStateSubtext}>위의 &quot;파일 선택&quot; 버튼을 눌러 사진을 업로드하세요</Text>
          </View>
        ) : (
          photos.map((photo) => (
            <View 
              key={photo.photo_id}
              style={[
                styles.photoCard,
                photo.status === 'recognized' && styles.photoCardSuccess,
                photo.status === 'needs_manual' && styles.photoCardGray,
              ]}>
              <Pressable 
                style={styles.checkbox}
                onPress={() => togglePhotoSelection(photo.photo_id)}
                disabled={!photo.place}>
                <View style={[
                  styles.checkboxBox,
                  photo.selected && styles.checkboxBoxChecked,
                  !photo.place && styles.checkboxBoxDisabled,
                ]}>
                  {photo.selected && (
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  )}
                </View>
              </Pressable>
              
              <View style={styles.photoThumbnail}>
                {photo.thumbnail_url ? (
                  <Image 
                    source={{ uri: photo.thumbnail_url }} 
                    style={styles.photoThumbnailImage}
                    resizeMode="cover"
                  />
                ) : (
                  <LinearGradient colors={['#cbd5e1', '#94a3b8']} style={styles.photoThumbnailBg}>
                    <Text style={styles.photoThumbnailText}>사진</Text>
                  </LinearGradient>
                )}
              </View>
              
              <View style={styles.photoInfo}>
                <View style={styles.photoHeader}>
                  <Text style={styles.photoName} numberOfLines={1} ellipsizeMode="middle">
                    {photo.file_name}
                  </Text>
                  {photo.status === 'recognized' && (
                    <View style={styles.photoBadgeSuccess}>
                      <Text style={styles.photoBadgeSuccessText}>위치 자동 인식</Text>
                    </View>
                  )}
                  {photo.status === 'needs_manual' && (
                    <View style={styles.photoBadgeGray}>
                      <Text style={styles.photoBadgeGrayText}>위치 정보 없음</Text>
                    </View>
                  )}
                </View>
                
                {photo.place ? (
                  <>
                    <Text style={styles.photoDetail}>
                      {photo.place.address || ''} {photo.exif?.taken_at ? `· ${formatDateTime(photo.exif.taken_at)}` : ''}
                    </Text>
                    <Text style={styles.photoPlace}>인식된 장소: {photo.place.name}</Text>
                    {photo.place.category && (
                      <Text style={styles.photoCategory}>카테고리: {photo.place.category}</Text>
                    )}
                  </>
                ) : (
                  <>
                    {photo.exif ? (
                      <>
                        <Text style={styles.photoDetail}>
                          EXIF 위치 정보: {photo.exif.lat.toFixed(6)}, {photo.exif.lng.toFixed(6)}
                        </Text>
                        <Text style={styles.photoDetail}>
                          촬영 시간: {formatDateTime(photo.exif.taken_at)}
                        </Text>
                        <Pressable onPress={() => openPlaceModal(photo.photo_id)}>
                          <Text style={styles.photoLink}>장소 정보 입력하기</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Text style={styles.photoDetail}>이 사진은 어디에서 찍으셨나요? 한 번만 여쭤볼게요.</Text>
                        <Pressable onPress={() => openPlaceModal(photo.photo_id)}>
                          <Text style={styles.photoLink}>직접 장소 입력하기</Text>
                        </Pressable>
                      </>
                    )}
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* 하단 액션 */}
      <View style={styles.actionSection}>
        <Pressable 
          style={[
            styles.actionButtonPrimary,
            photos.filter(p => p.selected).length === 0 && styles.actionButtonDisabled
          ]}
          onPress={handleCreateCourse}
          disabled={photos.filter(p => p.selected).length === 0}>
          <LinearGradient
            colors={photos.filter(p => p.selected).length > 0 
              ? ['#6366f1', '#38bdf8'] 
              : ['#cbd5e1', '#cbd5e1']}
            style={styles.actionButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}>
            <View style={styles.actionButtonContent}>
              <View style={styles.actionButtonTextWrapper}>
                <Text style={styles.actionButtonPrimaryText}>이 기록들로 코스 만들기</Text>
                {photos.filter(p => p.selected).length > 0 && (
                  <View style={styles.actionButtonBadge}>
                    <Text style={styles.actionButtonBadgeText}>
                      {photos.filter(p => p.selected).length}개 선택
                    </Text>
                  </View>
                )}
              </View>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            </View>
          </LinearGradient>
        </Pressable>
        
        <Pressable style={styles.actionButton} onPress={() => router.push('/records')}>
          <Text style={styles.actionButtonText}>먼저 기록만 쌓기</Text>
        </Pressable>
      </View>
      </ScrollView>

      {/* 장소 입력 모달 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              setModalVisible(false);
              setEditingPhotoId(null);
              setPlaceName('');
              setPlaceAddress('');
              setPlaceCategory('');
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>장소 정보 입력</Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>장소 이름 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="예: 마들렌 카페 홍대점"
                  placeholderTextColor="#94a3b8"
                  value={placeName}
                  onChangeText={setPlaceName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>주소</Text>
                <TextInput
                  style={styles.input}
                  placeholder="예: 서울시 마포구 홍익로"
                  placeholderTextColor="#94a3b8"
                  value={placeAddress}
                  onChangeText={setPlaceAddress}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>카테고리</Text>
                <View style={styles.categoryButtons}>
                  {placeCategories.map((category) => (
                    <Pressable
                      key={category}
                      style={[
                        styles.categoryButton,
                        placeCategory === category && styles.categoryButtonActive
                      ]}
                      onPress={() => setPlaceCategory(category)}>
                      <Text
                        style={[
                          styles.categoryButtonText,
                          placeCategory === category && styles.categoryButtonTextActive
                        ]}>
                        {category}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  setModalVisible(false);
                  setEditingPhotoId(null);
                  setPlaceName('');
                  setPlaceAddress('');
                  setPlaceCategory('');
                }}>
                <Text style={styles.modalCancelButtonText}>취소</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalSaveButton,
                  !placeName && styles.modalSaveButtonDisabled
                ]}
                onPress={handleSavePlace}
                disabled={!placeName}>
                <LinearGradient
                  colors={placeName ? ['#6366f1', '#38bdf8'] : ['#cbd5e1', '#cbd5e1']}
                  style={styles.modalSaveButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}>
                  <Text style={styles.modalSaveButtonText}>저장</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
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
  headerLink: {
    fontSize: 13,
    color: '#64748b',
  },
  stepBanner: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginBottom: 16,
    gap: 12,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
    elevation: 1,
  },
  stepBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)',
    elevation: 2,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  section: {
    padding: 20,
  },
  uploadBox: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  uploadIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    boxShadow: '0 4px 8px rgba(99, 102, 241, 0.2)',
    elevation: 4,
  },
  uploadEmoji: {
    fontSize: 32,
  },
  uploadTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  uploadDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  uploadButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 12,
    boxShadow: '0 4px 8px rgba(99, 102, 241, 0.3)',
    elevation: 4,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  uploadNote: {
    fontSize: 12,
    color: '#94a3b8',
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
    fontSize: 13,
    color: '#64748b',
  },
  photoCard: {
    flexDirection: width < 400 ? 'column' : 'row',
    gap: 16,
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: width < 400 ? 'flex-start' : 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  checkbox: {
    marginRight: 4,
  },
  checkboxBox: {
    width: 24,
    height: 24,
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
  checkboxBoxDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  photoCardSuccess: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  photoCardWarning: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  photoCardGray: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#94a3b8',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  photoThumbnailBg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  photoThumbnailText: {
    fontSize: 12,
    color: '#ffffff',
  },
  photoCategory: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
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
  photoInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  photoName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 22,
  },
  photoBadgeSuccess: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
    elevation: 2,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  photoBadgeSuccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  photoBadgeWarning: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)',
    elevation: 2,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  photoBadgeWarningText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  photoBadgeGray: {
    backgroundColor: '#64748b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  photoBadgeGrayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  photoDetail: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
    flexWrap: 'wrap',
    lineHeight: 18,
  },
  photoPlace: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '500',
    lineHeight: 18,
  },
  photoLink: {
    fontSize: 13,
    color: '#6366f1',
    textDecorationLine: 'underline',
    fontWeight: '600',
    lineHeight: 18,
  },
  actionSection: {
    flexDirection: 'column',
    padding: 20,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  actionButtonPrimary: {
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 4px 8px rgba(99, 102, 241, 0.3)',
    elevation: 4,
  },
  actionButtonDisabled: {
    shadowOpacity: 0.1,
    elevation: 1,
  },
  actionButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButtonTextWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flex: 1,
  },
  actionButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionButtonBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionButtonBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    flexGrow: 1,
    flexShrink: 1,
  },
  modalScrollContent: {
    padding: 24,
    paddingBottom: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0f172a',
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  categoryButtonActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    paddingBottom: 28,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
