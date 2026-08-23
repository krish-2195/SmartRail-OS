import { useEffect, useRef } from "react";
import { type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queries";
import {
  adaptTrain,
  adaptAlert,
  adaptRecommendations,
  kpiFromSnapshot,
  type BackendTrainAtStation,
  type BackendDashboardSnapshot,
  type BackendAlert,
  type BackendEsp32Live,
} from "@/lib/api/smartrail";
import { type Train, type Alert } from "@/lib/mock/data";

let globalQueryClient: QueryClient | null = null;
let wsConnectedState = false;
const connectionListeners = new Set<(connected: boolean) => void>();

export function isWebSocketConnected(): boolean {
  return wsConnectedState;
}

export function subscribeWsConnection(listener: (connected: boolean) => void) {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}

function setWsConnected(state: boolean) {
  if (wsConnectedState !== state) {
    wsConnectedState = state;
    connectionListeners.forEach((fn) => fn(state));
  }
}

export function triggerImmediateRefresh() {
  if (globalQueryClient) {
    globalQueryClient.invalidateQueries({ queryKey: queryKeys.trains });
    globalQueryClient.invalidateQueries({ queryKey: queryKeys.snapshot });
    globalQueryClient.invalidateQueries({ queryKey: queryKeys.kpi });
  }
}

export function useGlobalWebSocket(qc: QueryClient) {
  const qcRef = useRef(qc);
  qcRef.current = qc;
  globalQueryClient = qc;

  useEffect(() => {
    const defaultWs =
      typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8000/api/v1/ws/realtime`
        : "ws://localhost:8000/api/v1/ws/realtime";

    const wsUrl = (import.meta.env.VITE_REALTIME_WS_URL as string | undefined) || defaultWs;
    if (!wsUrl || typeof wsUrl !== "string") return;

    const endpoint: string = wsUrl;
    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    let isUnmounted = false;

    function connect() {
      if (isUnmounted) return;

      try {
        socket = new WebSocket(endpoint);

        socket.onopen = () => {
          retryCount = 0; // reset on successful connection
          setWsConnected(true);
        };

        socket.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (!data) return;

            const client = qcRef.current;
            const eventType = data.event_type || data.type;
            const payload = data.data;

            // ── 1. Full Simulation Tick / Snapshot Update (Direct Cache Hydration) ──
            if (eventType === "simulation_tick" || eventType === "snapshot_update") {
              if (payload) {
                // A. Hydrate live trains cache directly (0ms latency, 0 HTTP requests)
                if (Array.isArray(payload.trains) && payload.trains.length > 0) {
                  const adapted = (payload.trains as BackendTrainAtStation[]).map(adaptTrain);
                  client.setQueryData(queryKeys.trains, adapted);

                  // Also hydrate individual train queries
                  adapted.forEach((t) => {
                    client.setQueryData(queryKeys.train(t.id), t);
                  });
                }

                // B. Hydrate dashboard snapshot & KPI cache directly
                if (payload.snapshot) {
                  const snap = payload.snapshot as BackendDashboardSnapshot;
                  client.setQueryData(queryKeys.snapshot, snap);
                  client.setQueryData(queryKeys.kpi, kpiFromSnapshot(snap));
                  if (snap.recommendations && snap.recommendations.length > 0) {
                    client.setQueryData(
                      queryKeys.recommendations,
                      adaptRecommendations(snap.recommendations)
                    );
                  }
                }
              }
            }
            // ── 2. Single Train Occupancy Update ───────────────────────────
            else if (eventType === "occupancy_update") {
              if (payload && payload.train_id) {
                client.setQueryData(queryKeys.trains, (old: Train[] | undefined) => {
                  if (!old) return old;
                  return old.map((t) => {
                    if (t.id === payload.train_id) {
                      return {
                        ...t,
                        currentStationId: payload.station_id ?? t.currentStationId,
                      };
                    }
                    return t;
                  });
                });

                if (payload.station_id) {
                  client.setQueryData(queryKeys.stationCurrent(payload.station_id), (old: any) => ({
                    ...old,
                    train_id: payload.train_id,
                    current_passenger_count: payload.total_passengers,
                  }));
                }
              }
            }
            // ── 3. ESP32 Sensor Telemetry Events ───────────────────────────
            else if (eventType === "esp32_passenger_event" || eventType === "esp32_live") {
              if (payload) {
                client.setQueryData(queryKeys.esp32Live, payload as BackendEsp32Live);
                if (payload.event) {
                  client.setQueryData(queryKeys.esp32Events, (old: any[] | undefined) => [
                    payload.event,
                    ...(old || []).slice(0, 49),
                  ]);
                }
              }
            }
            // ── 4. Alert Issued (Direct Optimistic Prepend) ─────────────────
            else if (eventType === "alert_issued") {
              if (payload) {
                const newAlert = adaptAlert(payload as BackendAlert);
                client.setQueryData(queryKeys.alerts, (old: Alert[] | undefined) => {
                  const filtered = (old || []).filter((a) => a.id !== newAlert.id);
                  return [newAlert, ...filtered];
                });
              }
            }
            // ── 5. Alert Resolved (Direct State Mutation) ───────────────────
            else if (eventType === "alert_resolved") {
              const alertId = payload?.alert_id || payload?.id;
              if (alertId) {
                client.setQueryData(queryKeys.alerts, (old: Alert[] | undefined) => {
                  return (old || []).map((a) => (a.id === alertId ? { ...a, resolved: true } : a));
                });
              }
            }
            // ── 6. Announcements ──────────────────────────────────────────
            else if (eventType === "announcement_broadcast") {
              if (payload) {
                client.setQueryData(queryKeys.announcements, (old: any[] | undefined) => [
                  payload,
                  ...(old || []),
                ]);
              }
            }
          } catch {
            // ignore malformed payloads
          }
        };

        socket.onerror = () => {
          setWsConnected(false);
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
          }
        };

        socket.onclose = () => {
          setWsConnected(false);
          if (isUnmounted) return;
          // Exponential backoff: 1s, 2s, 4s, up to max 8s
          const backoff = Math.min(8000, 1000 * Math.pow(2, retryCount)) + Math.random() * 300;
          retryCount++;
          reconnectTimeout = setTimeout(connect, backoff);
        };
      } catch {
        setWsConnected(false);
        if (!isUnmounted) {
          const backoff = Math.min(8000, 1000 * Math.pow(2, retryCount));
          retryCount++;
          reconnectTimeout = setTimeout(connect, backoff);
        }
      }
    }

    connect();

    return () => {
      isUnmounted = true;
      setWsConnected(false);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
    };
  }, []);
}
