import { useTrains } from "@/lib/api/hooks";
import { type Train } from "@/lib/mock/data";
import { LineBadge } from "./badges";
import { cn } from "@/lib/utils";
import { Users, MapPin, DoorOpen, ArrowRight } from "lucide-react";
import { OccupancyBar } from "./occupancy-bar";
import { useLiveTrainState } from "@/lib/use-live-train-state";

function StandingTrainRow({ train }: { train: Train }) {
  const state = useLiveTrainState(train);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#050608] p-4 transition-all duration-300 hover:border-white/10 hover:bg-[#07090e]">
      {/* Top Row: Train ID, Status Pill, Line */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="rounded-md bg-obsidian-800 px-2 py-0.5 font-mono text-xs font-bold text-accent-cyan ring-1 ring-white/10">
            {train.id}
          </span>
          <LineBadge line={train.line} />
        </div>

        {/* Status Indicator */}
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-tight",
            state.isDeparted
              ? "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20"
              : state.isHalting
              ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
              : state.isApproaching
              ? "border border-amber-500/30 bg-amber-500/10 text-amber-300 animate-pulse"
              : "bg-accent-cyan/10 text-accent-cyan ring-1 ring-accent-cyan/20"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              state.isDeparted
                ? "bg-rose-400"
                : state.isHalting
                ? "bg-emerald-400 animate-pulse"
                : state.isApproaching
                ? "bg-amber-400 animate-ping"
                : "bg-accent-cyan"
            )}
          />
          {state.isDeparted
            ? "DEPARTED"
            : state.isHalting
            ? `AT PLATFORM (${state.timerFormatted})`
            : state.isApproaching
            ? `ARRIVING IN ${state.timerFormatted}`
            : `APPROACHING (${state.timerFormatted})`}
        </span>
      </div>

      {/* Station Platform Location Banner */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-200">
          <MapPin className="size-3.5 text-accent-cyan shrink-0" />
          <span className="font-mono text-[11px] font-bold tracking-tight text-white">
            {state.isApproaching || state.isEnRoute
              ? state.nextStationFullName
              : state.currentStationFullName}
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">
          {train.direction}
        </span>
      </div>

      {/* Live Passenger Flow Delta Badges */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div
          className={cn(
            "flex items-center justify-between rounded-md border px-2 py-1 transition-all",
            state.isHalting && state.dwellProgressSec > 15
              ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          )}
        >
          <span className="font-medium flex items-center gap-1">
            {state.isHalting && state.dwellProgressSec > 15 && (
              <span className="size-1 rounded-full bg-emerald-400 animate-ping" />
            )}
            Boarding
          </span>
          <span className="font-extrabold font-mono">
            {state.isHalting && state.dwellProgressSec > 15
              ? `+${state.liveBoarded} / +${state.boardTotal}`
              : `+${state.boardTotal}`} pax
          </span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between rounded-md border px-2 py-1 transition-all",
            state.isHalting && state.dwellProgressSec <= 15
              ? "border-rose-400 bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40"
              : "border-rose-500/20 bg-rose-500/10 text-rose-400"
          )}
        >
          <span className="font-medium flex items-center gap-1">
            {state.isHalting && state.dwellProgressSec <= 15 && (
              <span className="size-1 rounded-full bg-rose-400 animate-ping" />
            )}
            Alighting
          </span>
          <span className="font-extrabold font-mono">
            {state.isHalting && state.dwellProgressSec <= 15
              ? `-${state.liveDeboarded} / -${state.deboardTotal}`
              : `-${state.deboardTotal}`} pax
          </span>
        </div>
      </div>

      {/* Passenger Load Section */}
      <div className="mt-2.5 rounded-lg bg-black/20 p-2.5 ring-1 ring-white/5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-medium text-slate-400">
            <Users className="size-3.5 text-slate-400" />
            Onboard Passengers
          </span>
          <span className="font-mono font-extrabold text-white">
            {state.livePax.toLocaleString()}{" "}
            <span className="text-[10px] font-normal text-slate-400">
              / {state.totalCapacity}
            </span>
          </span>
        </div>

        {/* Capacity Bar */}
        <div className="mt-2">
          <OccupancyBar value={state.liveOccupancyPct} />
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span
            className={cn(
              "font-semibold",
              state.netFlow >= 0 ? "text-emerald-400" : "text-amber-400"
            )}
          >
            {state.netFlow >= 0
              ? `▲ +${state.netFlow} Net Flow`
              : `▼ ${state.netFlow} Net Flow`}
          </span>
          <span
            className={cn(
              "font-bold",
              state.liveOccupancyPct > 80 ? "text-amber-400" : "text-emerald-400"
            )}
          >
            {state.liveOccupancyPct}% Capacity
          </span>
        </div>
      </div>
    </div>
  );
}

