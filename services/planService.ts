import { api } from './api';

/**
 * 코스 생성 관련 타입 정의
 */

// 고정 일정 이벤트 타입
export interface FixedEvent {
  date: string;           // "2026-02-07"
  title: string;          // "점심 식사"
  start_time: string;     // "12:00"
  end_time: string;       // "14:00"
  place_name?: string;    // "맛집 이름"
  address?: string;       // "서울특별시 종로구..."
  lat?: number;           // 위도
  lng?: number;           // 경도
}

// 코스 생성 요청 타입
export interface CreateCourseRequest {
  region: string;                           // "종로구"
  start_date: string;                       // "2026-02-07"
  end_date: string;                         // "2026-02-08"
  first_day_start_time: string;             // "14:00"
  last_day_end_time: string;                // "18:00"
  fixed_events: FixedEvent[];               // 고정 일정 배열
  transport_mode: 'walkAndPublic' | 'car';  // 이동수단
}

// 장소 정보 타입
export interface Place {
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
  time: string;                 // "14:00 - 15:00"
  transit_to_here: string[];    // 이동 경로 정보 배열
  congestion_level: string;     // "🟢여유", "🟡보통(+14분)" 등
}

// 하루 일정 타입
export interface DayPlan {
  route: Place[];                           // 방문 장소 리스트
  restaurants: Place[];                     // 음식점 리스트
  accommodations: Place[];                  // 숙박시설 리스트
  timelines: {
    fastest_version: TimelineItem[];        // 최단 시간 버전
    min_transfer_version: TimelineItem[];   // 최소 환승 버전
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
    [key: string]: DayPlan;  // "day1", "day2" 등
  };
}

// 코스 조회 응답 타입 (CreateCourseResponse와 동일)
export type GetCourseResponse = CreateCourseResponse;

/**
 * 코스/플랜 관련 API 서비스
 */
export const planService = {
  /**
   * 코스 생성
   * POST /otp/plans/generate
   */
  createCourse: async (data: CreateCourseRequest): Promise<CreateCourseResponse> => {
    return api.post<CreateCourseResponse>('/plans/generate', data, { requiresAuth: false });
  },

  /**
   * 코스 조회
   * GET /otp/plans/{plan_id}
   */
  getCourse: async (planId: string): Promise<GetCourseResponse> => {
    return api.get<GetCourseResponse>(`/plans/${planId}`);
  },
};

export default planService;
