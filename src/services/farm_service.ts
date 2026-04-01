import { apiFetch } from './api';
import type { Farm, Location } from '../store/useAppStore';

type ApiFarm = {
  id: string;
  name: string;
  description?: string;
  fields?: ApiField[];
};

type ApiField = {
  id?: string;
  farm_id: string;
  user_id?: string;
  name: string;
  crop_type?: string | null;
  variety?: string | null;
  planting_date?: string | null;
  area_ha?: number | null;
  boundaries?: [number, number][] | null;
  latitude: number;
  longitude: number;
};

function toLocation(field: ApiField): Location {
  return {
    id: field.id,
    farm_id: field.farm_id,
    name: field.name,
    lat: Number(field.latitude),
    lng: Number(field.longitude),
    cultura: field.crop_type ?? undefined,
    variedade: field.variety ?? undefined,
    dataPlantio: field.planting_date ?? undefined,
    areaHa: field.area_ha != null ? Number(field.area_ha) : undefined,
    boundaries: Array.isArray(field.boundaries)
      ? field.boundaries.map((point) => [Number(point[0]), Number(point[1])] as [number, number])
      : undefined,
  };
}

function toApiField(field: Partial<Location>): Partial<ApiField> {
  return {
    id: field.id,
    farm_id: field.farm_id,
    name: field.name,
    crop_type: field.cultura ?? null,
    variety: field.variedade ?? null,
    planting_date: field.dataPlantio ?? null,
    area_ha: field.areaHa ?? null,
    boundaries: field.boundaries ?? null,
    latitude: field.lat,
    longitude: field.lng,
  };
}

export const farmService = {
  getFarms: async (): Promise<Farm[]> => {
    const response = await apiFetch<{ farms: ApiFarm[] }>('/api/farms');
    return response.farms.map((farm) => ({
      ...farm,
      fields: Array.isArray(farm.fields) ? farm.fields.map(toLocation) : [],
    }));
  },

  bootstrapFarm: async (): Promise<Farm> => {
    const farm = await apiFetch<ApiFarm>('/api/farms/bootstrap', {
      method: 'POST',
    });
    return {
      ...farm,
      fields: Array.isArray(farm.fields) ? farm.fields.map(toLocation) : [],
    };
  },

  saveFarm: async (farm: Partial<Farm>): Promise<Farm> => {
    const isUpdate = !!farm.id;
    const method = isUpdate ? 'PUT' : 'POST';
    const path = isUpdate ? `/api/farms/${farm.id}` : '/api/farms';

    const response = await apiFetch<ApiFarm>(path, {
      method,
      body: JSON.stringify(farm),
    });

    return {
      ...response,
      fields: Array.isArray(response.fields) ? response.fields.map(toLocation) : [],
    };
  },

  save_farm: async (farm: Partial<Farm>): Promise<Farm> => {
    return farmService.saveFarm(farm);
  },

  deleteFarm: async (farmId: string): Promise<boolean> => {
    const response = await apiFetch<{ success: boolean }>(`/api/farms/${farmId}`, {
      method: 'DELETE',
    });
    return response.success;
  },

  getFields: async (farmId?: string): Promise<Location[]> => {
    const query = new URLSearchParams();
    if (farmId) query.append('farm_id', farmId);

    const path = query.toString() ? `/api/fields?${query.toString()}` : '/api/fields';
    const response = await apiFetch<{ fields: ApiField[] }>(path);
    return response.fields.map(toLocation);
  },

  saveField: async (field: Partial<Location>): Promise<Location> => {
    const isUpdate = !!field.id;
    const method = isUpdate ? 'PUT' : 'POST';
    const path = isUpdate ? `/api/fields/${field.id}` : '/api/fields';

    const response = await apiFetch<ApiField>(path, {
      method,
      body: JSON.stringify(toApiField(field)),
    });

    return toLocation(response);
  },

  deleteField: async (fieldId: string): Promise<boolean> => {
    const response = await apiFetch<{ success: boolean }>(`/api/fields/${fieldId}`, {
      method: 'DELETE',
    });
    return response.success;
  },
};
