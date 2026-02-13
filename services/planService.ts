import { api } from "./api";

/**
 * 코스 생성 관련 타입 정의
 */

// 고정 일정 이벤트 타입
export interface FixedEvent {
  id?: string; // 좌표 기반 ID
  date: string; // "2026-02-07"
  title: string; // "점심 식사"
  start_time: string; // "12:00"
  end_time: string; // "14:00"
  place_name?: string; // "맛집 이름"
  address?: string; // "서울특별시 종로구..."
  lat?: number; // 위도
  lng?: number; // 경도
}

// 코스 생성 요청 타입
// 선택된 장소 (개인 기록에서 선택)
export interface SelectedPlace {
  id?: string;
  name: string;
  address: string;
  category: string;
  lat?: number;
  lng?: number;
}

export interface CreateCourseRequest {
  region: string; // "종로구"
  start_date: string; // "2026-02-07"
  end_date: string; // "2026-02-08"
  first_day_start_time: string; // "14:00"
  last_day_end_time: string; // "18:00"
  fixed_events: FixedEvent[]; // 고정 일정 배열
  transport_mode: "walkAndPublic" | "car"; // 이동수단
  category: "attraction" | "culture" | "shopping" | "restaurant" | "cafe";
  categories?: string[];
  purposes?: string[];
  selected_places?: SelectedPlace[]; // 개인 기록에서 선택한 장소
}

// 장소 정보 타입
export interface Place {
  id?: string;
  name: string;
  category: string;
  category2: string;
  lat: number;
  lng: number;
}

// 타임라인 항목 타입
export interface TimelineItem {
  name: string;
  category: string;
  category2: string;
  time: string; // "14:00 - 15:00"
  transit_to_here: string[]; // 이동 경로 정보 배열
  congestion_level: string; // "🟢여유", "🟡보통(+14분)" 등
}

// 하루 일정 타입
export interface DayPlan {
  route: Place[]; // 방문 장소 리스트
  restaurants: Place[]; // 음식점 리스트
  accommodations: Place[]; // 숙박시설 리스트
  timelines: {
    fastest_version: TimelineItem[]; // 최단 시간 버전
    min_transfer_version: TimelineItem[]; // 최소 환승 버전
  };
}

// 코스 생성 응답 타입
export interface CreateCourseResponse {
  plan_id: string;
  summary: {
    region: string;
    start_date: string;
    end_date: string;
    transport: string;
    crowd_mode: string;
  };
  variants: {
    [key: string]: DayPlan; // "day1", "day2" 등
  };
}

// 코스 조회 응답 타입 (CreateCourseResponse와 동일)
export type GetCourseResponse = CreateCourseResponse;

// 저장된 플랜 생성 요청 타입
export interface SavePlanRequest {
  plan_id: string;
  title?: string | null;
}

// 저장된 플랜 생성 응답 타입
export interface SavePlanResponse {
  saved_plan_id: string;
}

// 저장된 플랜 목록 조회 응답 타입
export interface SavedPlanListItem {
  saved_plan_id: string;
  title: string | null;
  region: string;
  date: string;
  variants_summary?: {
    A?: string | null;
    B?: string | null;
  };
}

export interface GetSavedPlansResponse {
  items: SavedPlanListItem[];
  next_cursor: string | null;
}

// 저장된 플랜 상세 조회 응답 타입
export interface SavedPlanDetailResponse {
  saved_plan_id: string;
  plan_id: string;
  title: string | null;
  region: string;
  date: string;
  summary: {
    region: string;
    duration_hours: number;
    transport: string;
    crowd_mode: string;
  };
  variants: {
    [key: string]: DayPlan;
  };
}

// 대체 장소 추천 요청 타입
export interface ReplaceSpotsRequest {
  plan_id: string;
  day: string; // "day1", "day2" 등
  spot_names: string[]; // 대체하고 싶은 장소 이름들
  region?: string | null;
  categories?: string[] | null;
}

