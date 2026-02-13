# OpenTripPlanner - 여행 플래너 앱

React Native + Expo 기반의 사진 업로드 및 AI 코스 생성 여행 플래너 앱입니다.
사진을 업로드하면 EXIF 위치 정보를 기반으로 장소를 인식하고, 조건에 맞는 최적 여행 코스를 자동 생성합니다.

## 주요 기능

### 인증
- 이메일/비밀번호 로그인 및 회원가입
- 이메일 인증 코드 기반 본인 확인
- 카카오 OAuth 소셜 로그인
- Access Token + Refresh Token 기반 세션 관리 (자동 갱신)

### 여행 코스 생성
- 여행 조건 입력: 지역, 날짜/시간, 예산, 이동수단, 카테고리
- 혼잡도 선호 설정 (한적한 곳 / 기본 / 인기 장소)
- 고정 일정(식사, 미팅 등) 추가 및 카카오맵 장소 검색
- 드래그 앤 드롭으로 장소 순서 변경
- AI 기반 최적 코스 생성 (최단 경로 / 최소 환승 등 다중 경로)
- 구간별 혼잡도 및 교통 정보 시각화

### 사진 기반 장소 등록
- 사진 업로드 시 EXIF GPS 데이터 자동 추출
- 역지오코딩으로 주소 자동 변환
- 위치 정보 없는 사진은 수동 장소 입력 지원
- HEIC → JPEG 자동 변환

### 개인 기록 관리
- 방문 스팟 저장 (사진, 메모, 태그, 위치)
- 생성된 여행 플랜 저장 및 조회
- 스팟 상세 보기 (카카오맵 연동)
- 스팟 삭제 및 일괄 선택

## 기술 스택

| 분류 | 기술 |
|------|------|
| **프레임워크** | React Native 0.81 + Expo 54 |
| **언어** | TypeScript 5.9 (Strict) |
| **라우팅** | Expo Router 6 (파일 기반) |
| **상태 관리** | React Context API (Auth, Session, Places, Network) |
| **지도** | Kakao Maps JavaScript SDK (Web), react-native-maps (Native) |
| **인증** | expo-auth-session, @react-native-seoul/kakao-login |
| **드래그 앤 드롭** | @dnd-kit (Web), react-native-draggable-flatlist (Native) |
| **이미지** | expo-image-picker, expo-image-manipulator, expo-image |
| **애니메이션** | react-native-reanimated 4.1 |
| **알림** | react-native-toast-message |
| **로컬 저장소** | AsyncStorage |
| **UI** | React Native StyleSheet, expo-linear-gradient, Ionicons |

## 프로젝트 구조

