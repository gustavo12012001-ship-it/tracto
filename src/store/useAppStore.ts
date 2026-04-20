import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../services/supabase';
import { apiFetch } from '../services/api';
import { fetchFieldIntelligenceSnapshot, type FieldIntelligenceSnapshot } from '../services/api';
import { type LocationStatus, fetchCurrentLocation } from '../utils/geolocation';

export interface Entitlements {
  max_fields: number;
  can_use_whatsapp: boolean;
  can_use_push: boolean;
}

export interface Location {
  id?: string;
  lat: number;
  lng: number;
  name?: string;
  boundaries?: [number, number][];
  cultura?: string;
  dataPlantio?: string;
  variedade?: string;
  areaHa?: number;
  farm_id?: string;
  irrigacaoTipo?: string;
  adubacaoTipo?: string;
  ultimaAdubacao?: string;
  texturaSolo?: string;
  culturaAnterior?: string;
  rotacaoCulturas?: string;
}

export interface Farm {
  id: string;
  name: string;
  description?: string;
  fields: Location[];
}

export type MapLayer = 'osm' | 'satellite' | 'sentinel';

function normalizeMapLayer(layer: unknown): MapLayer {
  if (layer === 'osm' || layer === 'satellite' || layer === 'sentinel') {
    return layer;
  }
  if (layer === 'ndvi' || layer === 'moisture') {
    return 'sentinel';
  }
  return 'sentinel';
}

function isFieldNotFoundError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('404') ||
    normalized.includes('nao encontrado') ||
    normalized.includes('não encontrado') ||
    normalized.includes('acesso negado')
  );
}

function omitFieldKey<T>(record: Record<string, T>, fieldId: string): Record<string, T> {
  if (!(fieldId in record)) return record;
  const next = { ...record };
  delete next[fieldId];
  return next;
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  dismissed: boolean;
  field?: string;
  value?: string;
  valueLabel?: string;
}

export interface WeatherCache {
  lat: number;
  lng: number;
  fetchedAt: number;
  temperature: number;
  windSpeed: number;
  humidity: number;
  weatherCode: number;
  daily: {
    time: string[];
    tempMax: number[];
    tempMin: number[];
    precipSum: number[];
    et0: number[];
  };
  hourly: {
    time: string[];
    temp: number[];
    humidity: number[];
    precip: number[];
    windSpeed: number[];
    visibility: number[];
  };
}

// ── Funções centralizadas de mapeamento (OBRIGATÓRIO — não mapear manualmente) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbToField(row: any): Location {
  return {
    id: row.id,
    farm_id: row.farm_id,
    name: row.name,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    cultura: row.crop_type ?? undefined,
    variedade: row.variety ?? undefined,
    dataPlantio: row.planting_date ?? undefined,
    areaHa: row.area_ha != null ? Number(row.area_ha) : undefined,
    boundaries: Array.isArray(row.boundaries)
      ? row.boundaries.map((p: [number, number]) => [Number(p[0]), Number(p[1])] as [number, number])
      : undefined,
    irrigacaoTipo: row.irrigation_type ?? undefined,
    adubacaoTipo: row.fertilization_type ?? undefined,
    ultimaAdubacao: row.last_fertilization_date ?? undefined,
    texturaSolo: row.soil_texture ?? undefined,
    culturaAnterior: row.previous_crop ?? undefined,
    rotacaoCulturas: row.crop_rotation ?? undefined,
  };
}

function mapFieldToDb(field: Omit<Location, 'id'> & { farm_id: string; user_id: string }) {
  return {
    farm_id: field.farm_id,
    user_id: field.user_id,
    name: field.name ?? 'Talhão',
    latitude: field.lat,
    longitude: field.lng,
    crop_type: field.cultura ?? null,
    variety: field.variedade ?? null,
    planting_date: field.dataPlantio ?? null,
    area_ha: field.areaHa ?? null,
    boundaries: field.boundaries ?? null,
    irrigation_type: field.irrigacaoTipo ?? null,
    fertilization_type: field.adubacaoTipo ?? null,
    last_fertilization_date: field.ultimaAdubacao ?? null,
    soil_texture: field.texturaSolo ?? null,
    previous_crop: field.culturaAnterior ?? null,
    crop_rotation: field.rotacaoCulturas ?? null,
  };
}

