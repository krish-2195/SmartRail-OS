import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, USE_MOCK } from "./client";
import {
  alertsQuery,
  announcementsQuery,
  crowdForecastQuery,
  hourlyFlowQuery,
  kpiQuery,
  kpiHistoryQuery,
  notificationsQuery,
  platformHeatmapQuery,
  queryKeys,
  recommendationsQuery,
  stationsQuery,
  trainQuery,
  trainsQuery,
  weeklyTrendQuery,
  stationCurrentQuery,
  stationFeatureQuery,
  snapshotQuery,
} from "./queries";
import { kpiFromSnapshot, adaptRecommendations } from "./smartrail";
import { KPI, RECOMMENDATIONS } from "@/lib/mock/data";

export const useTrains = () => useQuery(trainsQuery);
export const useTrain = (id: string) => useQuery(trainQuery(id));
export const useDashboardSnapshot = () => useQuery(snapshotQuery);

// Derive KPI and Recommendations from shared snapshot to eliminate redundant 3x polling
export const useKpi = () => {
  const snap = useDashboardSnapshot();
  const kpiQ = useQuery(kpiQuery);
  if (snap.data) {
    return {
      ...snap,
      data: kpiFromSnapshot(snap.data),
    };
  }
  return kpiQ;
};

export const useRecommendations = () => {
  const snap = useDashboardSnapshot();
  const recQ = useQuery(recommendationsQuery);
  if (snap.data?.recommendations) {
    return {
      ...snap,
      data: adaptRecommendations(snap.data.recommendations),
    };
  }
  return recQ;
};

export const useKpiHistory = () => useQuery(kpiHistoryQuery);
export const useAlerts = () => useQuery(alertsQuery);
export const useAnnouncements = () => useQuery(announcementsQuery);
export const useNotifications = () => useQuery(notificationsQuery);
export const useStations = () => useQuery(stationsQuery);
export const useCrowdForecast = () => useQuery(crowdForecastQuery);
export const useHourlyFlow = () => useQuery(hourlyFlowQuery);
export const useWeeklyTrend = () => useQuery(weeklyTrendQuery);
export const usePlatformHeatmap = () => useQuery(platformHeatmapQuery);
export const useStationCurrent = (stationId: string) => useQuery(stationCurrentQuery(stationId));
export const useStationFeature = (stationId: string) => useQuery(stationFeatureQuery(stationId));

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      if (USE_MOCK) return { ok: true };
      return apiFetch<{ status: string }>(
        `/alerts/${encodeURIComponent(alertId)}/acknowledge`,
        { method: "POST" },
      );
    },
    onMutate: async (alertId: string) => {
      await qc.cancelQueries({ queryKey: queryKeys.alerts });
      const previous = qc.getQueryData<any[]>(queryKeys.alerts);
      if (previous) {
        qc.setQueryData<any[]>(
          queryKeys.alerts,
          previous.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.alerts, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alerts });
      qc.invalidateQueries({ queryKey: queryKeys.snapshot });
    },
  });
}

export function useBroadcastAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { text: string; context?: string }) => {
      if (USE_MOCK) return { ok: true };
      return apiFetch<{ ok: true }>("/announcements/broadcast", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.announcements }),
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      if (USE_MOCK) return { ok: true };
      return apiFetch<{ status: string }>(
        `/alerts/${encodeURIComponent(alertId)}/resolve`,
        { method: "POST" },
      );
    },
    onMutate: async (alertId: string) => {
      await qc.cancelQueries({ queryKey: queryKeys.alerts });
      const previous = qc.getQueryData<any[]>(queryKeys.alerts);
      if (previous) {
        qc.setQueryData<any[]>(
          queryKeys.alerts,
          previous.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.alerts, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alerts });
      qc.invalidateQueries({ queryKey: queryKeys.snapshot });
      qc.invalidateQueries({ queryKey: queryKeys.kpi });
    },
  });
}
