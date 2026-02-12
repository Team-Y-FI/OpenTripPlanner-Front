import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions, Modal, TextInput, Image, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { api, metaService, recordService, utilsService, API_URL } from '@/services';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import FullScreenLoader from '@/components/FullScreenLoader';
import PlacePickerMap from '@/components/PlacePickerMap';

const { width } = Dimensions.get('window');

const STORAGE_BASE = API_URL.replace(/\/otp\/?$/, '');

const resolveStorageUrl = (url?: string | null) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${STORAGE_BASE}${url}`;
  return `${STORAGE_BASE}/${url}`;
};

const PICKER_MEDIA_TYPES: ImagePicker.MediaType[] = ['images'];

interface ExifData {
  lat: number | null;
  lng: number | null;
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

type UploadAsset = {
  uri: string;
  name: string;
  type: string;
  meta?: UploadMeta | null;
};

type UploadMeta = {
  lat?: number | null;
  lng?: number | null;
  taken_at?: string | null;
};

type VisitType = 'visited' | 'planned';

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_COMPRESS_QUALITY = 0.75;

const DEFAULT_LIMITS: UploadLimits = {
  max_photos: 20,
  max_file_size_mb: 10,
  allowed_exts: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
};

const ensureEtcCategory = (items: string[]) =>
  items.includes('기타') ? items : [...items, '기타'];

const DEFAULT_PLACE_CATEGORIES = ensureEtcCategory(["카페", "맛집", "전시", "공원", "야경", "쇼핑"]);

const webDateInputBaseStyle: any = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  backgroundColor: '#f8fafc',
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
  placeholder,
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
      placeholder={placeholder}
      style={{
        ...webDateInputBaseStyle,
        ...(hasError ? { border: '2px solid #ef4444' } : {}),
      }}
    />
  );
}
interface PhotoData {
  photo_id: string;
  file_name: string;
  status: 'recognized' | 'needs_manual';
  exif: ExifData | null;
  place: PlaceData | null;
  thumbnail_url: string | null;
  memo?: string | null;
  visit_type?: VisitType;
  visit_date?: string | null;
  editingPlace?: boolean; // 장소 수정 중인지 여부
}

const getAssetName = (asset: ImagePicker.ImagePickerAsset) =>
  asset.fileName || asset.uri.split('/').pop() || 'image';

const getAssetExt = (name: string) => name.split('.').pop()?.toLowerCase() || '';

const isHeicAsset = (asset: ImagePicker.ImagePickerAsset, ext: string) => {
  const mime = asset.mimeType?.toLowerCase() || '';
  return ext === 'heic' || ext === 'heif' || mime.includes('heic') || mime.includes('heif');
};

const ensureFileNameWithExt = (name: string, ext: string) => {
  if (/\.\w+$/.test(name)) return name;
  const fallback = ext || 'jpg';
  return `${name}.${fallback}`;
};

const parseExifNumber = (value: any): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.includes('/')) {
      const [n, d] = trimmed.split('/');
      const num = Number(n);
      const den = Number(d);
      if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) return num / den;
      return null;
    }
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  if (value && typeof value === 'object') {
    const num = (value as any).numerator ?? (value as any).num;
    const den = (value as any).denominator ?? (value as any).den;
    if (typeof num === 'number' && typeof den === 'number' && den !== 0) {
      const out = num / den;
      return Number.isFinite(out) ? out : null;
    }
  }
  return null;
};

const parseExifDms = (value: any): number[] | null => {
  if (Array.isArray(value)) {
    const nums = value.map(parseExifNumber).filter((v) => v !== null) as number[];
    return nums.length >= 3 ? nums.slice(0, 3) : null;
  }
  if (typeof value === 'string' && value.includes(',')) {
    const parts = value.split(',').map((p) => parseExifNumber(p));
    const nums = parts.filter((v) => v !== null) as number[];
    return nums.length >= 3 ? nums.slice(0, 3) : null;
  }
  const single = parseExifNumber(value);
  if (single !== null) return [single, 0, 0];
  return null;
};

const toDecimalDegrees = (dms: number[] | null) => {
  if (!dms || dms.length < 3) return null;
  const [d, m, s] = dms;
  if (![d, m, s].every((v) => Number.isFinite(v))) return null;
  return d + m / 60 + s / 3600;
};

const hasAnyExif = (exif?: ExifData | null) =>
  exif?.lat != null || exif?.lng != null || !!exif?.taken_at;

const parseExifDate = (value: any): string | null => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(
      /^(\d{4}):(\d{2}):(\d{2})/,
      '$1-$2-$3'
    );
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
};

const extractMetaFromAsset = (asset: ImagePicker.ImagePickerAsset): UploadMeta | null => {
  const exif = (asset as any).exif as Record<string, any> | undefined;
  const location = (asset as any).location as { latitude?: number; longitude?: number } | undefined;

  let lat: number | null = null;
  let lng: number | null = null;

  if (exif) {
    const latRef = typeof exif.GPSLatitudeRef === 'string' ? exif.GPSLatitudeRef : null;
    const lngRef = typeof exif.GPSLongitudeRef === 'string' ? exif.GPSLongitudeRef : null;
    const latDms = parseExifDms(exif.GPSLatitude);
    const lngDms = parseExifDms(exif.GPSLongitude);

    const latValue = toDecimalDegrees(latDms);
    const lngValue = toDecimalDegrees(lngDms);

    if (latValue !== null) {
      lat = latRef && latRef.toUpperCase() === 'S' ? -latValue : latValue;
    }
    if (lngValue !== null) {
      lng = lngRef && lngRef.toUpperCase() === 'W' ? -lngValue : lngValue;
    }
  }

  if ((lat === null || lng === null) && location) {
    if (typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      lat = location.latitude;
      lng = location.longitude;
    }
  }

  const takenAt =
    parseExifDate(exif?.DateTimeOriginal) ||
    parseExifDate(exif?.DateTimeDigitized) ||
    parseExifDate(exif?.DateTime) ||
    null;

  if (lat === null && lng === null && !takenAt) return null;

  return {
    lat,
    lng,
    taken_at: takenAt,
  };
};

const mergeMeta = (primary?: UploadMeta | null, secondary?: UploadMeta | null): UploadMeta | null => {
  if (!primary && !secondary) return null;
  const lat = primary?.lat ?? secondary?.lat ?? null;
  const lng = primary?.lng ?? secondary?.lng ?? null;
  const taken_at = primary?.taken_at ?? secondary?.taken_at ?? null;
  if (lat === null && lng === null && !taken_at) return null;
  return { lat, lng, taken_at };
};

const extractMetaFromWebUri = async (uri: string): Promise<UploadMeta | null> => {
  if (!uri) return null;
  try {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const mod = await import('exifr');
    const exifr = (mod as any).default ?? mod;
    const data = await exifr.parse(blob, { gps: true, exif: true, tiff: true, ifd0: true });
    if (!data) return null;

    let lat: number | null = null;
    let lng: number | null = null;

    if (typeof data.latitude === 'number') lat = data.latitude;
    if (typeof data.longitude === 'number') lng = data.longitude;

    if (lat === null || lng === null) {
      const latRef = typeof data.GPSLatitudeRef === 'string' ? data.GPSLatitudeRef : null;
      const lngRef = typeof data.GPSLongitudeRef === 'string' ? data.GPSLongitudeRef : null;
      const latDms = parseExifDms(data.GPSLatitude);
      const lngDms = parseExifDms(data.GPSLongitude);
      const latValue = toDecimalDegrees(latDms);
      const lngValue = toDecimalDegrees(lngDms);
      if (latValue !== null) {
        lat = latRef && latRef.toUpperCase() === 'S' ? -latValue : latValue;
      }
      if (lngValue !== null) {
        lng = lngRef && lngRef.toUpperCase() === 'W' ? -lngValue : lngValue;
      }
    }

    const takenAt =
      parseExifDate(data.DateTimeOriginal) ||
      parseExifDate(data.DateTimeDigitized) ||
      parseExifDate(data.DateTime) ||
      parseExifDate(data.CreateDate) ||
      parseExifDate(data.ModifyDate) ||
      null;

    if (lat === null && lng === null && !takenAt) return null;
    return { lat, lng, taken_at: takenAt };
  } catch {
    return null;
  }
};

const resizeAndCompressAsset = async (
  asset: ImagePicker.ImagePickerAsset,
  rawName: string,
  ext: string
): Promise<UploadAsset> => {
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  const maxSide = Math.max(width, height);
  const shouldResize = maxSide > MAX_IMAGE_DIMENSION;

  const actions: ImageManipulator.Action[] = [];
  if (shouldResize && width > 0 && height > 0) {
    const scale = MAX_IMAGE_DIMENSION / maxSide;
    actions.push({
      resize: {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      },
    });
  }

  const usePng = ext === 'png';
  const format = usePng ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG;
  const outputExt = usePng ? 'png' : 'jpg';
  const outputMime = usePng ? 'image/png' : 'image/jpeg';

  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: JPEG_COMPRESS_QUALITY,
    format,
  });

  return {
    uri: result.uri,
    name: ensureFileNameWithExt(rawName.replace(/\.\w+$/, ''), outputExt),
    type: outputMime,
  };
};

const prepareUploadAsset = async (asset: ImagePicker.ImagePickerAsset): Promise<UploadAsset> => {
  const rawName = getAssetName(asset);
  const ext = getAssetExt(rawName);
  const mimeType = asset.mimeType || (ext ? `image/${ext}` : 'image/jpeg');
  let meta = extractMetaFromAsset(asset);
  if (Platform.OS === 'web') {
    const needsWebMeta =
      !meta || meta.lat === null || meta.lng === null || meta.taken_at === null || meta.taken_at === undefined;
    if (needsWebMeta) {
      const webMeta = await extractMetaFromWebUri(asset.uri);
      meta = mergeMeta(meta, webMeta);
    }
  }

  try {
  const resized = await resizeAndCompressAsset(asset, rawName, ext);
    return { ...resized, meta };
  } catch (error) {
    if (isHeicAsset(asset, ext) && Platform.OS !== 'web') {
      try {
        const result = await ImageManipulator.manipulateAsync(
          asset.uri,
          [],
          { compress: JPEG_COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
        );
        const jpegName = rawName.replace(/\.(heic|heif)$/i, '.jpg');
        return {
          uri: result.uri,
          name: ensureFileNameWithExt(jpegName, 'jpg'),
          type: 'image/jpeg',
          meta,
        };
      } catch {
        // fall through to original
      }
    }
    return {
      uri: asset.uri,
      name: ensureFileNameWithExt(rawName, ext),
      type: mimeType,
      meta,
    };
  }
};

const formatDateInput = (value?: string | null) => {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const toIsoDate = (value: string) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export default function UploadScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { startGlobalLoading, endGlobalLoading } = useSession();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeCategory, setPlaceCategory] = useState('');
  const [placeMemo, setPlaceMemo] = useState('');
  const [placeLat, setPlaceLat] = useState<number | null>(null);
  const [placeLng, setPlaceLng] = useState<number | null>(null);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [visitType, setVisitType] = useState<VisitType>('visited');
  const [visitDateInput, setVisitDateInput] = useState('');
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [limits, setLimits] = useState<UploadLimits>(DEFAULT_LIMITS);
  const [placeCategories, setPlaceCategories] = useState<string[]>(DEFAULT_PLACE_CATEGORIES);
  const [uploadId, setUploadId] = useState<string | null>(null);

  useEffect(() => {
    metaService
      .getOptions()
      .then((opts) => {
        if (opts.place_categories?.length) {
          setPlaceCategories(ensureEtcCategory(opts.place_categories.map((o) => o.label)));
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
        quality: 1,
        exif: true,
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
        const name = getAssetName(asset);
        const ext = getAssetExt(name);
        const allowHeic = isHeicAsset(asset, ext);

        if (ext && !allowedExts.has(ext) && !allowHeic) {
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
          messages.push(`지원하지 않는 확장자: ${invalidExts.slice(0, 3).join(', ')}`);
        }
        if (invalidSizes.length) {
          messages.push(`용량 초과: ${invalidSizes.slice(0, 3).join(', ')}`);
        }
        Toast.show({
          type: 'error',
          text1: '업로드 제한',
          text2: messages.join(' / '),
        });
      }

      if (validAssets.length === 0) {
        return;
      }

      const formData = new FormData();

      // FormData에 이미지 추가
      const preparedAssets = await Promise.all(validAssets.map(prepareUploadAsset));
      for (const asset of preparedAssets) {
        const uri = asset.uri;
        const filename = asset.name || 'image.jpg';
        const type = asset.type || 'image/jpeg';

        if (Platform.OS === 'web') {
          const resp = await fetch(uri);
          const blob = await resp.blob();
          const file = new File([blob], filename, { type });
          formData.append('files', file);
        } else {
          formData.append('files', {
            uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
            name: filename,
            type: type,
          } as any);
        }
      }

      const metaPayload = preparedAssets.map((asset) => asset.meta ?? null);
      formData.append('metas', JSON.stringify(metaPayload));

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
      const newPhotos: PhotoData[] = response.photos.map((photo) => {
        const defaultVisitType: VisitType = hasAnyExif(photo.exif) ? 'visited' : 'planned';
        return {
          ...photo,
          thumbnail_url: resolveStorageUrl(photo.thumbnail_url),
          visit_type: defaultVisitType,
          visit_date: defaultVisitType === 'visited' ? photo.exif?.taken_at ?? null : null,
        };
      });

      setUploadId(response.upload_id);
      setPhotos(newPhotos);

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

  const handleRegisterSpots = async () => {
    if (!uploadId || photos.length === 0) {
      Toast.show({
        type: 'info',
        text1: '등록할 사진 없음',
        text2: '먼저 사진을 업로드해주세요.',
      });
      return;
    }

    if (photos.some((p) => p.status !== 'recognized' || !p.place)) {
      Toast.show({
        type: 'error',
        text1: '장소 입력 필요',
        text2: '모든 사진의 장소 입력을 완료해주세요.',
      });
      return;
    }

    const missingVisitDate = photos.some(
      (p) => !p.exif?.taken_at && p.visit_type !== 'planned' && !p.visit_date
    );
    if (missingVisitDate) {
      Toast.show({
        type: 'error',
        text1: '방문 날짜 필요',
        text2: '방문한 사진의 날짜를 입력해주세요.',
      });
      return;
    }

    const spots = photos.map((photo) => {
      const memo = photo.memo?.trim();
      const visitedAt = photo.exif?.taken_at
        ? photo.exif.taken_at
        : photo.visit_type === 'planned'
          ? null
          : photo.visit_date || null;
      return {
        photo_id: photo.photo_id,
        visited_at: visitedAt,
        place: {
          name: photo.place!.name,
          address: photo.place!.address || null,
          category: photo.place!.category || '기타',
          lat: photo.place!.lat,
          lng: photo.place!.lng,
        },
        memo: memo || null,
      };
    });

    setIsRegistering(true);
    startGlobalLoading();
    try {
      await recordService.createSpotsFromUpload({
        upload_id: uploadId,
        spots,
      });

      Toast.show({
        type: 'success',
        text1: '장소 등록 완료',
        text2: '기록 탭에서 확인할 수 있습니다.',
      });

      setPhotos([]);
      setUploadId(null);
      router.replace('/records');
    } catch (error: any) {
      console.error('장소 등록 실패:', error);
      Toast.show({
        type: 'error',
        text1: '등록 실패',
        text2: error.message || '장소 등록 중 오류가 발생했습니다.',
      });
    } finally {
      setIsRegistering(false);
      endGlobalLoading();
    }
  };

  const openPlaceModal = (photoId: string) => {
    const photo = photos.find((p) => p.photo_id === photoId);
    if (photo) {
      setEditingPhotoId(photoId);
      setPlaceName(photo.place?.name || '');
      setPlaceAddress(photo.place?.address || '');
      setPlaceCategory(photo.place?.category || '');
      setPlaceMemo(photo.memo || '');
      setPlaceLat(photo.place?.lat ?? photo.exif?.lat ?? null);
      setPlaceLng(photo.place?.lng ?? photo.exif?.lng ?? null);
      setIsGeocodingAddress(false);
      setIsReverseGeocoding(false);
      const defaultVisitType: VisitType =
        photo.visit_type ?? (hasAnyExif(photo.exif) ? 'visited' : 'planned');
      setVisitType(defaultVisitType);
      const initialVisitDate =
        defaultVisitType === 'planned' ? null : photo.visit_date || photo.exif?.taken_at || null;
      setVisitDateInput(formatDateInput(initialVisitDate));
      setModalVisible(true);
    }
  };

  const handleVisitTypeChange = (next: VisitType) => {
    setVisitType(next);
    if (next === 'planned') {
      setVisitDateInput('');
    }
  };

  const handleSavePlace = async () => {
    if (!editingPhotoId || !placeName) {
      return;
    }

    const target = photos.find((p) => p.photo_id === editingPhotoId);
    if (!target) return;
    const allowMemo = visitType === 'visited';
    const lat = placeLat ?? target?.exif?.lat ?? null;
    const lng = placeLng ?? target?.exif?.lng ?? null;
    const memoValue = allowMemo ? placeMemo.trim() : '';
    const hasExifTakenAt = !!target?.exif?.taken_at;
    const visitTypeForSave: VisitType = visitType;
    const showVisitDateInput = visitTypeForSave === 'visited';
    let visitDateIso: string | null = target?.exif?.taken_at ?? null;

    if (showVisitDateInput) {
      const iso = toIsoDate(visitDateInput);
      if (iso) {
        visitDateIso = iso;
      } else if (!hasExifTakenAt) {
        Toast.show({
          type: 'error',
          text1: '방문 날짜 필요',
          text2: '방문한 날짜를 입력해주세요.',
        });
        return;
      }
    } else if (visitTypeForSave === 'planned') {
      visitDateIso = null;
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
                memo: memoValue ? memoValue : null,
                visit_type: visitTypeForSave,
                visit_date: visitDateIso,
                thumbnail_url: resolveStorageUrl(response.thumbnail_url) ?? photo.thumbnail_url,
              }
            : photo
        )
      );

      setModalVisible(false);
      setEditingPhotoId(null);
      setPlaceName('');
      setPlaceAddress('');
      setPlaceCategory('');
      setPlaceMemo('');
      setPlaceLat(null);
      setPlaceLng(null);
      setVisitType('visited');
      setVisitDateInput('');

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

  const reverseGeocodeWeb = async (lat: number, lng: number): Promise<string | null> => {
    const kakao = (globalThis as any).kakao;
    if (!kakao?.maps?.services) return null;
    return await new Promise((resolve) => {
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result: any[], status: any) => {
        if (status === kakao.maps.services.Status.OK && result?.[0]) {
          const road = result[0].road_address?.address_name;
          const jibun = result[0].address?.address_name;
          resolve(road || jibun || null);
        } else {
          resolve(null);
        }
      });
    });
  };

  const geocodeWeb = async (query: string): Promise<{ lat: number; lng: number; address?: string | null; road_address?: string | null } | null> => {
    const kakao = (globalThis as any).kakao;
    if (!kakao?.maps?.services) return null;

    const geocoder = new kakao.maps.services.Geocoder();
    const addressResult = await new Promise<any | null>((resolve) => {
      geocoder.addressSearch(query, (result: any[], status: any) => {
        if (status === kakao.maps.services.Status.OK && result?.[0]) {
          resolve(result[0]);
        } else {
          resolve(null);
        }
      });
    });

    if (addressResult) {
      return {
        lat: parseFloat(addressResult.y),
        lng: parseFloat(addressResult.x),
        address: addressResult.address_name,
        road_address: addressResult.road_address_name,
      };
    }

    const places = new kakao.maps.services.Places();
    const placeResult = await new Promise<any | null>((resolve) => {
      places.keywordSearch(query, (data: any[], status: any) => {
        if (status === kakao.maps.services.Status.OK && data?.[0]) {
          resolve(data[0]);
        } else {
          resolve(null);
        }
      });
    });

    if (!placeResult) return null;
    return {
      lat: parseFloat(placeResult.y),
      lng: parseFloat(placeResult.x),
      address: placeResult.address_name,
      road_address: placeResult.road_address_name,
    };
  };

  const handleSelectLocation = async (lat: number, lng: number) => {
    setPlaceLat(lat);
    setPlaceLng(lng);
    setIsReverseGeocoding(true);
    try {
      let addr: string | null = null;
      if (Platform.OS === 'web') {
        addr = await reverseGeocodeWeb(lat, lng);
      }
      if (!addr) {
        const res = await utilsService.reverseGeocode(lat, lng);
        addr = res.road_address ?? res.address ?? '';
      }
      if (addr) {
        setPlaceAddress(addr);
      } else {
        setPlaceAddress('');
        Toast.show({
          type: 'info',
          text1: '주소 없음',
          text2: '선택한 위치의 주소를 찾을 수 없습니다.',
        });
      }
    } catch (error: any) {
      console.error('역지오코딩 실패:', error);
      Toast.show({
        type: 'error',
        text1: '주소 조회 실패',
        text2: error.message || '주소를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handleGeocodeAddress = async () => {
    const query = (placeAddress || placeName).trim();
    if (!query) {
      Toast.show({
        type: 'info',
        text1: '주소 입력 필요',
        text2: '주소나 장소명을 입력해주세요.',
      });
      return;
    }

    setIsGeocodingAddress(true);
    try {
      let res: { lat: number | null; lng: number | null; address?: string | null; road_address?: string | null } | null =
        null;
      if (Platform.OS === 'web') {
        res = await geocodeWeb(query);
      }
      if (!res) {
        res = await utilsService.geocode(query);
      }

      const addr = res.road_address ?? res.address ?? '';
      if (addr) {
        setPlaceAddress(addr);
      }
      if (res.lat != null && res.lng != null) {
        setPlaceLat(res.lat);
        setPlaceLng(res.lng);
      } else {
        Toast.show({
          type: 'info',
          text1: '위치 없음',
          text2: '입력한 주소로 좌표를 찾지 못했습니다.',
        });
      }
    } catch (error: any) {
      console.error('지오코딩 실패:', error);
      Toast.show({
        type: 'error',
        text1: '주소 검색 실패',
        text2: error.message || '주소를 찾는 중 오류가 발생했습니다.',
      });
    } finally {
      setIsGeocodingAddress(false);
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

  const hasIncompletePlaces = photos.some((p) => p.status !== 'recognized' || !p.place);
  const canRegister = !!uploadId && photos.length > 0 && !hasIncompletePlaces && !isUploading && !isRegistering;
  const editingPhoto = editingPhotoId ? photos.find((p) => p.photo_id === editingPhotoId) : null;
  const allowMemo = visitType === 'visited';
  const hasExifTakenAt = !!editingPhoto?.exif?.taken_at;
  const showVisitType = !!editingPhoto;
  const showVisitDateInput = showVisitType && visitType === 'visited';
  const needsVisitDate = showVisitDateInput && !visitDateInput && !hasExifTakenAt;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FullScreenLoader visible={isUploading} message="사진을 업로드하는 중..." />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#64748b" />
        </Pressable>
        <Pressable style={styles.headerContent} onPress={() => router.push('/')}>
          <LinearGradient colors={['#6366f1', '#38bdf8']} style={styles.logo}>
            <Text style={styles.logoText}>O</Text>
          </LinearGradient>
          <Text style={styles.headerTitle}>OpenTripPlanner</Text>
        </Pressable>
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
            최대 {limits.max_photos}장 · {limits.max_file_size_mb}MB · {limits.allowed_exts.join(' / ').toUpperCase()}
          </Text>
        </LinearGradient>
      </View>

      {/* 업로드된 사진 리스트 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>업로드된 사진 ({photos.length})</Text>
          <Text style={styles.sectionSubtitle}>선택한 장소로 기록 생성</Text>
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
                    <Pressable onPress={() => openPlaceModal(photo.photo_id)}>
                      <Text style={styles.photoLink}>
                        {photo.visit_type === 'visited'
                          ? (photo.memo ? '메모/장소 수정' : '메모 추가/장소 수정')
                          : '장소 수정'}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {photo.exif ? (
                      <>
                        {photo.exif.lat != null && photo.exif.lng != null && (
                          <Text style={styles.photoDetail}>
                            EXIF 위치 정보: {photo.exif.lat.toFixed(6)}, {photo.exif.lng.toFixed(6)}
                          </Text>
                        )}
                        {photo.exif.taken_at && (
                          <Text style={styles.photoDetail}>
                            촬영 시간: {formatDateTime(photo.exif.taken_at)}
                          </Text>
                        )}
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
            !canRegister && styles.actionButtonDisabled
          ]}
          onPress={handleRegisterSpots}
          disabled={!canRegister}>
          <LinearGradient
            colors={canRegister
              ? ['#6366f1', '#38bdf8'] 
              : ['#cbd5e1', '#cbd5e1']}
            style={styles.actionButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}>
            <View style={styles.actionButtonContent}>
              <View style={styles.actionButtonTextWrapper}>
                <Text style={styles.actionButtonPrimaryText}>장소 등록하기</Text>
                {photos.length > 0 && (
                  <View style={styles.actionButtonBadge}>
                    <Text style={styles.actionButtonBadgeText}>
                      {photos.length}개
                    </Text>
                  </View>
                )}
              </View>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            </View>
          </LinearGradient>
        </Pressable>
        
        <Pressable style={styles.actionButton} onPress={() => router.push('/records')}>
          <Text style={styles.actionButtonText}>내 기록 보기</Text>
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
              setPlaceMemo('');
              setPlaceLat(null);
              setPlaceLng(null);
              setIsGeocodingAddress(false);
              setIsReverseGeocoding(false);
              setVisitType('visited');
              setVisitDateInput('');
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>장소 정보 입력</Text>
              <Pressable
                onPress={() => {
                  setModalVisible(false);
                  setEditingPhotoId(null);
                  setPlaceName('');
                  setPlaceAddress('');
                  setPlaceCategory('');
                  setPlaceMemo('');
                  setPlaceLat(null);
                  setPlaceLng(null);
                  setIsGeocodingAddress(false);
                  setIsReverseGeocoding(false);
                  setVisitType('visited');
                  setVisitDateInput('');
                }}
                style={styles.modalCloseButton}>
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
                  placeholder="예) 망원동 카페 라떼"
                  placeholderTextColor="#94a3b8"
                  value={placeName}
                  onChangeText={setPlaceName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>주소</Text>
                <View style={styles.addressRow}>
                  <TextInput
                    style={[styles.input, styles.addressInput]}
                    placeholder="예) 서울 마포구 독막로 12"
                    placeholderTextColor="#94a3b8"
                    value={placeAddress}
                    onChangeText={setPlaceAddress}
                  />
                  <Pressable
                    style={[
                      styles.addressSearchButton,
                      (isGeocodingAddress || !(placeAddress || placeName).trim()) && styles.addressSearchButtonDisabled,
                    ]}
                    onPress={handleGeocodeAddress}
                    disabled={isGeocodingAddress || !(placeAddress || placeName).trim()}>
                    {isGeocodingAddress ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.addressSearchButtonText}>지도 이동</Text>
                    )}
                  </Pressable>
                </View>
                <Text style={styles.inputHint}>주소나 장소명을 입력하고 지도 이동을 눌러주세요.</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>지도에서 위치 선택</Text>
                <View style={styles.mapBox}>
                  <PlacePickerMap lat={placeLat} lng={placeLng} onSelect={handleSelectLocation} />
                  {isReverseGeocoding && (
                    <View style={styles.mapOverlay}>
                      <ActivityIndicator size="small" color="#64748b" />
                      <Text style={styles.mapOverlayText}>주소 찾는 중...</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.mapHint}>지도를 눌러 위치를 선택하면 주소가 자동 입력됩니다.</Text>
              </View>

              {showVisitType && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>방문 여부</Text>
                  <View style={styles.visitTypeRow}>
                    <Pressable
                      style={[
                        styles.visitTypeButton,
                        visitType === 'visited' && styles.visitTypeButtonActive,
                      ]}
                      onPress={() => handleVisitTypeChange('visited')}>
                      <Text
                        style={[
                          styles.visitTypeButtonText,
                          visitType === 'visited' && styles.visitTypeButtonTextActive,
                        ]}>
                        방문함
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.visitTypeButton,
                        visitType === 'planned' && styles.visitTypeButtonActive,
                      ]}
                      onPress={() => handleVisitTypeChange('planned')}>
                      <Text
                        style={[
                          styles.visitTypeButtonText,
                          visitType === 'planned' && styles.visitTypeButtonTextActive,
                        ]}>
                        방문 예정
                      </Text>
                    </Pressable>
                  </View>
                  {showVisitDateInput && (
                    <View style={styles.visitDateBlock}>
                      <Text style={styles.inputLabel}>방문 날짜 *</Text>
                      {Platform.OS === 'web' ? (
                        <WebDateInput
                          value={visitDateInput}
                          onChange={setVisitDateInput}
                          hasError={needsVisitDate}
                        />
                      ) : (
                        <TextInput
                          style={[styles.input, needsVisitDate && styles.inputError]}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor="#94a3b8"
                          value={visitDateInput}
                          onChangeText={setVisitDateInput}
                        />
                      )}
                      <Text style={styles.inputHint}>방문한 날짜를 입력해주세요.</Text>
                    </View>
                  )}
                </View>
              )}

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

              {allowMemo && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>메모</Text>
                  <TextInput
                    style={[styles.input, styles.memoInput]}
                    placeholder="장소에 대한 메모를 남겨주세요"
                    placeholderTextColor="#94a3b8"
                    value={placeMemo}
                    onChangeText={setPlaceMemo}
                    multiline
                    textAlignVertical="top"
                    maxLength={2000}
                  />
                  <Text style={styles.memoHint}>최대 2000자</Text>
                </View>
              )}
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
                  setPlaceMemo('');
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
  inputHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#94a3b8',
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
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  visitTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  visitTypeButton: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  visitTypeButtonActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  visitTypeButtonText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  visitTypeButtonTextActive: {
    color: '#4f46e5',
  },
  visitDateBlock: {
    marginTop: 12,
    gap: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressInput: {
    flex: 1,
  },
  addressSearchButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  addressSearchButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  addressSearchButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  mapBox: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  mapHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#94a3b8',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mapOverlayText: {
    fontSize: 12,
    color: '#64748b',
  },
  memoInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  memoHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#94a3b8',
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