// ── Satellite overlay compartilhado (FieldMap → Chat) ─────────────────────────
export interface CurrentSatelliteScene {
  fieldId: string;
  source: 's1' | 's2';
  sceneId: string;
  sceneDate: string | null;
  sceneDate_br: string | null;
  cloudCoverage: number | null;
}

// ── State Interface ───────────────────────────────────────────────────────────

interface AppState {
  farms: Farm[];
  fields: Location[];
  chatHistory: { role: 'user' | 'model'; text: string }[];
  alerts: Alert[];
  weatherCache: WeatherCache | null;
  fieldIntelligenceById: Record<string, FieldIntelligenceSnapshot>;
  fieldIntelligenceLoadingById: Record<string, boolean>;
  fieldIntelligenceErrorById: Record<string, string | null>;
  activeFarmId: string | null;
  activeFieldId: string | null;
  activeFieldFocusToken: number;
  activeMapLayer: MapLayer;
  currentLocation: Location | null;
  locationStatus: LocationStatus;
  isSyncing: boolean;
  syncError: string | null;
  entitlements: Entitlements | null;
  /** Última cena satelital visível no mapa (não persistida) */
  currentSatelliteScene: CurrentSatelliteScene | null;

  setFarms: (farms: Farm[]) => void;
  setActiveFarm: (id: string | null) => void;
  setActiveField: (id: string | null) => void;
  focusActiveField: () => void;
  setMapLayer: (layer: MapLayer) => void;
  setCurrentLocation: (loc: Location | null) => void;
  setLocationStatus: (status: LocationStatus) => void;
  updateGeolocation: () => Promise<void>;
  addFarm: (farm: Farm) => void;
  syncFields: () => Promise<void>;
  createField: (farmId: string, field: Omit<Location, 'id'>) => Promise<void>;
  updateField: (fieldId: string, updates: Partial<Location>) => Promise<void>;
  removeField: (farmId: string, fieldId: string) => Promise<void>;
  addMessage: (role: 'user' | 'model', text: string) => void;
  clearChat: () => void;
  setAlerts: (alerts: Alert[]) => void;
  dismissAlert: (id: string) => void;
  setWeatherCache: (cache: WeatherCache) => void;
  fetchFieldIntelligence: (fieldId: string, forceRefresh?: boolean) => Promise<FieldIntelligenceSnapshot | null>;
  refreshActiveFieldIntelligence: () => Promise<FieldIntelligenceSnapshot | null>;
  fetchEntitlements: () => Promise<void>;
  syncFromBackend: () => Promise<void>;
  resetStore: () => void;
  setCurrentSatelliteScene: (scene: CurrentSatelliteScene | null) => void;
}

