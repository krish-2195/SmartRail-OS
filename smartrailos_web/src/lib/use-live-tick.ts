import { useEffect, useState } from "react";
import { apiFetch, USE_MOCK } from "@/lib/api/client";

export function useLiveTick(intervalMs = 3000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

export function jitter(value: number, amplitude = 3, min = 0, max = 100) {
  const next = value + (Math.random() - 0.5) * amplitude * 2;
  return Math.max(min, Math.min(max, Math.round(next)));
}

// Global offset between client Date.now() and server simulation time (in ms)
let globalSimOffsetMs: number | null = null;
let lastSyncTime = 0;

export async function syncServerClock() {
  if (USE_MOCK) return;
  try {
    const start = Date.now();
    const res = await apiFetch<{
      is_overridden: boolean;
      system_time: string;
    }>("/sim/time");
    
    if (res) {
      if (!res.is_overridden) {
        // When not simulating a custom time, use client's exact system clock
        globalSimOffsetMs = null;
        lastSyncTime = Date.now();
        return;
      }

      if (res.system_time) {
        const rtt = Date.now() - start;
        const serverDate = new Date(res.system_time.replace(" ", "T"));
        if (!isNaN(serverDate.getTime())) {
          const adjustedServerMs = serverDate.getTime() + Math.floor(rtt / 2);
          globalSimOffsetMs = adjustedServerMs - Date.now();
          lastSyncTime = Date.now();
        }
      }
    }
  } catch {
    // If backend is unavailable, keep using current offset or fallback to local
  }
}

export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => {
      if (globalSimOffsetMs !== null) {
        setNow(new Date(Date.now() + globalSimOffsetMs));
      } else {
        setNow(new Date());
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function formatTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour12: false });
}

export function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatEta(seconds: number) {
  if (seconds <= 0) return "Now";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
