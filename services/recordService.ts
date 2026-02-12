import { api } from "./api";

export type SpotListItem = {
  spot_id: string;
  place: {
    name: string;
    address: string | null;
    category: string | null;
    lat?: number;
    lng?: number;
  };
  visited_at: string | null;
  thumbnail_url: string | null;
};

export type SpotDetail = {
  spot_id: string;
  place: {
    name: string;
    address: string | null;
    category: string | null;
    lat: number;
    lng: number;
  };
  visited_at: string | null;
  memo: string | null;
  photos: Array<{ photo_id: string; url: string }>;
  related_plans: Array<{ plan_id: string; title: string | null; date: string | null }>;
};

export type CreateSpotItem = {
  photo_id: string;
  visited_at: string | null;
  place: {
    name: string;
    address?: string | null;
    category?: string | null;
    lat: number;
    lng: number;
  };
  memo?: string | null;
};

export type CreateSpotsRequest = {
  upload_id: string;
  spots: CreateSpotItem[];
};

export type UpdateSpotRequest = {
  memo?: string | null;
  tags?: string[] | null;
};

export type ListSpotsResponse = {
  items: SpotListItem[];
  next_cursor: string | null;
};

export const recordService = {
  listSpots: (params?: { q?: string; category?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.category) qs.set("category", params.category);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString();
    return api.get<ListSpotsResponse>(`/records/spots${suffix ? `?${suffix}` : ""}`, { requiresAuth: true });
  },

  getSpot: (spotId: string) => api.get<SpotDetail>(`/records/spots/${spotId}`, { requiresAuth: true }),

  createSpotsFromUpload: (data: CreateSpotsRequest) =>
    api.post<{ created: number; spot_ids: string[] }>("/records/spots", data, { requiresAuth: true }),

  updateSpot: (spotId: string, data: UpdateSpotRequest) =>
    api.patch<void>(`/records/spots/${spotId}`, data, { requiresAuth: true }),

  deleteSpot: (spotId: string) =>
    api.delete<void>(`/records/spots/${spotId}`, { requiresAuth: true }),
};

export default recordService;
