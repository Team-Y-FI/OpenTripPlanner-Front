import { api } from "./api";

export type ReverseGeocodeResponse = {
  address: string | null;
  road_address: string | null;
  region: string | null;
};

export const utilsService = {
  reverseGeocode: (lat: number, lng: number) =>
    api.post<ReverseGeocodeResponse>("/utils/reverse-geocode", { lat, lng }, { requiresAuth: false }),
};
