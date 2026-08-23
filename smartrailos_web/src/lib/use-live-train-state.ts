import { useState, useEffect } from "react";
import { type Train, BLUE_LINE, RED_LINE, findStation } from "@/lib/mock/data";

// 1. Station Name Formatter with standard [CODE]-[Name] output
export function formatFullStationName(stIdOrName?: string | null, line?: "blue" | "red" | string): string {
  if (!stIdOrName) return "En Route";
  const st = findStation(stIdOrName);
  if (st) {
    return `${st.id}-${st.name}`;
  }
  const raw = stIdOrName.trim();
  const numMatch = raw.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    const isRed = (line || "").toLowerCase().includes("red") || raw.toLowerCase().startsWith("r");
    const lineStations = isRed ? RED_LINE : BLUE_LINE;
    const byOrder = lineStations.find((s) => s.order === num);
    if (byOrder) return `${byOrder.id}-${byOrder.name}`;
    const code = (isRed ? "RL" : "BL") + String(num).padStart(2, "0");
    const byCode = lineStations.find((s) => s.id.toUpperCase() === code);
    if (byCode) return `${byCode.id}-${byCode.name}`;
    if (num >= 1 && num <= lineStations.length) {
      const s = lineStations[num - 1];
      return `${s.id}-${s.name}`;
    }
  }
  return stIdOrName;
}

// 2. Global Shared Clock & Target Registry (Guarantees 0ms delay across all cards)
interface TrainTargetEntry {
  targetMs: number;
  lastEtaSource: number;
  lastStatus: string;
}

const globalTrainTargets = new Map<string, TrainTargetEntry>();

let listeners: Array<() => void> = [];
let globalInterval: ReturnType<typeof setInterval> | null = null;
let currentGlobalNow = Date.now();

function notifyAll() {
  currentGlobalNow = Date.now();
  for (let i = 0; i < listeners.length; i++) {
    listeners[i]();
  }
}

export function useGlobalSecondTick(): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => (t + 1) % 1000000);
    listeners.push(listener);

    if (listeners.length === 1 && !globalInterval) {
      globalInterval = setInterval(notifyAll, 1000);
    }

    return () => {
      listeners = listeners.filter((l) => l !== listener);
      if (listeners.length === 0 && globalInterval) {
        clearInterval(globalInterval);
        globalInterval = null;
      }
    };
  }, []);

  return currentGlobalNow;
}

export function getOrCreateTrainTarget(train: Train, nowMs: number): number {
  const isServerAtStation = train.status === "At Station" || train.status === "Departing";
  const etaSource = isServerAtStation
    ? (train.departureEtaSeconds ?? train.etaSeconds ?? 30)
    : (train.arrivalEtaSeconds ?? train.etaSeconds ?? 0);

  const existing = globalTrainTargets.get(train.id);
  if (!existing) {
    const targetMs = nowMs + Math.max(0, etaSource) * 1000;
    globalTrainTargets.set(train.id, {
      targetMs,
      lastEtaSource: etaSource,
      lastStatus: train.status,
    });
    return targetMs;
  }

  // Update if status changed or backend ETA shifted
  if (existing.lastStatus !== train.status || Math.abs(existing.lastEtaSource - etaSource) > 2.5) {
    const targetMs = nowMs + Math.max(0, etaSource) * 1000;
    existing.targetMs = targetMs;
    existing.lastEtaSource = etaSource;
    existing.lastStatus = train.status;
  }

  return existing.targetMs;
}

export interface LiveTrainDwellState {
  isHalting: boolean;
  isDeparted: boolean;
  isApproaching: boolean;
  isEnRoute: boolean;
  secondsRemaining: number;
  dwellProgressSec: number;
  timerFormatted: string;
  totalCapacity: number;
  basePax: number;
  livePax: number;
  liveOccupancyPct: number;
  deboardTotal: number;
  boardTotal: number;
  liveDeboarded: number;
  liveBoarded: number;
  netFlow: number;
  totalEstPax: number;
  estAvgPct: number;
  currentStationFullName: string;
  nextStationFullName: string;
  coaches: Array<{
    id: string;
    label: string;
    capacity: number;
    basePax: number;
    livePax: number;
    livePct: number;
    estPax: number;
    estPct: number;
  }>;
}

