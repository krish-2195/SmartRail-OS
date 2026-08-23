import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OccupancyBar } from "./occupancy-bar";
import { LineBadge } from "./badges";
import { RouteTimeline } from "./route-timeline";
import {
  findStation,
  OCC_TEXT,
  OCC_TW,
  statusFromOccupancy,
  type CoachStatus,
  type Train,
} from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import {
  useLiveTrainState,
  formatFullStationName,
} from "@/lib/use-live-train-state";
import {
  ArrowRight,
  Users,
  Gauge,
  AlertTriangle,
  Sparkles,
  TrainFront,
  Clock,
  UserMinus,
  UserPlus,
  Compass,
  Zap,
} from "lucide-react";

const STATUS_LABEL: Record<CoachStatus, string> = {
  low: "Comfortable",
  moderate: "Filling Up",
  high: "Heavy",
  critical: "Critical",
};

export function CoachDrillDownSheet({
  train,
  open,
  onOpenChange,
}: {
  train: Train | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Synchronized 0ms live timer and dwell passenger flow
  const liveState = useLiveTrainState(train);

  const stats = useMemo(() => {
    if (!train) return null;
    const coaches = liveState?.coaches || train.coaches || [];
    const totalCapacity = liveState?.totalCapacity ?? coaches.reduce((a: number, c: any) => a + c.capacity, 0);
    const totalOnboard = liveState?.livePax ?? coaches.reduce(
      (a: number, c: any) => a + Math.round((c.capacity * (c.livePct ?? c.occupancy ?? 0)) / 100),
      0,
    );
    const avg = liveState?.liveOccupancyPct ?? (
      coaches.length > 0
        ? Math.round(coaches.reduce((a: number, c: any) => a + (c.livePct ?? c.occupancy ?? 0), 0) / coaches.length)
        : 0
    );
    const fullest = [...coaches].sort((a: any, b: any) => (b.livePct ?? b.occupancy) - (a.livePct ?? a.occupancy))[0];
    const emptiest = [...coaches].sort((a: any, b: any) => (a.livePct ?? a.occupancy) - (b.livePct ?? b.occupancy))[0];
    return { totalCapacity, totalOnboard, avg, fullest, emptiest };
  }, [train, liveState]);

  const currentName = liveState?.currentStationFullName ?? formatFullStationName(train?.currentStationId, train?.line);
  const nextName = liveState?.nextStationFullName ?? formatFullStationName(train?.nextStationId, train?.line);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-white/10 bg-obsidian-950 p-0 text-slate-200 shadow-2xl sm:max-w-xl"
      >
        {train && stats && (
          <>
            <SheetHeader className="space-y-3 border-b border-white/5 bg-obsidian-900 px-6 py-5 text-left">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-obsidian-800 px-2 py-1 font-mono text-xs font-bold text-accent-cyan ring-1 ring-white/10">
                    {train.id}
                  </span>
                  <LineBadge line={train.line} />
                </div>

                {/* Live Synchronized Status & Timer Badge */}
                {liveState?.isHalting ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-bold text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                    AT PLATFORM · {liveState.timerFormatted}
                  </span>
                ) : liveState?.isApproaching ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] font-bold text-cyan-400">
                    <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
                    APPROACHING · {liveState.timerFormatted}
                  </span>
                ) : liveState?.isDeparted ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 font-mono text-[11px] font-bold text-purple-400">
                    <span className="size-2 rounded-full bg-purple-400" />
                    DEPARTED · EN ROUTE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 font-mono text-[11px] font-bold text-blue-400">
                    <span className="size-2 rounded-full bg-blue-400 animate-pulse" />
                    EN ROUTE · {liveState?.timerFormatted ?? "ETA 2m"}
                  </span>
                )}
              </div>

              <SheetTitle className="text-xl font-black leading-tight text-white">
                {train.direction}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-400">
                <span className="text-slate-300 font-medium">{currentName}</span>
                <ArrowRight className="mx-1.5 inline size-3 text-slate-600" />
                <span className="text-accent-cyan font-semibold">{nextName}</span>
                <span className="ml-3 font-mono text-slate-500">
                  Arr {train.arrival} · Dep {train.departure}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-6 py-6">
              {/* Live Synchronized Dwell Timer & Passenger Flow Banner */}
              <div className="rounded-2xl border border-accent-cyan/20 bg-gradient-to-br from-accent-cyan/10 via-obsidian-900/60 to-obsidian-900 p-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-accent-cyan/20 text-accent-cyan ring-1 ring-accent-cyan/40">
                      <Clock className="size-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-accent-cyan flex items-center gap-1.5">
                        <Zap className="size-3 text-accent-cyan animate-pulse" />
                        {liveState?.isHalting
                          ? (liveState.dwellProgressSec <= 15 ? "Dwell Alighting Phase 🔴" : "Dwell Boarding Phase 🟢")
                          : (liveState?.isApproaching ? "Approaching Platform ⚡" : "Transit Telemetry 🛰️")}
                      </div>
                      <div className="text-lg font-black text-white font-mono">
                        {liveState?.isHalting
                          ? `${liveState.secondsRemaining}s Dwell Remaining`
                          : (liveState?.isDeparted ? "Departed Station" : `ETA ${liveState?.timerFormatted ?? "1m 30s"}`)}
                      </div>
                    </div>
                  </div>

                  {/* Flow Delta Badges */}
                  <div className="flex items-center gap-2 font-mono text-xs">
                    {liveState?.isHalting ? (
                      <>
                        <div className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-950/40 px-2.5 py-1 text-rose-400">
                          <UserMinus className="size-3" />
                          <span>-{liveState.liveDeboarded} / {liveState.deboardTotal}</span>
                        </div>
                        <div className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-emerald-400">
                          <UserPlus className="size-3" />
                          <span>+{liveState.liveBoarded} / {liveState.boardTotal}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-obsidian-900 px-3 py-1 text-slate-300">
                        <Compass className="size-3.5 text-accent-cyan" />
                        <span>Net Flow: {liveState?.netFlow && liveState.netFlow >= 0 ? `+${liveState.netFlow}` : liveState?.netFlow ?? 0} pax</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar during dwell */}
                {liveState?.isHalting && (
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-1000 ease-linear"
                        style={{ width: `${Math.min(100, (liveState.dwellProgressSec / 30) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Route Timeline Component with Next Stations List */}
              <RouteTimeline train={train} />

              {/* Summary KPIs */}
              <section className="grid grid-cols-2 gap-3">
                <SummaryTile
                  icon={<Users className="size-3.5" />}
                  label="Live Onboard"
                  value={stats.totalOnboard.toLocaleString()}
                  sub={`of ${stats.totalCapacity.toLocaleString()} seats`}
                />
                <SummaryTile
                  icon={<Gauge className="size-3.5" />}
                  label="Avg Occupancy"
                  value={`${stats.avg}%`}
                  sub={STATUS_LABEL[statusFromOccupancy(stats.avg)]}
                  tone={statusFromOccupancy(stats.avg)}
                />
                <SummaryTile
                  icon={<AlertTriangle className="size-3.5" />}
                  label="Fullest Coach"
                  value={stats.fullest?.label ?? "—"}
                  sub={`${(stats.fullest as any)?.livePct ?? (stats.fullest as any)?.occupancy ?? 0}% full`}
                  tone={statusFromOccupancy((stats.fullest as any)?.livePct ?? (stats.fullest as any)?.occupancy ?? 0)}
                />
                <SummaryTile
                  icon={<Sparkles className="size-3.5" />}
                  label="Most Capacity"
                  value={stats.emptiest?.label ?? "—"}
                  sub={`${(stats.emptiest as any)?.livePct ?? (stats.emptiest as any)?.occupancy ?? 0}% full`}
                  tone={statusFromOccupancy((stats.emptiest as any)?.livePct ?? (stats.emptiest as any)?.occupancy ?? 0)}
                />
              </section>

              {/* 3-Coach Detailed Telemetry */}
              <section>
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-300">
                  <span className="size-1.5 rounded-full bg-accent-cyan" />
                  Coach Breakdown & Live Occupancy
                  <span className="ml-auto font-mono text-[10px] text-slate-500">
                    {(liveState?.coaches || train.coaches).length} coaches · 800 seats
                  </span>
                </h3>
                <ul className="mt-4 space-y-3">
                  {(liveState?.coaches || train.coaches).map((c: any) => {
                    const occPct = c.livePct ?? c.occupancy ?? 0;
                    const status = statusFromOccupancy(occPct);
                    const onboard = c.livePax ?? Math.round((c.capacity * occPct) / 100);
                    return (
                      <li
                        key={c.id}
                        className="rounded-xl border border-white/5 bg-obsidian-900/90 p-4 backdrop-blur-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "grid size-9 place-items-center rounded-lg bg-obsidian-800 border border-white/5",
                                OCC_TEXT[status],
                              )}
                            >
                              <TrainFront className="size-4" />
                            </span>
                            <div>
                              <div className="text-sm font-bold text-white">
                                {c.label}
                              </div>
                              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                                {onboard.toLocaleString()} / {c.capacity.toLocaleString()} pax ({occPct}%)
                              </div>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                              `${OCC_TW[status]}/15`,
                              OCC_TEXT[status],
                            )}
                          >
                            <span
                              className={cn("size-1.5 rounded-full", OCC_TW[status])}
                            />
                            {STATUS_LABEL[status]}
                          </span>
                        </div>
                        <div className="mt-3">
                          <OccupancyBar value={occPct} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Station Boarding & Deboarding Predictions */}
              <section className="rounded-xl border border-white/5 bg-obsidian-900/80 p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
                  Predicted Flow At Next Station
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                      Predicted Boarding
                    </div>
                    <div className="mt-1 font-mono text-lg font-black text-emerald-400">
                      +{train.predictedBoarding || 18} pax
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                      Predicted Deboarding
                    </div>
                    <div className="mt-1 font-mono text-lg font-black text-rose-400">
                      −{train.predictedDeboarding || 12} pax
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: CoachStatus;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-obsidian-900/90 p-3.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-lg font-black tabular-nums font-mono",
          tone ? OCC_TEXT[tone] : "text-white",
        )}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] text-slate-500">{sub}</div>
    </div>
  );
}
