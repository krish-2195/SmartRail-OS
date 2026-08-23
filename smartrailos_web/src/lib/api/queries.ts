import { queryOptions } from "@tanstack/react-query";
import { apiFetch, mockAsync, USE_MOCK } from "./client";
import {
  adaptAlert,
  adaptRecommendations,
  adaptStation,
  adaptTrain,
  kpiFromSnapshot,
  type BackendAlert,
  type BackendDashboardSnapshot,
  type BackendStation,
  type BackendTrainAtStation,
  type StationCurrentData,
  type StationFeatureData,
  type BackendKpiHistory,
  type BackendEsp32Live,
  type BackendEsp32Event,
} from "./smartrail";
import {
  TRAINS,
  KPI,
  ALERTS,
  RECOMMENDATIONS,
  ANNOUNCEMENTS,
  NOTIFICATIONS,
  STATIONS,
  CROWD_FORECAST,
  HOURLY_FLOW,
  WEEKLY_TREND,
  PLATFORM_HEATMAP,
  type Train,
  type Alert,
  type Recommendation,
  type Announcement,
  type Notification,
  type Station,
} from "@/lib/mock/data";

export const queryKeys = {
  trains: ["trains"] as const,
  train: (id: string) => ["trains", id] as const,
  kpi: ["kpi"] as const,
  alerts: ["alerts"] as const,
  recommendations: ["recommendations"] as const,
  announcements: ["announcements"] as const,
  notifications: ["notifications"] as const,
  stations: ["stations"] as const,
  stationCurrent: (stationId: string) => ["stations", stationId, "current"] as const,
  stationFeature: (stationId: string) => ["stations", stationId, "feature"] as const,
  snapshot: ["dashboard", "snapshot"] as const,
  kpiHistory: ["kpi", "history"] as const,
  crowdForecast: ["crowd", "forecast"] as const,
  hourlyFlow: ["analytics", "hourly"] as const,
  weeklyTrend: ["analytics", "weekly"] as const,
  platformHeatmap: ["platform", "heatmap"] as const,
  simTime: ["sim", "time"] as const,
  esp32Live: ["esp32", "live"] as const,
  esp32Events: ["esp32", "events"] as const,
};

import { isWebSocketConnected } from "@/lib/use-global-ws";

const getLiveRefetchInterval = () => (isWebSocketConnected() ? false : 5_000);
const getLiveStaleTime = () => (isWebSocketConnected() ? 30_000 : 0);

// ---------- Backend-backed queries ----------

export const snapshotQuery = queryOptions<BackendDashboardSnapshot | null>({
  queryKey: queryKeys.snapshot,
  queryFn: () =>
    USE_MOCK
      ? mockAsync(null)
      : apiFetch<BackendDashboardSnapshot>("/dashboard/snapshot").catch(() => null),
  refetchInterval: getLiveRefetchInterval,
  staleTime: getLiveStaleTime,
});

export const trainsQuery = queryOptions<Train[]>({
  queryKey: queryKeys.trains,
  queryFn: async () => {
    if (USE_MOCK) return mockAsync(TRAINS);
    try {
      const list = await apiFetch<BackendTrainAtStation[]>("/trains/at-station");
      return (list || []).map(adaptTrain);
    } catch {
      return TRAINS;
    }
  },
  refetchInterval: getLiveRefetchInterval,
  staleTime: getLiveStaleTime,
});

export const trainQuery = (id: string) =>
  queryOptions<Train | undefined>({
    queryKey: queryKeys.train(id),
    queryFn: async () => {
      if (USE_MOCK) return mockAsync(TRAINS.find((t) => t.id === id));
      try {
        const list = await apiFetch<BackendTrainAtStation[]>("/trains/at-station");
        return (list || []).map(adaptTrain).find((t) => t.id === id);
      } catch {
        return TRAINS.find((t) => t.id === id);
      }
    },
    refetchInterval: getLiveRefetchInterval,
    staleTime: getLiveStaleTime,
  });