export function StandingTrainsCard({
  className,
  stationId,
  stationName,
}: {
  className?: string;
  stationId?: string;
  stationName?: string;
}) {
  const trainsQ = useTrains();
  const trainsRaw = trainsQ.data ?? [];
  const trains = trainsRaw.filter((t) => t.id !== "ESP32_DEMO");

  const isMatchStation = (tStationId?: string | null) => {
    if (!tStationId) return false;
    if (stationId && tStationId.toLowerCase() === stationId.toLowerCase()) return true;
    if (stationName && tStationId.toLowerCase().includes(stationName.toLowerCase())) return true;
    return false;
  };

  // Filter both docked/berthed trains and arriving/approaching trains
  const relevantTrains = trains.filter((t) => {
    if (stationId || stationName) {
      const matchCur = isMatchStation(t.currentStationId);
      const matchNext = isMatchStation(t.nextStationId);
      return matchCur || matchNext;
    }
    const isBerthed = t.status === "At Station" || t.status === "Departing" || (t.etaSeconds !== undefined && t.etaSeconds <= 8);
    const isArriving = t.status === "Approaching" || (t.etaSeconds !== undefined && t.etaSeconds <= 120);
    return isBerthed || isArriving;
  });

  // Sort: Berthed first, then arriving by closest ETA
  const sortedTrains = [...relevantTrains].sort((a, b) => {
    const aBerthed = a.status === "At Station" || a.status === "Departing";
    const bBerthed = b.status === "At Station" || b.status === "Departing";
    if (aBerthed && !bBerthed) return -1;
    if (!aBerthed && bBerthed) return 1;
    return (a.etaSeconds ?? 0) - (b.etaSeconds ?? 0);
  });

  const displayTrains = sortedTrains.length > 0 ? sortedTrains.slice(0, 4) : (trains.length > 0 ? trains.slice(0, 3) : []);
  const berthedCount = trains.filter((t) => t.status === "At Station" || t.status === "Departing").length;
  const arrivingCount = trains.filter((t) => t.status === "Approaching" || (t.etaSeconds != null && t.etaSeconds <= 120 && t.status !== "At Station")).length;

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-[#080a0f] p-5 shadow-xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <h3 className="flex items-center gap-2.5 text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          Station Platform Berths & Flow
        </h3>
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold">
          {berthedCount > 0 && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400 ring-1 ring-emerald-500/20">
              {berthedCount} Berthed
            </span>
          )}
          {arrivingCount > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/20">
              {arrivingCount} Arriving
            </span>
          )}
          {berthedCount === 0 && arrivingCount === 0 && (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">
              {trains.length} Active
            </span>
          )}
        </div>
      </div>

      {/* Train Cards List */}
      <div className="mt-4 space-y-3.5">
        {trains.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-white/5 bg-[#050608] p-4 text-center">
            <DoorOpen className="mb-2 size-5 text-slate-500" />
            <p className="text-xs font-bold text-white">Platform Gates Closed</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Overnight maintenance active. Platform boarding resumes at 06:00 AM.
            </p>
          </div>
        ) : displayTrains.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-obsidian-900/50 text-center">
            <DoorOpen className="mb-2 size-5 text-slate-500" />
            <p className="text-xs font-semibold text-slate-300">Platforms Clear</p>
            <p className="text-[11px] text-slate-500">
              All trains currently en route between stations.
            </p>
          </div>
        ) : (
          displayTrains.map((train) => (
            <StandingTrainRow key={train.id} train={train} />
          ))
        )}
      </div>
    </div>
  );
}
