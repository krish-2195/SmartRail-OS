import { useState } from "react";
import { cn } from "@/lib/utils";
import { OccupancyBar } from "./occupancy-bar";
import { LineBadge, RiskBadge } from "./badges";
import { type Train } from "@/lib/mock/data";
import { useLiveTrainState } from "@/lib/use-live-train-state";
import { ArrowRight, ChevronRight, Sparkles, Clock, Timer } from "lucide-react";
import { CoachDrillDownSheet } from "./coach-drilldown-sheet";

export function TrainCard({ train, className }: { train: Train; className?: string }) {
  const [open, setOpen] = useState(false);
  const state = useLiveTrainState(train);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View coach details for train ${train.id}`}
        className={cn(
          "group relative block w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080a0f] p-6 text-left shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-accent-cyan/40 hover:shadow-2xl hover:shadow-accent-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60",
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-60" />

        {/* Top Bar: Train ID, Line Badge, Risk Badge, Timer Badge */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded bg-obsidian-800 px-2 py-1 font-mono text-xs font-bold text-accent-cyan">
              {train.id}
            </span>
            <LineBadge line={train.line} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge train={train} />

            {/* Dynamic Status & Timer Badge */}
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1 font-mono text-xs font-extrabold shadow-sm transition-colors",
                state.isDeparted
                  ? "border-rose-500/50 bg-rose-500/20 text-rose-300 shadow-rose-500/20"
                  : state.isHalting
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-amber-500/10"
                    : state.isApproaching
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300 shadow-amber-500/10 animate-pulse"
                      : "border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan shadow-accent-cyan/10"
              )}
            >
              <Clock
                className={cn(
                  "size-3.5",
                  state.isDeparted
                    ? "text-rose-400"
                    : state.isHalting || state.isApproaching
                      ? "text-amber-400"
                      : "text-accent-cyan",
                  "animate-pulse"
                )}
              />
              <span>
                {state.isDeparted
                  ? "DEPARTED · EN ROUTE"
                  : state.isHalting
                    ? `STATION HALT · ${state.timerFormatted} LEFT`
                    : state.isApproaching
                      ? `ARRIVES IN ${state.timerFormatted}`
                      : `EN ROUTE · ETA ${state.timerFormatted}`}
              </span>
            </div>
          </div>
        </div>

        {/* Direction & Timetable Info */}
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-bold text-white group-hover:text-accent-cyan transition-colors">
            {train.direction}
          </h3>

          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-bold",
                state.isDeparted
                  ? "border-rose-500/40 bg-rose-500/15 text-rose-400"
                  : state.isHalting
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : state.isApproaching
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : "border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan"
              )}
            >
              <Timer className="size-3 animate-spin" style={{ animationDuration: "6s" }} />
              <span>
                {state.isDeparted
                  ? `Departed · Next: ${state.nextStationFullName}`
                  : state.isHalting
                    ? `Halt: ${state.timerFormatted}`
                    : `ETA: ${state.timerFormatted}`}
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              <span className="text-slate-500">Arr</span> {train.arrival} · <span className="text-slate-500">Dep</span> {train.departure}
            </div>
          </div>
        </div>

        {/* Location & Routing Route Banner */}
        <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-300 font-medium">
            {state.isDeparted
              ? `Departed: ${state.currentStationFullName}`
              : state.isHalting
                ? `At Platform: ${state.currentStationFullName}`
                : state.currentStationFullName}
          </span>
          <ArrowRight className="size-3 text-slate-600" />
          <span className="text-accent-cyan font-semibold">
            {state.isDeparted
              ? `En Route to: ${state.nextStationFullName}`
              : state.isHalting
                ? `Next Departure: ${state.nextStationFullName}`
                : `Heading to: ${state.nextStationFullName}`}
          </span>
        </div>

        {/* Live Passenger Flow Badges (Boarding, Alighting, Net Flow) */}
        <div className="mt-4 grid grid-cols-3 gap-2.5 text-xs font-mono">
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-1.5 transition-all",
              state.isHalting && state.dwellProgressSec > 15
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            )}
          >
            <span className="text-[10px] uppercase font-semibold text-emerald-300 flex items-center gap-1">
              {state.isHalting && state.dwellProgressSec > 15 && (
                <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
              Boarding
            </span>
            <span className="font-extrabold font-mono text-xs">
              {state.isHalting && state.dwellProgressSec > 15
                ? `+${state.liveBoarded} / +${state.boardTotal}`
                : `+${state.boardTotal}`} pax
            </span>
          </div>

          <div
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-1.5 transition-all",
              state.isHalting && state.dwellProgressSec <= 15
                ? "border-rose-400 bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40"
                : "border-rose-500/20 bg-rose-500/10 text-rose-400"
            )}
          >
            <span className="text-[10px] uppercase font-semibold text-rose-300 flex items-center gap-1">
              {state.isHalting && state.dwellProgressSec <= 15 && (
                <span className="size-1.5 rounded-full bg-rose-400 animate-ping" />
              )}
              Alighting
            </span>
            <span className="font-extrabold font-mono text-xs">
              {state.isHalting && state.dwellProgressSec <= 15
                ? `-${state.liveDeboarded} / -${state.deboardTotal}`
                : `-${state.deboardTotal}`} pax
            </span>
          </div>

          <div
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-1.5",
              state.netFlow >= 0
                ? "border-accent-cyan/20 bg-accent-cyan/10 text-accent-cyan"
                : "border-amber-500/20 bg-amber-500/10 text-amber-400"
            )}
          >
            <span className="text-[10px] uppercase font-semibold">Net Flow</span>
            <span className="font-extrabold font-mono text-xs">
              {state.netFlow >= 0 ? `▲ +${state.netFlow}` : `▼ ${state.netFlow}`} pax
            </span>
          </div>
        </div>

        {/* Estimated Departure Passenger Count at Old High Court Banner */}
        {/* <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent-cyan/15 bg-accent-cyan/[0.04] px-3.5 py-2">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="size-3.5 text-accent-cyan shrink-0" />
            <span className="text-slate-300 font-medium text-[11px]">
              Est. Departure <span className="text-slate-500 font-normal">({state.currentStationFullName || state.nextStationFullName || "Next Station"})</span>:
            </span>
            <span className="font-mono text-xs font-bold text-accent-cyan">
              {state.totalEstPax.toLocaleString()} pax
            </span>
            <span className="font-mono text-[10px] text-accent-cyan/70">
              ({state.estAvgPct}%)
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-slate-300" />
              Live: <strong className="text-white font-bold">{state.livePax.toLocaleString()}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-accent-cyan" />
              Est: <strong className="text-accent-cyan font-bold">{state.totalEstPax.toLocaleString()}</strong>
            </span>
          </div>
        </div> */}

        {/* Coach Occupancy Dual-Bar Breakdown (Live Real-Time vs ML Estimated Departure) */}
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {state.coaches.map((c) => (
            <div
              key={c.id}
              className="space-y-2 rounded-xl border border-white/[0.06] bg-[#050608] p-3 shadow-inner"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-white">
                <span>{c.label}</span>
                <span className="font-mono text-[10px] font-normal text-slate-400">
                  Max {c.capacity}
                </span>
              </div>

              {/* Bar 1: Real-Time Live Occupancy */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="size-1 rounded-full bg-slate-300" />
                    Live
                  </span>
                  <span className="font-bold text-slate-200">
                    {c.livePax} pax ({c.livePct}%)
                  </span>
                </div>
                <OccupancyBar
                  value={c.livePct}
                  showPaxCount={false}
                  className="space-y-0"
                />
              </div>

              {/* Bar 2: ML Estimated Departure Occupancy */}
              <div className="space-y-1 pt-1 border-t border-white/5">
                <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-accent-cyan/90">
                  <span className="flex items-center gap-1">
                    <Sparkles className="size-2.5 text-accent-cyan" />
                    Est. Dep
                  </span>
                  <span className="font-bold text-accent-cyan">
                    {c.estPax} pax ({c.estPct}%)
                  </span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-inset ring-white/5">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 ease-out",
                      c.estPct < 50
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : c.estPct < 75
                          ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                          : c.estPct < 90
                            ? "bg-gradient-to-r from-orange-500 to-amber-500"
                            : "bg-gradient-to-r from-rose-500 to-red-500",
                    )}
                    style={{ width: `${c.estPct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors group-hover:text-accent-cyan">
          View full coach breakdown
          <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </button>
      <CoachDrillDownSheet train={train} open={open} onOpenChange={setOpen} />
    </>
  );
}