// 대체 장소 타입
export interface AlternativeSpot {
  id?: string;
  name: string;
  category: string;
  category2?: string | null;
  lat: number;
  lng: number;
  reason?: string | null;
}

// 대체 장소 추천 응답 타입
export interface ReplaceSpotsResponse {
  alternatives: AlternativeSpot[];
}

// 경로 재계산 요청용 장소 노드 타입
export interface PlaceNode {
  id?: string;
  name: string;
  category: string;
  category2?: string;
  lat: number;
  lng: number;
  addr?: string;
  type: string; // 추가
  stay: number; // 추가
  window?: number[] | null; // 추가
  orig_time_str?: string | null;
}

export interface RecalculateRouteRequest {
  day_key: string;
  remaining_places: PlaceNode[];
}

export interface RecalculateRouteResponse {
  plan_id: string;
  updated_day: string;
  route: Place[];
  timelines: {
    fastest_version: TimelineItem[];
    min_transfer_version: TimelineItem[];
  };
}

/**
 * 코스/플랜 관련 API 서비스
 */
export const planService = {
  /**
   * 코스 생성
   * POST /otp/plans/generate
   */
  createCourse: async (
    data: CreateCourseRequest,
  ): Promise<CreateCourseResponse> => {
    // Plan은 로그인한 사용자별로 DB에 저장되므로 인증이 필요
    return api.post<CreateCourseResponse>("/plans/generate", data, {
      requiresAuth: true,
    });
  },

  /**
   * 코스 조회
   * GET /otp/plans/{plan_id}
   */
  getCourse: async (planId: string): Promise<GetCourseResponse> => {
    return api.get<GetCourseResponse>(`/plans/${planId}`);
  },

  /**
   * 저장된 플랜 생성
   * POST /otp/records/plans
   */
  savePlan: async (data: SavePlanRequest): Promise<SavePlanResponse> => {
    return api.post<SavePlanResponse>("/records/plans", data, {
      requiresAuth: true,
    });
  },

  /**
   * 저장된 플랜 목록 조회
   * GET /otp/records/plans
   */
  getSavedPlans: async (limit?: number): Promise<GetSavedPlansResponse> => {
    const params = limit ? `?limit=${limit}` : "";
    return api.get<GetSavedPlansResponse>(`/records/plans${params}`, {
      requiresAuth: true,
    });
  },

  /**
   * 저장된 플랜 상세 조회
   * GET /otp/records/plans/{saved_plan_id}
   */
  getSavedPlanDetail: async (
    savedPlanId: string,
  ): Promise<SavedPlanDetailResponse> => {
    return api.get<SavedPlanDetailResponse>(`/records/plans/${savedPlanId}`, {
      requiresAuth: true,
    });
  },

  /**
   * 저장된 플랜 삭제
   * DELETE /otp/records/plans/{saved_plan_id}
   */
  deleteSavedPlan: async (savedPlanId: string): Promise<void> => {
    await api.delete(`/records/plans/${savedPlanId}`, {
      requiresAuth: true,
    });
  },

  /**
   * 대체 장소 추천
   * POST /otp/plans/replace-spots
   */
  recommendAlternatives: async (
    data: ReplaceSpotsRequest,
  ): Promise<ReplaceSpotsResponse> => {
    return api.post<ReplaceSpotsResponse>("/plans/replace-spots", data, {
      requiresAuth: true,
    });
  },
  /**
   * 코스 재계산 (장소 삭제/수정 후)
   * POST /otp/plans/{plan_id}/recalculate
   */
  recalculateRoute: async (
    planId: string,
    data: RecalculateRouteRequest,
  ): Promise<RecalculateRouteResponse> => {
    return api.post<RecalculateRouteResponse>(
      `/plans/${planId}/recalculate`,
      data,
      {
        requiresAuth: true,
      },
    );
  },
};

export default planService;
