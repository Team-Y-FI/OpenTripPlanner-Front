import { api } from "./api";

export type MetaOption = { value: string; label: string; default?: boolean };
export type MetaOptions = {
  purposes: MetaOption[];
  categories: MetaOption[];
  place_categories: MetaOption[];
  transport: MetaOption[];
  crowd_mode: MetaOption[];
};

export const metaService = {
  getOptions: () => api.get<MetaOptions>("/meta/options", { requiresAuth: false }),
};