export const kpiQuery = queryOptions<typeof KPI>({
  queryKey: queryKeys.kpi,
  queryFn: async () => {
    if (USE_MOCK) return mockAsync(KPI);
    try {
      const snap = await apiFetch<BackendDashboardSnapshot>("/dashboard/snapshot");
      return kpiFromSnapshot(snap);
    } catch {
      return KPI;
    }
  },
  refetchInterval: getLiveRefetchInterval,
  staleTime: getLiveStaleTime,
});

export const kpiHistoryQuery = queryOptions<BackendKpiHistory | null>({
  queryKey: queryKeys.kpiHistory,
  queryFn: () =>
    USE_MOCK
      ? mockAsync(null)
      : apiFetch<BackendKpiHistory>("/dashboard/kpi-history").catch(() => null),
  refetchInterval: 60_000, // once per minute is enough
  staleTime: 55_000,
});

export const alertsQuery = queryOptions<Alert[]>({
  queryKey: queryKeys.alerts,
  queryFn: async () => {
    if (USE_MOCK) return mockAsync(ALERTS);
    const list = await apiFetch<BackendAlert[]>("/alerts").catch(() => [] as BackendAlert[]);
    return list.map(adaptAlert);
  },
  refetchInterval: getLiveRefetchInterval,
  staleTime: getLiveStaleTime,
});

export const recommendationsQuery = queryOptions<Recommendation[]>({
  queryKey: queryKeys.recommendations,
  queryFn: async () => {
    if (USE_MOCK) return mockAsync(RECOMMENDATIONS);
    try {
      const snap = await apiFetch<BackendDashboardSnapshot>("/dashboard/snapshot");
      return adaptRecommendations(snap?.recommendations || []);
    } catch {
      return RECOMMENDATIONS;
    }
  },
  refetchInterval: getLiveRefetchInterval,
  staleTime: getLiveStaleTime,
});

export const stationsQuery = queryOptions<Station[]>({
  queryKey: queryKeys.stations,
  queryFn: async () => {
    if (USE_MOCK) return mockAsync(STATIONS);
    try {
      const list = await apiFetch<BackendStation[]>("/stations");
      return (list || []).map(adaptStation);
    } catch {
      return STATIONS;
    }
  },
  staleTime: 60 * 60_000,
});

export const stationCurrentQuery = (stationId: string) =>
  queryOptions<StationCurrentData>({
    queryKey: queryKeys.stationCurrent(stationId),
    queryFn: () =>
      USE_MOCK
        ? mockAsync({
          train_id: "BL-UP-01",
          current_passenger_count: 540,
          arrival_time: "12:05",
          departure_time: "12:06",
        })
        : apiFetch<StationCurrentData>(`/stations/${stationId}/current`).catch(() => ({
          train_id: null,
          current_passenger_count: null,
          arrival_time: null,
          departure_time: null,
        })),
    refetchInterval: getLiveRefetchInterval,
    staleTime: getLiveStaleTime,
  });

export const stationFeatureQuery = (stationId: string) =>
  queryOptions<StationFeatureData[]>({
    queryKey: queryKeys.stationFeature(stationId),
    queryFn: () =>
      USE_MOCK
        ? mockAsync([{
          train_id: "BL-UP-02",
          estimated_arrival_time: "12:15",
          estimated_departure_time: "12:16",
          estimated_passenger_incoming: 420,
          estimated_alighting: 120,
          estimated_boarding: 230,
          estimated_station_passenger_count: 530,
          coaches: [],
        }])
        : apiFetch<StationFeatureData[]>(`/stations/${stationId}/feature`).catch(() => []),
    refetchInterval: getLiveRefetchInterval,
    staleTime: getLiveStaleTime,
  });


// ---------- Mock-only queries (backend doesn't expose these yet) ----------

export const announcementsQuery = queryOptions<Announcement[]>({
  queryKey: queryKeys.announcements,
  queryFn: async () => {
    if (USE_MOCK) return mockAsync(ANNOUNCEMENTS);
    try {
      const list = await apiFetch<any[]>("/announcements/active");
      return list.map((a: any) => ({
        id: a.id,
        text: a.text,
        context: a.context,
      }));
    } catch {
      return [];
    }
  },
  refetchInterval: getLiveRefetchInterval,
});