```
openTripPlanner-project/
├── app/                            # Expo Router 페이지 (파일 기반 라우팅)
│   ├── _layout.tsx                 # 루트 레이아웃 (Provider 래핑)
│   ├── index.tsx                   # 스플래시 / 인증 체크 → 리다이렉트
│   ├── login.tsx                   # 로그인 (이메일 + 카카오)
│   ├── signup.tsx                  # 회원가입 (이메일 인증)
│   ├── kakao-callback.tsx          # 카카오 OAuth 콜백 핸들러
│   ├── course.tsx                  # 코스 생성 화면 진입점
│   ├── upload.tsx                  # 사진 업로드 & 장소 등록
│   ├── record.tsx                  # 스팟 상세 보기
│   ├── records.tsx                 # 내 기록 (스팟 / 저장된 플랜)
│   └── (tabs)/                     # 탭 네비게이션 그룹
│       ├── _layout.tsx             # 하단 탭 바 (홈, 결과)
│       ├── index.tsx               # 홈 (대시보드)
│       └── results.tsx             # 코스 추천 결과
├── screens/                        # 화면 컴포넌트 (플랫폼별 분리)
│   ├── CourseScreen.tsx            # 코스 생성 폼 (Web)
│   ├── CourseScreen.native.tsx     # 코스 생성 폼 (Native)
│   ├── ResultsScreen.tsx           # 코스 결과 표시 (Web)
│   └── ResultsScreen.native.tsx    # 코스 결과 표시 (Native)
├── components/                     # 재사용 UI 컴포넌트
│   ├── ConfirmModal.tsx            # 확인/경고/위험 다이얼로그
│   ├── FullScreenLoader.tsx        # 전체 화면 로딩 오버레이
│   ├── CourseGenerationListener.tsx # 코스 생성 완료 이벤트 리스너
│   ├── LoadingSpinner.tsx          # 소형 로딩 스피너
│   ├── SpotMap.tsx                 # 카카오맵 통합 (Web)
│   └── SpotMap.native.tsx          # 네이티브 맵 (Native)
├── contexts/                       # React Context 상태 관리
│   ├── AuthContext.tsx             # 인증 (로그인, 회원가입, 토큰 관리)
│   ├── SessionContext.tsx          # 앱 세션 (로딩, 에러)
│   ├── PlacesContext.tsx           # 장소 & 코스 생성 상태
│   └── NetworkContext.tsx          # 네트워크 연결 상태
├── services/                       # API 서비스 레이어
│   ├── api.ts                     # HTTP 클라이언트 (토큰 주입, 401 자동 갱신)
│   ├── authService.ts             # 인증 API
│   ├── planService.ts             # 코스/플랜 API
│   ├── recordService.ts           # 스팟/기록 API
│   ├── metaService.ts             # 메타 옵션 API
│   ├── utilsService.ts            # 유틸리티 API (역지오코딩)
│   └── index.ts                   # 서비스 통합 export
├── constants/                      # 상수 및 설정
├── hooks/                          # 커스텀 훅
├── assets/                         # 이미지, 아이콘, 폰트
├── app.json                        # Expo 설정
├── tsconfig.json                   # TypeScript 설정
├── .env                            # 환경 변수
└── package.json                    # 의존성 및 스크립트
```

## 화면 구성

### 1. 스플래시 (`/`)
인증 상태를 확인하여 로그인 페이지 또는 홈으로 자동 리다이렉트합니다.

### 2. 로그인 (`/login`)
- 이메일/비밀번호 로그인
- 카카오 소셜 로그인
- 회원가입 페이지 이동

### 3. 회원가입 (`/signup`)
- 이메일 인증 코드 전송 및 확인
- 닉네임, 비밀번호 설정

### 4. 홈 (`/(tabs)`)
- 최근 생성 플랜 / 스팟 요약 카드
- 새 플랜 만들기 → 코스 조건 입력으로 이동
- 사진으로 기록 → 사진 업로드로 이동
- 내 기록 보기 → 기록 목록으로 이동

### 5. 코스 조건 입력 (`/course`)
- 여행 기본 정보 입력 (지역, 날짜, 시간, 예산)
- 이동수단 및 카테고리 선택
- 혼잡도 선호 설정
- 고정 일정 추가 (시간, 장소 지정 - 카카오맵 검색 연동)
- 장소 드래그 앤 드롭 순서 변경
- 코스 생성 요청

### 6. 추천 결과 (`/(tabs)/results`)
- 생성된 여행 플랜 타임라인 표시
- 최단 경로 / 최소 환승 등 다중 경로 옵션
- 구간별 혼잡도 (원활/다소 혼잡/매우 혼잡) 표시
- 교통 정보 및 경고 표시
- 플랜 저장 기능

### 7. 사진 업로드 (`/upload`)
- 사진 선택 및 업로드 (다중 선택)
- EXIF GPS 기반 자동 위치 인식
- 위치 정보 없는 사진 수동 장소 입력
- 장소 확정 후 스팟 등록