const MAX_CHAT_HISTORY = 100;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      farms: [],
      fields: [],
      chatHistory: [],
      alerts: [],
      weatherCache: null,
      fieldIntelligenceById: {},
      fieldIntelligenceLoadingById: {},
      fieldIntelligenceErrorById: {},
      activeFarmId: null,
      activeFieldId: null,
      activeFieldFocusToken: 0,
      activeMapLayer: 'sentinel',
      currentLocation: null,
      locationStatus: 'loading',
      isSyncing: false,
      syncError: null,
      entitlements: null,
      currentSatelliteScene: null,

      setCurrentSatelliteScene: (scene) => set({ currentSatelliteScene: scene }),

      setFarms: (farms) => {
        set({ farms });
      },

      setActiveFarm: (id) =>
        set({
          activeFarmId: id,
          activeFieldId: null,
        }),

      setActiveField: (id) =>
        set((state) => {
          if (!id) {
            return { activeFieldId: null, chatHistory: [] };
          }

          const selectedField = state.fields.find((field) => field.id === id);
          return {
            activeFieldId: id,
            activeFarmId: selectedField?.farm_id ?? state.activeFarmId,
            chatHistory: state.activeFieldId !== id ? [] : state.chatHistory,
          };
        }),
      focusActiveField: () =>
        set((state) => ({ activeFieldFocusToken: state.activeFieldFocusToken + 1 })),
      setMapLayer: (layer) => set({ activeMapLayer: normalizeMapLayer(layer) }),
      setCurrentLocation: (loc) => set({ currentLocation: loc }),
      setLocationStatus: (status) => set({ locationStatus: status }),

      updateGeolocation: async () => {
        set({ locationStatus: 'loading' });
        const res = await fetchCurrentLocation();
        set({
          currentLocation: { lat: res.lat, lng: res.lng, name: res.name },
          locationStatus: res.status,
        });
      },

      addFarm: (farm) =>
        set((state) => ({
          farms: [...state.farms, farm],
          activeFarmId: state.activeFarmId || farm.id,
        })),

      // ── syncFields: fonte única de verdade via Supabase ──────────────────────
      syncFields: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.warn('[Store] syncFields: usuário não autenticado.');
          return;
        }

        const { data, error } = await supabase
          .from('fields')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('[Store] Erro ao sincronizar talhões:', error);
          throw error;
        }

        const mappedFields = (data ?? []).map(mapDbToField);
        const validFieldIds = new Set(
          mappedFields
            .map((field) => field.id)
            .filter((id): id is string => Boolean(id))
        );
        const pruneByFieldIds = <T>(record: Record<string, T>) =>
          Object.fromEntries(
            Object.entries(record).filter(([fieldId]) => validFieldIds.has(fieldId))
          ) as Record<string, T>;
        const currentActiveFieldId = get().activeFieldId;
        const activeField = currentActiveFieldId
          ? mappedFields.find((field) => field.id === currentActiveFieldId) ?? null
          : null;
        const farms = get().farms;
        const currentActiveFarmId = get().activeFarmId;
        const currentState = get();

        set({
          fields: mappedFields,
          activeFieldId: activeField?.id ?? null,
          activeFarmId: activeField?.farm_id
            ?? (currentActiveFarmId && farms.some((farm) => farm.id === currentActiveFarmId)
              ? currentActiveFarmId
              : farms[0]?.id ?? null),
          fieldIntelligenceById: pruneByFieldIds(currentState.fieldIntelligenceById),
          fieldIntelligenceLoadingById: pruneByFieldIds(currentState.fieldIntelligenceLoadingById),
          fieldIntelligenceErrorById: pruneByFieldIds(currentState.fieldIntelligenceErrorById),
        });
      },

      // ── createField: insert no Supabase com validações obrigatórias ──────────
      createField: async (farmId, fieldData) => {
        // Validação obrigatória antes de qualquer operação
        if (!farmId) {
          throw new Error('Nenhuma fazenda ativa selecionada. Operação cancelada.');
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Usuário não autenticado. Faça login novamente.');
        }

        const dbPayload = mapFieldToDb({
          ...fieldData,
          farm_id: farmId,
          user_id: user.id,
        });

        const { data: newField, error } = await supabase
          .from('fields')
          .insert(dbPayload)
          .select()
          .single();

        if (error) {
          console.error('[Store] Erro ao criar talhão:', error);
          throw error;
        }

        // Atualizar o estado local APENAS com a resposta confirmada do banco
        const mapped = mapDbToField(newField);
        set((state) => ({ fields: [...state.fields, mapped] }));
        // Seleciona imediatamente o talhão criado e sincroniza fazenda ativa.
        get().setActiveField(mapped.id ?? null);
      },

      // ── updateField: patch no Supabase com campos informados ─────────────────
      updateField: async (fieldId, updates) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado.');

        const dbUpdates: Record<string, unknown> = {};
        if ('name' in updates)           dbUpdates.name                  = updates.name ?? null;
        if ('cultura' in updates)         dbUpdates.crop_type             = updates.cultura ?? null;
        if ('variedade' in updates)       dbUpdates.variety               = updates.variedade ?? null;
        if ('dataPlantio' in updates)     dbUpdates.planting_date         = updates.dataPlantio ?? null;
        if ('areaHa' in updates)          dbUpdates.area_ha               = updates.areaHa ?? null;
        if ('boundaries' in updates)      dbUpdates.boundaries            = updates.boundaries ?? null;
        if ('irrigacaoTipo' in updates)   dbUpdates.irrigation_type       = updates.irrigacaoTipo ?? null;
        if ('adubacaoTipo' in updates)    dbUpdates.fertilization_type    = updates.adubacaoTipo ?? null;
        if ('ultimaAdubacao' in updates)  dbUpdates.last_fertilization_date = updates.ultimaAdubacao ?? null;
        if ('texturaSolo' in updates)     dbUpdates.soil_texture          = updates.texturaSolo ?? null;
        if ('culturaAnterior' in updates) dbUpdates.previous_crop         = updates.culturaAnterior ?? null;
        if ('rotacaoCulturas' in updates) dbUpdates.crop_rotation         = updates.rotacaoCulturas ?? null;

        const { error } = await supabase
          .from('fields')
          .update(dbUpdates)
          .eq('id', fieldId)
          .eq('user_id', user.id);

        if (error) {
          console.error('[Store] Erro ao atualizar talhão:', error);
          throw error;
        }

        set((state) => ({
          fields: state.fields.map((f) => f.id === fieldId ? { ...f, ...updates } : f),
        }));
      },

      // ── removeField: delete no Supabase + garantia de consistência ───────────
      removeField: async (_farmId, fieldId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Usuário não autenticado.');
        }

        const { error } = await supabase
          .from('fields')
          .delete()
          .eq('id', fieldId)
          .eq('user_id', user.id); // garantia de ownership

        if (error) {
          console.error('[Store] Erro ao remover talhão:', error);
          throw error;
        }

        // Otimista: remover do estado local imediatamente
        set((state) => {
          const nextSnapshots = omitFieldKey(state.fieldIntelligenceById, fieldId);
          const nextLoading = omitFieldKey(state.fieldIntelligenceLoadingById, fieldId);
          const nextErrors = omitFieldKey(state.fieldIntelligenceErrorById, fieldId);

          const removedWasActive = state.activeFieldId === fieldId;
          return {
            fields: state.fields.filter((f) => f.id !== fieldId),
            activeFieldId: removedWasActive ? null : state.activeFieldId,
            chatHistory: removedWasActive ? [] : state.chatHistory,
            fieldIntelligenceById: nextSnapshots,
            fieldIntelligenceLoadingById: nextLoading,
            fieldIntelligenceErrorById: nextErrors,
          };
        });

        // Garantia de consistência pós-delete
        await get().syncFields();
      },

      addMessage: (role, text) =>
        set((state) => ({
          chatHistory: [...state.chatHistory, { role, text }].slice(-MAX_CHAT_HISTORY),
        })),

      clearChat: () => set({ chatHistory: [] }),
      setAlerts: (alerts) => set({ alerts }),

      dismissAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
        })),

      setWeatherCache: (cache) => set({ weatherCache: cache }),

      fetchFieldIntelligence: async (fieldId, forceRefresh = false) => {
        if (!fieldId) return null;

        const fieldExists = get().fields.some((field) => field.id === fieldId);
        if (!fieldExists) {
          set((state) => {
            const nextSnapshots = omitFieldKey(state.fieldIntelligenceById, fieldId);
            const nextLoading = omitFieldKey(state.fieldIntelligenceLoadingById, fieldId);
            const nextErrors = omitFieldKey(state.fieldIntelligenceErrorById, fieldId);

            return {
              fieldIntelligenceById: nextSnapshots,
              fieldIntelligenceLoadingById: nextLoading,
              fieldIntelligenceErrorById: nextErrors,
            };
          });
          return null;
        }

        const currentSnapshot = get().fieldIntelligenceById[fieldId];
        const currentTime = Date.now();
        const snapshotAgeMs = currentSnapshot
          ? currentTime - new Date(currentSnapshot.updated_at).getTime()
          : Number.POSITIVE_INFINITY;

        if (!forceRefresh && currentSnapshot && snapshotAgeMs < 5 * 60 * 1000) {
          return currentSnapshot;
        }

        set((state) => ({
          fieldIntelligenceLoadingById: { ...state.fieldIntelligenceLoadingById, [fieldId]: true },
          fieldIntelligenceErrorById: { ...state.fieldIntelligenceErrorById, [fieldId]: null },
        }));

        try {
          const snapshot = await fetchFieldIntelligenceSnapshot(fieldId, forceRefresh);
          set((state) => ({
            fieldIntelligenceById: { ...state.fieldIntelligenceById, [fieldId]: snapshot },
            fieldIntelligenceLoadingById: { ...state.fieldIntelligenceLoadingById, [fieldId]: false },
            fieldIntelligenceErrorById: { ...state.fieldIntelligenceErrorById, [fieldId]: null },
          }));
          return snapshot;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Falha ao carregar snapshot do talhão.';
          if (isFieldNotFoundError(message)) {
            set((state) => {
              const nextSnapshots = omitFieldKey(state.fieldIntelligenceById, fieldId);
              const nextLoading = omitFieldKey(state.fieldIntelligenceLoadingById, fieldId);
              const nextErrors = omitFieldKey(state.fieldIntelligenceErrorById, fieldId);

              return {
                activeFieldId: state.activeFieldId === fieldId ? null : state.activeFieldId,
                fieldIntelligenceById: nextSnapshots,
                fieldIntelligenceLoadingById: nextLoading,
                fieldIntelligenceErrorById: {
                  ...nextErrors,
                  [fieldId]: 'Talhão não encontrado ou removido. Selecione um talhão válido.',
                },
              };
            });
            return null;
          }

          set((state) => ({
            fieldIntelligenceLoadingById: { ...state.fieldIntelligenceLoadingById, [fieldId]: false },
            fieldIntelligenceErrorById: { ...state.fieldIntelligenceErrorById, [fieldId]: message },
          }));
          return currentSnapshot ?? null;
        }
      },

      refreshActiveFieldIntelligence: async () => {
        const fieldId = get().activeFieldId;
        if (!fieldId) return null;
        return get().fetchFieldIntelligence(fieldId, true);
      },

      fetchEntitlements: async () => {
        try {
          const ent = await apiFetch<Entitlements>('/api/billing/entitlements');
          set({ entitlements: ent });
        } catch (e) {
          console.error('[Store] Erro ao buscar entitlements', e);
        }
      },

      syncFromBackend: async () => {
        set({ isSyncing: true, syncError: null });
        try {
          await get().fetchEntitlements();

          // Sincronizar fazendas via API (autenticação via JWT)
          const { farmService } = await import('../services/farm_service');
          await farmService.bootstrapFarm();

          const farms = await farmService.getFarms();
          set({
            farms,
            activeFarmId: (() => {
              const currentActiveId = get().activeFarmId;
              const firstFarmId = farms.length > 0 ? farms[0].id : null;
              return currentActiveId && farms.find((f) => f.id === currentActiveId)
                ? currentActiveId
                : firstFarmId;
            })(),
          });

          // Sincronizar talhões via Supabase (fonte única de verdade)
          await get().syncFields();
        } catch (error) {
          console.error('[Store] Erro ao sincronizar:', error);
          set({ syncError: 'Ocorreu um erro ao carregar seus talhões.' });
        } finally {
          set({ isSyncing: false });
        }
      },

      resetStore: () =>
        set({
          farms: [],
          fields: [],
          chatHistory: [],
          alerts: [],
          weatherCache: null,
          fieldIntelligenceById: {},
          fieldIntelligenceLoadingById: {},
          fieldIntelligenceErrorById: {},
          activeFarmId: null,
          activeFieldId: null,
          activeFieldFocusToken: 0,
          currentLocation: null,
          locationStatus: 'loading',
          syncError: null,
          isSyncing: false,
          entitlements: null,
        }),
    }),
    {
      name: 'tracto-app-storage',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Partial<AppState>;

        if (version < 2) {
          return {
            ...state,
            activeMapLayer: normalizeMapLayer(state.activeMapLayer),
          } as AppState;
        }

        return {
          ...state,
          activeMapLayer: normalizeMapLayer(state.activeMapLayer),
        } as AppState;
      },
      partialize: (state) => ({
        activeFarmId: state.activeFarmId,
        activeFieldId: state.activeFieldId,
        activeFieldFocusToken: state.activeFieldFocusToken,
        activeMapLayer: state.activeMapLayer,
        currentLocation: state.currentLocation,
        locationStatus: state.locationStatus,
        // fields NÃO é persistido — vem sempre do Supabase via syncFields()
      }),
    }
  )
);

export default useAppStore;
