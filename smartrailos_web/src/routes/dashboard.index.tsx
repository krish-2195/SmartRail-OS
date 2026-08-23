import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { KpiCard } from "@/components/srail/kpi-card";
import { TrainCard } from "@/components/srail/train-card";
import { ActiveTrainsSlider } from "@/components/srail/active-trains-slider";
import { AnimatedNumber } from "@/components/srail/animated-number";
import { LiveTrainTicker } from "@/components/srail/live-train-ticker";
import {
  TRAINS,
  KPI,
  ALERTS,
} from "@/lib/mock/data";
import {
  useAlerts,
  useKpi,
  useTrains,
  useKpiHistory,
  useStations,
} from "@/lib/api/hooks";
import { computeDelta, occupancyBand } from "@/lib/api/smartrail";
import { USE_MOCK } from "@/lib/api/client";
import { jitter, useLiveTick } from "@/lib/use-live-tick";
import { useAuth } from "@/lib/auth-context";
import {
  TrainFront,
  Users,
  Activity,
  AlertTriangle,
  Sparkles,
  Gauge,
  Building2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Overview · SmartRail OS Command Center" },
      { name: "description", content: "Live operations overview for SmartRail OS." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const trainsQ = useTrains();
  const kpiQ = useKpi();
  const alertsQ = useAlerts();
  const histQ = useKpiHistory();
  const stationsQ = useStations();
  const { user, isAdmin, isOperator, stationId } = useAuth();

  const assignedStation = stationId
    ? stationsQ.data?.find((s) => s.id.toLowerCase() === stationId.toLowerCase())
    : null;
  const assignedStationName = assignedStation?.name || (stationId === "BL11" ? "Old High Court" : stationId || "Assigned Station");

  // Initial skeleton: wait for the first query to resolve when real backend
  // is wired; in mock mode fall back to the original 700ms shimmer so the UX
  // doesn't flash.
  const [mockReady, setMockReady] = useState(!USE_MOCK);
  useEffect(() => {
    if (!USE_MOCK) return;
    const t = setTimeout(() => setMockReady(true), 700);
    return () => clearTimeout(t);
  }, []);
  const loading = USE_MOCK ? !mockReady : kpiQ.isLoading;

  // In mock mode, jitter the KPI so the page feels alive. With a real backend,
  // refetchInterval drives updates and we use the live KPI directly.
  const tick = useLiveTick(3500);
  const [mockKpi, setMockKpi] = useState(KPI);
  useEffect(() => {
    if (!USE_MOCK) return;
    setMockKpi((k) => ({
      ...k,
      currentTrains: jitter(k.currentTrains, 1, 6, 12),
      passengersInStation: jitter(k.passengersInStation, 40, 900, 1900),
      passengersInTransit: jitter(k.passengersInTransit, 120, 2800, 4200),
      avgOccupancy: jitter(k.avgOccupancy, 3, 45, 88),
      predictedNextHour: jitter(k.predictedNextHour, 80, 1600, 2400),
    }));
  }, [tick]);

  if (loading) return <OverviewSkeleton />;

  const trainsRaw = trainsQ.data ?? [];
  
  const alerts = alertsQ.data ?? [];

  // Prioritize active ESP32 / IoT hardware trains to top
  const trains = [...trainsRaw].sort((a, b) => {
    if (a.id === "ESP32_DEMO") return -1;
    if (b.id === "ESP32_DEMO") return 1;
    return 0;
  });

  const blueAlerts = alerts.filter((a: any) => !a.resolved && (a.train_id?.startsWith("BL") || a.station_id?.startsWith("BL")));
  const redAlerts = alerts.filter((a: any) => !a.resolved && (a.train_id?.startsWith("RL") || a.station_id?.startsWith("RL")));
  const blueThroughput = Math.max(92, 100 - blueAlerts.length * 2.2).toFixed(1);
  const redThroughput = Math.max(91, 100 - redAlerts.length * 2.2).toFixed(1);
  const visible = trains.slice(0, 3);
  
  const hist = histQ.data;
  const ago = hist?.hour_ago ?? undefined;

  // Derive real-time corridor metrics from live trains fleet
  const activeFleetCount = trains.length;
  const totalFleetPax = trains.reduce((sum, t) => {
    return sum + (t.coaches || []).reduce((cSum, c) => cSum + (c.passengers ?? Math.round(((c.capacity || 280) * (c.occupancy || 0)) / 100)), 0);
  }, 0);
  const totalFleetCap = trains.reduce((sum, t) => {
    return sum + (t.coaches || []).reduce((cSum, c) => cSum + (c.capacity || 280), 0);
  }, 0) || 1;
  const liveAvgOccupancy = Math.min(100, Math.round((totalFleetPax / totalFleetCap) * 100));

  const kpiData = kpiQ.data;
  const kpi = {
    currentTrains: USE_MOCK ? mockKpi.currentTrains : (kpiData?.currentTrains ?? activeFleetCount),
    passengersInTransit: USE_MOCK ? mockKpi.passengersInTransit : (kpiData?.passengersInTransit ?? totalFleetPax),
    avgOccupancy: USE_MOCK ? mockKpi.avgOccupancy : (kpiData?.avgOccupancy ?? liveAvgOccupancy),
    activeAlerts: alerts.filter((a) => !a.resolved).length,
    predictedNextHour: USE_MOCK ? mockKpi.predictedNextHour : (kpiData?.predictedNextHour ?? Math.round(totalFleetPax * 1.18)),
    passengersInStation: USE_MOCK ? mockKpi.passengersInStation : (kpiData?.passengersInStation ?? 0),
  };

  return (
    <div className="animate-fade-in-up space-y-8 px-4 py-6 md:px-8 md:py-8">
      {/* Role Scoped Mode Banner */}
      {isOperator && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-[#060e18] to-[#04070d] p-4 shadow-lg ring-1 ring-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Station Operator Console Scoped
                </span>
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                  {assignedStationName} {stationId ? `(${stationId})` : ""}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                Operating in station-scoped mode · Live telemetry, incoming trains &amp; alerts are tailored to your station.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs text-emerald-400 font-bold">Live Scoped Feed</span>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-[#0a0714] to-[#05030a] p-4 shadow-lg ring-1 ring-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30">
              <Shield className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  IT Administrator Network Operations Mode
                </span>
                <span className="rounded bg-purple-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-300">
                  Full Corridor Fleet Access
                </span>
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                Complete network telemetry across all 33 stations, 24 rakes &amp; distributed sensor nodes.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-purple-300">
            <span className="size-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="font-bold">Global Sync: 33 Stations Online</span>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Current Trains"
          value={<AnimatedNumber value={kpi.currentTrains} format={(n) => String(Math.round(n)).padStart(2, "0")} />}
          {...computeDelta(kpi.currentTrains, ago?.active_trains)}
          icon={<TrainFront className="size-4" />}
        />
        <KpiCard
          label="In Transit"
          value={<AnimatedNumber value={kpi.passengersInTransit} />}
          {...computeDelta(kpi.passengersInTransit, ago?.passengers_in_transit, " pax")}
          icon={<Activity className="size-4" />}
        />
        <KpiCard
          label="Avg Occupancy"
          value={<AnimatedNumber value={kpi.avgOccupancy} format={(n) => `${Math.round(n)}%`} />}
          delta={occupancyBand(kpi.avgOccupancy).label}
          deltaTone={occupancyBand(kpi.avgOccupancy).tone}
          icon={<Gauge className="size-4" />}
        />
        <KpiCard
          label="Active Alerts"
          value={<AnimatedNumber value={kpi.activeAlerts} format={(n) => String(Math.round(n)).padStart(2, "0")} />}
          delta={`${alerts.filter((a) => a.severity === "Emergency" && !a.resolved).length} critical`}
          deltaTone="negative"
          icon={<AlertTriangle className="size-4" />}
        />
        <KpiCard
          label="Next-Hour Crowd"
          value={<AnimatedNumber value={kpi.predictedNextHour} />}
          delta={kpi.predictedNextHour > (ago?.total_station_crowd ?? 0) * 1.15 ? "Surge expected" : "Stable"}
          deltaTone={kpi.predictedNextHour > (ago?.total_station_crowd ?? 0) * 1.15 ? "warning" : "positive"}
          icon={<Sparkles className="size-4" />}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Column: Active Train Units 1st, Live Network Position 2nd */}
        <div className="space-y-6 xl:col-span-8">
          {/* Active Train Units Side-Slider Carousel */}
          <ActiveTrainsSlider trains={trains} />

          {/* Live Network Position Second */}
          <LiveTrainTicker />
        </div>

        {/* Right Column: Alerts */}
        <aside className="space-y-6 xl:col-span-4">
          {/* Recent Alerts Feed */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#080a0f] p-6 shadow-xl">
            <SectionHeader title="Recent Alerts" right="Live Stream" />
            <ul className="mt-5 space-y-3.5">
              {alerts.filter((a) => !a.resolved).slice(0, 4).map((a) => {
                const isEmergency = a.severity === "Emergency" || a.severity === "Overcrowding";
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "group relative rounded-xl border p-3.5 transition-all duration-200",
                      isEmergency
                        ? "border-rose-500/30 bg-rose-500/10 hover:border-rose-500/50"
                        : "border-white/[0.06] bg-[#050608] hover:border-white/10 hover:bg-[#07090e]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              isEmergency ? "bg-rose-400 animate-ping" : "bg-amber-400"
                            )}
                          />
                          <span className="truncate text-xs font-bold text-white">{a.title}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400 leading-relaxed">{a.description}</div>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-slate-500">{a.time}</span>
                    </div>
                  </li>
                );
              })}
              {alerts.filter((a) => !a.resolved).length === 0 && (
                <div className="flex h-24 flex-col items-center justify-center text-center text-xs text-slate-500">
                  <span className="size-2 rounded-full bg-emerald-400 mb-2" />
                  All transit lines nominal · No active alerts
                </div>
              )}
            </ul>
          </section>

          {/* Interchange Status Card */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#080a0f] p-6 shadow-xl">
            <SectionHeader title="Interchange Hub" right="Platform 1 & 2" />
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#050608] p-3 text-xs">
                <span className="text-slate-300 font-medium">Blue Line Throughput</span>
                <span className="font-mono font-bold text-blue-400">{blueThroughput}% On Time</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#050608] p-3 text-xs">
                <span className="text-slate-300 font-medium">Red Line Throughput</span>
                <span className="font-mono font-bold text-rose-400">{redThroughput}% On Time</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#050608] p-3 text-xs">
                <span className="text-slate-300 font-medium">Station Turnstile Gates</span>
                <span className="font-mono font-bold text-emerald-400">All 12 Active</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-300">
        <span className="size-1.5 rounded-full bg-accent-cyan" />
        {title}
      </h2>
      {right && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{right}</span>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8 px-4 py-6 md:px-8 md:py-8">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border-0 bg-[#141720] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
            <div className={cn("skeleton h-3 w-20")} />
            <div className={cn("skeleton mt-4 h-7 w-24")} />
            <div className={cn("skeleton mt-3 h-2 w-16")} />
          </div>
        ))}
      </section>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-obsidian-900 p-5">
              <div className="flex justify-between">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-20" />
              </div>
              <div className="skeleton mt-4 h-4 w-48" />
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="skeleton h-2 w-full" />
                <div className="skeleton h-2 w-full" />
                <div className="skeleton h-2 w-full" />
              </div>
            </div>
          ))}
        </div>
        <aside className="space-y-4 xl:col-span-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-obsidian-900 p-5">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton mt-3 h-4 w-40" />
              <div className="skeleton mt-2 h-3 w-full" />
              <div className="skeleton mt-4 h-7 w-full" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