export const notificationsQuery = queryOptions<Notification[]>({
  queryKey: queryKeys.notifications,
  queryFn: async (): Promise<Notification[]> => {
    if (USE_MOCK) return mockAsync(NOTIFICATIONS);
    try {
      const alerts = await apiFetch<any[]>("/alerts").catch(() => []);
      if (!alerts || alerts.length === 0) return NOTIFICATIONS;
      return alerts.slice(0, 10).map((a: any): Notification => ({
        id: String(a.id),
        type: (a.alert_type === "platform_congestion" ? "Crowd Alert" : a.alert_type === "train_delay" ? "Delay" : "Service Update"),
        title: String(a.title || "Transit Alert"),
        body: String(a.message || ""),
        time: a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now",
      }));
    } catch {
      return NOTIFICATIONS;
    }
  },
  refetchInterval: 15_000,
});

export const crowdForecastQuery = queryOptions<typeof CROWD_FORECAST>({
  queryKey: queryKeys.crowdForecast,
  queryFn: async () => {
    if (USE_MOCK) return mockAsync(CROWD_FORECAST);
    return await apiFetch<typeof CROWD_FORECAST>("/analytics/crowd-forecast").catch(() => CROWD_FORECAST);
  },
  refetchInterval: 30_000,
});

export const hourlyFlowQuery = queryOptions<typeof HOURLY_FLOW>({
  queryKey: queryKeys.hourlyFlow,
  queryFn: async () => {
    if (USE_MOCK) return mockAsync(HOURLY_FLOW);
    return await apiFetch<typeof HOURLY_FLOW>("/analytics/hourly-flow").catch(() => HOURLY_FLOW);
  },
});

export const weeklyTrendQuery = queryOptions<typeof WEEKLY_TREND>({
  queryKey: queryKeys.weeklyTrend,
  queryFn: async () => {
    if (USE_MOCK) return mockAsync(WEEKLY_TREND);
    return await apiFetch<typeof WEEKLY_TREND>("/analytics/weekly-trend").catch(() => WEEKLY_TREND);
  },
});

export const platformHeatmapQuery = queryOptions<number[][]>({
  queryKey: queryKeys.platformHeatmap,
  queryFn: async () => {
    if (USE_MOCK) return mockAsync(PLATFORM_HEATMAP);
    return await apiFetch<number[][]>("/analytics/heatmap").catch(() => PLATFORM_HEATMAP);
  },
  refetchInterval: 15_000,
});

export interface SimTimeData {
  status: string;
  is_overridden: boolean;
  override_time: string | null;
  system_time: string;
  last_updated: string;
}

export const simTimeQuery = queryOptions<SimTimeData | null>({
  queryKey: queryKeys.simTime,
  queryFn: async () => {
    if (USE_MOCK) return null;
    return await apiFetch<SimTimeData>("/sim/time").catch(() => null);
  },
  refetchInterval: 15_000,
  staleTime: 10_000,
});

export const esp32LiveQuery = queryOptions<BackendEsp32Live>({
  queryKey: queryKeys.esp32Live,
  queryFn: async () => {
    return await apiFetch<BackendEsp32Live>("/esp32/live");
  },
  refetchInterval: 2_000, // 2s polling fallback if WS disconnects
});

export const esp32EventsQuery = queryOptions<BackendEsp32Event[]>({
  queryKey: queryKeys.esp32Events,
  queryFn: async () => {
    return await apiFetch<BackendEsp32Event[]>("/esp32/events").catch(() => []);
  },
  refetchInterval: 3_000,
});

export async function sendEsp32Telemetry(payload: {
  direction?: string;
  in_delta?: number;
  out_delta?: number;
  occupancy?: number;
  station_id?: string | null;
  coach_id?: string;
  coach_capacity?: number;
  distance_s1?: number;
  distance_s2?: number;
}): Promise<BackendEsp32Live> {
  return await apiFetch<BackendEsp32Live>("/esp32/telemetry", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetEsp32Counters(): Promise<BackendEsp32Live> {
  return await apiFetch<BackendEsp32Live>("/esp32/reset", {
    method: "POST",
  });
}

export async function updateEsp32Config(payload: {
  target_station_id?: string | null;
  coach_capacity?: number;
  coach_id?: string;
}): Promise<BackendEsp32Live> {
  return await apiFetch<BackendEsp32Live>("/esp32/config", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