### 8. 스팟 상세 (`/record`)
- 스팟 정보 (사진, 이름, 주소, 날짜)
- 메모 작성 및 수정
- 카카오맵 위치 표시
- 관련 여행 플랜 목록

### 9. 내 기록 (`/records`)
- 탭 전환: 스팟 목록 / 저장된 플랜 목록
- 스팟 일괄 선택 및 삭제
- 플랜 상세 보기

## 네비게이션 플로우

```
/ (스플래시)
├── /login ← 미인증 시
│   └── /signup
│       └── /login (가입 완료 후)
└── /(tabs) ← 인증 완료 시
    ├── index (홈)
    │   ├── → /course → /(tabs)/results
    │   ├── → /upload → /record
    │   └── → /records
    └── results (추천 결과)
```

## 상태 관리 구조

```
NetworkContext          ← 네트워크 연결 상태 감시
  └── AuthContext       ← 인증, 토큰 관리, 로그인/로그아웃
      └── SessionContext  ← 전역 로딩 카운터, 에러 상태
          └── PlacesContext  ← 선택된 장소, 코스 생성 상태, 폼 데이터
```

각 Context는 커스텀 훅으로 접근합니다:
- `useAuth()` - 인증 상태 및 액션
- `useSession()` - 로딩/에러 상태
- `usePlaces()` - 장소 및 코스 데이터
- `useNetwork()` - 네트워크 상태

## API 연동

백엔드 서버와 REST API로 통신하며, 주요 엔드포인트는 다음과 같습니다:

| 영역 | 메서드 | 엔드포인트 | 설명 |
|------|--------|-----------|------|
| **인증** | POST | `/auth/login` | 이메일 로그인 |
| | POST | `/auth/register` | 회원가입 |
| | POST | `/auth/send-verification` | 이메일 인증 코드 전송 |
| | POST | `/auth/verify-code` | 인증 코드 확인 |
| | GET | `/auth/kakao/callback` | 카카오 OAuth 콜백 |
| | POST | `/auth/refresh` | 토큰 갱신 |
| | POST | `/auth/logout` | 로그아웃 |
| **플랜** | POST | `/plans/generate` | 코스 생성 요청 |
| | GET | `/plans/{id}` | 플랜 상세 조회 |
| **기록** | POST | `/records/plans` | 플랜 저장 |
| | GET | `/records/plans` | 저장된 플랜 목록 |
| | POST | `/records/spots` | 스팟 생성 |
| | GET | `/records/spots` | 스팟 목록 |
| | PATCH | `/records/spots/{id}` | 스팟 수정 (메모) |
| | DELETE | `/records/spots/{id}` | 스팟 삭제 |
| **업로드** | POST | `/uploads/photos` | 사진 업로드 |
| **메타** | GET | `/meta/options` | 옵션 목록 조회 |
| **유틸** | POST | `/utils/reverse-geocode` | 역지오코딩 |

## 설치 및 실행

### 필요 조건
- Node.js 18 이상
- npm 또는 yarn
- Expo CLI (`npx expo`)

### 환경 변수 설정

`.env` 파일을 프로젝트 루트에 생성합니다:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000/otp
EXPO_PUBLIC_KAKAO_MAPS_KEY=your_kakao_maps_api_key
```

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm start

# 플랫폼별 실행
npm run web        # 웹 브라우저
npm run android    # Android 에뮬레이터
npm run ios        # iOS 시뮬레이터
```

## 플랫폼 대응

Web과 Native 환경에서 다르게 동작하는 컴포넌트는 파일 확장자로 분리합니다:

| 컴포넌트 | Web (`.tsx`) | Native (`.native.tsx`) |
|----------|-------------|----------------------|
| CourseScreen | @dnd-kit 드래그 앤 드롭 | react-native-draggable-flatlist |
| ResultsScreen | HTML 기반 타임라인 | React Native 컴포넌트 |
| SpotMap | Kakao Maps JS SDK | react-native-maps |

## 라이선스

MIT
