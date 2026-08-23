import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  BLUE_LINE,
  RED_LINE,
  TRAINS,
  findStation,
  riskFor,
  RISK_TW,
  type Train,
  type LineId,
} from "@/lib/mock/data";
import { useTrains } from "@/lib/api/hooks";
import { LineBadge } from "@/components/srail/badges";
import { OccupancyBar } from "@/components/srail/occupancy-bar";
import { formatEta } from "@/lib/use-live-tick";
import { CoachDrillDownSheet } from "@/components/srail/coach-drilldown-sheet";
import { useLiveTrainState, formatFullStationName } from "@/lib/use-live-train-state";
import {
  ArrowRight,
  Search,
  TrainFront,
  Activity,
  Gauge,
  Sparkles,
  ChevronRight,
  Compass,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/live-trains")({
  head: () => ({
    meta: [
      { title: "Live Trains · SmartRail OS Command Center" },
      { name: "description", content: "Real-time active train roster, coach drilldowns, and route progression." },
    ],
  }),
  component: LiveTrainsPage,
});

function LiveTrainsPage() {
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [lineFilter, setLineFilter] = useState<"all" | LineId>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const trainsQ = useTrains();
  const trainsRaw = trainsQ.data ?? [];

  // Filter out ESP32 demo during active fleet hours if real trains exist
  const hasRealTrains = trainsRaw.some((t) => t.id !== "ESP32_DEMO");
  const allTrains = hasRealTrains ? trainsRaw.filter((t) => t.id !== "ESP32_DEMO") : trainsRaw;

  // Live selected train object (reacts to latest API updates)
  const selectedTrain = useMemo(() => {
    if (!selectedTrainId) return null;
    return allTrains.find((t) => t.id === selectedTrainId) ?? null;
  }, [allTrains, selectedTrainId]);

  // Fleet KPIs
  const totalFleet = allTrains.length;
  const inTransitCount = allTrains.filter((t) => t.status === "En Route" || t.status === "Approaching").length;
  const atStationCount = allTrains.filter((t) => t.status === "At Station" || t.status === "Departing").length;
  const avgFleetOccupancy = totalFleet > 0
    ? Math.round(
        allTrains.reduce((acc, t) => {
          const tAvg = t.coaches.length > 0
            ? t.coaches.reduce((s, c) => s + c.occupancy, 0) / t.coaches.length
            : 0;
          return acc + tAvg;
        }, 0) / totalFleet,
      )
    : 0;

  // Filtered Trains
  const filteredTrains = useMemo(() => {
    return allTrains.filter((t) => {
      if (lineFilter !== "all" && t.line !== lineFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const curName = formatFullStationName(t.currentStationId, t.line).toLowerCase();
        const nextName = formatFullStationName(t.nextStationId, t.line).toLowerCase();
        const idMatch = t.id.toLowerCase().includes(q);
        const nameMatch = (t.name || "").toLowerCase().includes(q);
        const dirMatch = (t.direction || "").toLowerCase().includes(q);
        if (!idMatch && !nameMatch && !dirMatch && !curName.includes(q) && !nextName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [allTrains, lineFilter, searchQuery]);

  return (
    <div className="animate-fade-in-up space-y-6 px-4 py-6 md:px-8 md:py-8">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/5 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Live Fleet Telemetry Active · 0ms Synchronized
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white md:text-3xl">
            Live Trains Roster & Drilldown
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Real-time fleet tracking with second-by-second countdown timers and coach flow telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-white/10 bg-obsidian-900/80 px-3 py-1.5 font-mono text-xs font-bold text-accent-cyan shadow-inner">
            {filteredTrains.length} / {totalFleet} Active Units
          </span>
        </div>
      </div>

      {/* Fleet KPI Quick Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-obsidian-900/80 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-widest">Active Units</span>
            <TrainFront className="size-4 text-accent-cyan" />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-white">{totalFleet}</div>
          <div className="mt-1 text-[11px] text-slate-400">Full corridor fleet</div>
        </div>

        <div className="rounded-xl border border-white/5 bg-obsidian-900/80 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-widest">En Route</span>
            <Activity className="size-4 text-blue-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-blue-400">{inTransitCount}</div>
          <div className="mt-1 text-[11px] text-slate-400">In physical transit</div>
        </div>

        <div className="rounded-xl border border-white/5 bg-obsidian-900/80 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-widest">At Platform</span>
            <Compass className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-emerald-400">{atStationCount}</div>
          <div className="mt-1 text-[11px] text-slate-400">Docked & boarding</div>
        </div>

        <div className="rounded-xl border border-white/5 bg-obsidian-900/80 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-widest">Avg Fleet Load</span>
            <Gauge className="size-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-white">{avgFleetOccupancy}%</div>
          <div className="mt-1 text-[11px] text-slate-400">Network-wide load</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Line Filter Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-obsidian-900/80 p-1 backdrop-blur-md">
          <button
            onClick={() => setLineFilter("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              lineFilter === "all"
                ? "bg-white/15 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            All Lines ({allTrains.length})
          </button>
          <button
            onClick={() => setLineFilter("blue")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              lineFilter === "blue"
                ? "bg-blue-600/30 text-blue-400 border border-blue-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <span className="size-2 rounded-full bg-blue-500" />
            Blue Line ({allTrains.filter((t) => t.line === "blue").length})
          </button>
          <button
            onClick={() => setLineFilter("red")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              lineFilter === "red"
                ? "bg-rose-600/30 text-rose-400 border border-rose-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <span className="size-2 rounded-full bg-rose-500" />
            Red Line ({allTrains.filter((t) => t.line === "red").length})
          </button>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search train ID, station, or direction..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-obsidian-900/90 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 transition-all focus:border-accent-cyan/50 focus:outline-none focus:ring-1 focus:ring-accent-cyan/50"
          />
        </div>
      </div>

      {/* Roster Table with Live Ticking Rows */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-obsidian-950/70 shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-white/5 bg-obsidian-900/90 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-5 py-3.5 text-left">Train Unit</th>
                <th className="px-4 py-3.5 text-left">Line & Direction</th>
                <th className="px-4 py-3.5 text-left">Current ➔ Next Station</th>
                <th className="px-4 py-3.5 text-left">Timetable</th>
                <th className="px-4 py-3.5 text-left">Live Fleet Load</th>
                <th className="px-4 py-3.5 text-left">Risk Assessment</th>
                <th className="px-4 py-3.5 text-left">Live Countdown Timer</th>
                <th className="px-5 py-3.5 text-right">Drilldown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allTrains.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
                        <TrainFront className="size-6 text-slate-400" />
                      </div>
                      <div className="text-sm font-bold text-white">Metro Service Closed (Overnight Maintenance)</div>
                      <p className="text-xs text-slate-400">
                        All 24 train units are securely stabled at Vastral Gam & APMC Depots. Passenger service will resume at 06:00 AM.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredTrains.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                    No active train units match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTrains.map((t) => (
                  <LiveTrainRow
                    key={t.id}
                    train={t}
                    onSelect={() => setSelectedTrainId(t.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Coach Drilldown Sheet Modal with Live Ticking Timer */}
      <CoachDrillDownSheet
        train={selectedTrain}
        open={!!selectedTrain}
        onOpenChange={(open) => {
          if (!open) setSelectedTrainId(null);
        }}
      />
    </div>
  );
}

/**
 * Sub-component for individual table row with second-by-second live countdown and passenger updates
 */
function LiveTrainRow({
  train,
  onSelect,
}: {
  train: Train;
  onSelect: () => void;
}) {
  const live = useLiveTrainState(train);
  const risk = riskFor(train);

  const curStation = live?.currentStationFullName ?? formatFullStationName(train.currentStationId, train.line);
  const nextStation = live?.nextStationFullName ?? formatFullStationName(train.nextStationId, train.line);
  const totalCap = live?.totalCapacity ?? 800;
  const livePax = live?.livePax ?? 350;
  const livePct = live?.liveOccupancyPct ?? Math.round((livePax / totalCap) * 100);

  return (
    <tr
      onClick={onSelect}
      className="group cursor-pointer transition-colors hover:bg-white/[0.03]"
    >
      {/* Train Unit ID */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "grid size-8 place-items-center rounded-lg border text-xs font-black font-mono transition-transform group-hover:scale-105",
              train.line === "blue"
                ? "border-blue-500/30 bg-blue-950/40 text-blue-400"
                : "border-rose-500/30 bg-rose-950/40 text-rose-400"
            )}
          >
            <TrainFront className="size-4" />
          </div>
          <div>
            <div className="font-mono text-xs font-extrabold text-accent-cyan">
              {train.id}
            </div>
            <div className="text-[10px] text-slate-400 font-medium line-clamp-1">
              {train.name.replace(`${train.id} · `, "")}
            </div>
          </div>
        </div>
      </td>

      {/* Line & Direction */}
      <td className="px-4 py-4">
        <div className="space-y-1">
          <LineBadge line={train.line} />
          <div className="text-xs font-semibold text-slate-200 line-clamp-1">
            {train.direction}
          </div>
        </div>
      </td>

      {/* Current ➔ Next Station */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-slate-300 line-clamp-1 max-w-[130px]" title={curStation}>
            {curStation}
          </span>
          <ArrowRight className="size-3.5 shrink-0 text-slate-600" />
          <span className="font-semibold text-accent-cyan line-clamp-1 max-w-[130px]" title={nextStation}>
            {nextStation}
          </span>
        </div>
      </td>

      {/* Timetable */}
      <td className="px-4 py-4 font-mono text-xs text-slate-400">
        <div>Arr: <span className="text-slate-300">{train.arrival || "--:--"}</span></div>
        <div>Dep: <span className="text-slate-300">{train.departure || "--:--"}</span></div>
      </td>

      {/* Live Fleet Load */}
      <td className="px-4 py-4">
        <div className="w-36 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-300 font-bold">{livePct}%</span>
            <span className="text-slate-500">{livePax}/{totalCap} pax</span>
          </div>
          <OccupancyBar value={livePct} />
        </div>
      </td>

      {/* Risk Assessment */}
      <td className="px-4 py-4">
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            RISK_TW[risk]
          )}
        >
          {risk}
        </span>
      </td>

      {/* Live Synchronized Countdown Timer */}
      <td className="px-4 py-4 text-xs font-mono">
        {live?.isHalting ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 font-bold text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
            AT PLATFORM · {live.timerFormatted}
          </span>
        ) : live?.isApproaching ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 font-bold text-cyan-400">
            <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
            APPROACHING · {live.timerFormatted}
          </span>
        ) : live?.isDeparted ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-950/40 px-2.5 py-1 font-bold text-purple-400">
            <span className="size-1.5 rounded-full bg-purple-400" />
            DEPARTED · EN ROUTE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-950/40 px-2.5 py-1 font-bold text-blue-400">
            <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
            EN ROUTE · {live?.timerFormatted ?? "ETA 2m"}
          </span>
        )}
      </td>

      {/* Drilldown Action */}
      <td className="px-5 py-4 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition-all hover:border-accent-cyan/40 hover:bg-accent-cyan/10 hover:text-accent-cyan"
        >
          <span>Drilldown</span>
          <ChevronRight className="size-3" />
        </button>
      </td>
    </tr>
  );
}