export function computeLiveTrainState(train: Train, nowMs: number): LiveTrainDwellState {
  const targetMs = getOrCreateTrainTarget(train, nowMs);
  const remainingTotalSec = Math.round((targetMs - nowMs) / 1000);

  const isServerAtStation = train.status === "At Station" || train.status === "Departing";

  let isHalting = false;
  let isDeparted = false;
  let isApproaching = false;
  let isEnRoute = false;
  let secondsRemaining = 0;
  let dwellProgressSec = 0;

  if (isServerAtStation) {
    if (remainingTotalSec > 0) {
      isHalting = true;
      secondsRemaining = remainingTotalSec;
      dwellProgressSec = Math.max(0, Math.min(30, 30 - remainingTotalSec));
    } else {
      isDeparted = true;
      secondsRemaining = 0;
      dwellProgressSec = 30;
    }
  } else {
    // In transit
    if (remainingTotalSec > 0) {
      secondsRemaining = remainingTotalSec;
      if (remainingTotalSec <= 60) {
        isApproaching = true;
      } else {
        isEnRoute = true;
      }
      dwellProgressSec = 0;
    } else {
      const overtime = Math.abs(remainingTotalSec);
      if (overtime <= 30) {
        isHalting = true;
        secondsRemaining = 30 - overtime;
        dwellProgressSec = overtime;
      } else {
        isDeparted = true;
        secondsRemaining = 0;
        dwellProgressSec = 30;
      }
    }
  }

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timerFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  // Capacity & Base Passenger Calculations
  const coachesRaw = train.coaches || [];
  const totalCapacity = coachesRaw.reduce((sum, c) => sum + (c.capacity || 280), 0) || 800;
  const basePax = coachesRaw.reduce(
    (sum, c) => sum + (c.passengers ?? Math.round(((c.capacity || 280) * (c.occupancy || 0)) / 100)),
    0
  );

  // Boarding & Deboarding Metrics
  const deboardTotal = train.predictedDeboarding ?? (basePax === 0 ? 0 : Math.max(12, Math.round(basePax * 0.08)));
  const boardTotal = train.predictedBoarding ?? (basePax === 0 ? 0 : Math.max(18, Math.round(basePax * 0.12)));
  const netFlow = boardTotal - deboardTotal;

  let liveDeboarded = 0;
  let liveBoarded = 0;
  let livePax = basePax;

  if (isHalting) {
    if (dwellProgressSec <= 15) {
      // Phase 1: Alighting (0s to 15s)
      const frac = Math.min(1, dwellProgressSec / 15);
      liveDeboarded = Math.round(deboardTotal * frac);
      liveBoarded = 0;
      livePax = Math.max(0, basePax - liveDeboarded);
    } else {
      // Phase 2: Boarding (15s to 30s)
      const frac = Math.min(1, (dwellProgressSec - 15) / 15);
      liveDeboarded = deboardTotal;
      liveBoarded = Math.round(boardTotal * frac);
      livePax = Math.max(0, basePax - deboardTotal + liveBoarded);
    }
  } else if (isDeparted) {
    liveDeboarded = deboardTotal;
    liveBoarded = boardTotal;
    livePax = Math.max(0, basePax + netFlow);
  }

  const liveOccupancyPct = Math.min(100, Math.round((livePax / totalCapacity) * 100));

  const totalEstPax =
    train.estimatedDeparturePassengers ??
    (basePax === 0 ? 0 : Math.min(totalCapacity, basePax + netFlow));
  const estAvgPct =
    train.estimatedDepartureOccupancy ??
    (basePax === 0 ? 0 : Math.min(100, Math.round((totalEstPax / totalCapacity) * 100)));

  const currentStationFullName = formatFullStationName(train.currentStationId, train.line);
  const nextStationFullName = formatFullStationName(train.nextStationId, train.line);

  // Coach breakdown
  const coaches = coachesRaw.map((c) => {
    const coachCap = c.capacity || 280;
    const coachBase = c.passengers ?? Math.round((coachCap * (c.occupancy || 0)) / 100);
    const coachShare = coachCap / totalCapacity;
    const coachLive = isHalting
      ? Math.max(0, Math.min(coachCap, Math.round(coachBase - (liveDeboarded * coachShare) + (liveBoarded * coachShare))))
      : (isDeparted ? Math.max(0, Math.min(coachCap, Math.round(coachBase + (netFlow * coachShare)))) : coachBase);
    const coachLivePct = Math.min(100, Math.round((coachLive / coachCap) * 100));

    const estPax = c.estimatedPassengers ?? (coachBase === 0 ? 0 : Math.min(coachCap, Math.round(coachBase * 1.08)));
    const estPct = c.estimatedOccupancy ?? (coachBase === 0 ? 0 : Math.min(100, Math.round((estPax / coachCap) * 100)));

    return {
      id: c.id,
      label: c.label,
      capacity: coachCap,
      basePax: coachBase,
      livePax: coachLive,
      livePct: coachLivePct,
      estPax,
      estPct,
    };
  });

  return {
    isHalting,
    isDeparted,
    isApproaching,
    isEnRoute,
    secondsRemaining,
    dwellProgressSec,
    timerFormatted,
    totalCapacity,
    basePax,
    livePax,
    liveOccupancyPct,
    deboardTotal,
    boardTotal,
    liveDeboarded,
    liveBoarded,
    netFlow,
    totalEstPax,
    estAvgPct,
    currentStationFullName,
    nextStationFullName,
    coaches,
  };
}

export function useLiveTrainState(train: Train): LiveTrainDwellState;
export function useLiveTrainState(train: Train | null | undefined): LiveTrainDwellState | null;
export function useLiveTrainState(train?: Train | null): LiveTrainDwellState | null {
  const nowMs = useGlobalSecondTick();
  if (!train) return null;
  return computeLiveTrainState(train, nowMs);
}


