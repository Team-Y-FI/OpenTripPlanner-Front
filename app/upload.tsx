import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlaces } from '@/contexts/PlacesContext';

const { width } = Dimensions.get('window');

interface PhotoData {
  id: string;
  filename: string;
  placeName: string;
  placeAddress: string;
  category: string;
  timestamp: string;
  status: 'auto' | 'manual' | 'none';
  selected: boolean;
}

export default function UploadScreen() {
  const router = useRouter();
  const { setSelectedPlaces } = usePlaces();
  const [modalVisible, setModalVisible] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeCategory, setPlaceCategory] = useState('');
  
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };
  
  const [photos, setPhotos] = useState<PhotoData[]>([
    {
      id: '1',
      filename: 'IMG_3271.JPG',
      placeName: '마들렌 카페 홍대점',
      placeAddress: '홍대입구역 인근 카페 거리',
      category: '카페',
      timestamp: '2024.05.03 15:12',
      status: 'auto',
      selected: false,
    },
    {
      id: '2',
      filename: 'IMG_3273.JPG',
      placeName: '',
      placeAddress: '',
      category: '',
      timestamp: '2024.05.03 16:30',
      status: 'none',
      selected: false,
    },
  ]);

  const togglePhotoSelection = (id: string) => {
    setPhotos(prev => prev.map(photo => 
      photo.id === id ? { ...photo, selected: !photo.selected } : photo
    ));
  };

  const handleCreateCourse = () => {
    const selected = photos
      .filter(photo => photo.selected && photo.placeName)
      .map(photo => ({
        id: photo.id,
        filename: photo.filename,
        placeName: photo.placeName,
        placeAddress: photo.placeAddress,
        category: photo.category,
        timestamp: photo.timestamp,
      }));
    
    setSelectedPlaces(selected);
    router.push('/course');
  };

  const handleSavePlace = () => {
    // 여기서 장소 정보를 저장하는 로직 추가
    console.log('저장:', { placeName, placeAddress, placeCategory });
    setModalVisible(false);
    // 입력 필드 초기화
    setPlaceName('');
    setPlaceAddress('');
    setPlaceCategory('');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#64748b" />
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
          <Pressable style={styles.uploadButton}>
            <Text style={styles.uploadButtonText}>파일 선택</Text>
          </Pressable>
          <Text style={styles.uploadNote}>최대 20장 · JPEG / PNG · EXIF 위치 정보 자동 분석</Text>
        </LinearGradient>
      </View>

      {/* 업로드된 사진 리스트 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>업로드된 사진 ({photos.length})</Text>
          <Text style={styles.sectionSubtitle}>선택한 장소로 코스 생성</Text>
        </View>

        {photos.map((photo) => (
          <View 
            key={photo.id}
            style={[
              styles.photoCard,
              photo.status === 'auto' && styles.photoCardSuccess,
              photo.status === 'none' && styles.photoCardGray,
            ]}>
            <Pressable 
              style={styles.checkbox}
              onPress={() => togglePhotoSelection(photo.id)}
              disabled={!photo.placeName}>
              <View style={[
                styles.checkboxBox,
                photo.selected && styles.checkboxBoxChecked,
                !photo.placeName && styles.checkboxBoxDisabled,
              ]}>
                {photo.selected && (
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                )}
              </View>
            </Pressable>
            
            <View style={styles.photoThumbnail}>
              <LinearGradient colors={['#cbd5e1', '#94a3b8']} style={styles.photoThumbnailBg}>
                <Text style={styles.photoThumbnailText}>사진</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.photoInfo}>
              <View style={styles.photoHeader}>
                <Text style={styles.photoName} numberOfLines={1} ellipsizeMode="middle">
                  {photo.filename}
                </Text>
                {photo.status === 'auto' && (
                  <View style={styles.photoBadgeSuccess}>
                    <Text style={styles.photoBadgeSuccessText}>위치 자동 인식</Text>
                  </View>
                )}
                {photo.status === 'none' && (
                  <View style={styles.photoBadgeGray}>
                    <Text style={styles.photoBadgeGrayText}>위치 정보 없음</Text>
                  </View>
                )}
              </View>
              
              {photo.placeName ? (
                <>
                  <Text style={styles.photoDetail}>
                    {photo.placeAddress} · {photo.timestamp}
                  </Text>
                  <Text style={styles.photoPlace}>인식된 장소: {photo.placeName}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.photoDetail}>이 사진은 어디에서 찍으셨나요? 한 번만 여쭤볼게요.</Text>
                  <Pressable onPress={() => setModalVisible(true)}>
                    <Text style={styles.photoLink}>직접 장소 입력하기</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ))}
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
            onPress={() => setModalVisible(false)}
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
                  {['카페', '음식점', '전시', '공원', '쇼핑', '기타'].map((category) => (
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
                onPress={() => setModalVisible(false)}>
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
  photoThumbnailText: {
    fontSize: 12,
    color: '#ffffff',
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
