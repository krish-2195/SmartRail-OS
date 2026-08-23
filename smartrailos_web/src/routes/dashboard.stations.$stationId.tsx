import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Building2, TrainFront, Users, Activity, Sparkles, AlertOctagon, DoorOpen } from "lucide-react";
import { TrainCard } from "@/components/srail/train-card";
import { OccupancyBar } from "@/components/srail/occupancy-bar";
import { KpiCard } from "@/components/srail/kpi-card";
import { AnimatedNumber } from "@/components/srail/animated-number";
import { ActiveTrainsSlider } from "@/components/srail/active-trains-slider";
import { LiveTrainTicker } from "@/components/srail/live-train-ticker";
import { useStations, useTrains, useAlerts, useStationCurrent, useStationFeature } from "@/lib/api/hooks";
import { findStation, TRAINS, type Train } from "@/lib/mock/data";
import { SectionHeader } from "@/routes/dashboard.index";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/stations/$stationId")({
  head: ({ params }) => ({
    meta: [
      { title: `Station ${params.stationId} · SmartRail OS` },
      {
        name: "description",
        content: `Live trains, occupancy and platform activity for station ${params.stationId}.`,
      },
    ],
  }),
  component: StationOverviewPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-10 text-sm text-danger" role="alert">
      Failed to load station: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-10 text-sm text-slate-400">
      Station not found.{" "}
      <Link to="/dashboard/stations" className="text-accent-cyan hover:underline">
        Back to all stations
      </Link>
    </div>
  ),
});

function StationOverviewPage() {
  const { stationId } = Route.useParams();
  const stationsQ = useStations();
  const trainsQ = useTrains();
  const alertsQ = useAlerts();
  const stationCurrentQ = useStationCurrent(stationId);
  const stationFeatureQ = useStationFeature(stationId);

  if (stationsQ.isLoading && !stationsQ.data) {
    return <StationDetailSkeleton />;
  }

  const station = stationsQ.data?.find((s) => s.id.toLowerCase() === stationId.toLowerCase()) || findStation(stationId);
  if (stationsQ.isSuccess && !station) throw notFound();

  const targetStation = findStation(stationId) || station;
  const isMatchStation = (trainStationIdOrName?: string | null) => {
    if (!trainStationIdOrName) return false;
    if (trainStationIdOrName.toLowerCase() === stationId.toLowerCase()) return true;
    if (targetStation) {
      if (trainStationIdOrName.toLowerCase() === targetStation.id.toLowerCase()) return true;
      if (trainStationIdOrName.toLowerCase() === targetStation.name.toLowerCase()) return true;
    }
    const resolved = findStation(trainStationIdOrName);
    return Boolean(resolved && targetStation && resolved.id === targetStation.id);
  };

  const rawTrains = trainsQ.data ?? [];
  const allTrains = rawTrains.length > 0 ? rawTrains : [];
  
  // Trains servicing this station (currently dwelling or inbound)
  const stationTrains = allTrains.filter(
    (t) => isMatchStation(t.currentStationId) || isMatchStation(t.nextStationId) || t.line === station?.line,
  );

  const atStation = allTrains.filter((t) => isMatchStation(t.currentStationId));
  const approaching = allTrains.filter((t) => isMatchStation(t.nextStationId));

  const allCoaches = stationTrains.flatMap((t) => t.coaches || []);
  const avgOccupancy =
    allCoaches.length > 0
      ? Math.round(
          allCoaches.reduce((a, c) => a + (c.occupancy || 0), 0) / allCoaches.length,
        )
      : 0;

  const currentData = stationCurrentQ.data;
  const platformPax = currentData?.current_passenger_count ?? 0;
  
  const featureDataArray = Array.isArray(stationFeatureQ.data)
    ? stationFeatureQ.data
    : stationFeatureQ.data
    ? [stationFeatureQ.data]
    : [];

  const topFeatures = [...featureDataArray]
    .sort((a, b) => {
      if (!a.estimated_arrival_time) return 1;
      if (!b.estimated_arrival_time) return -1;
      return a.estimated_arrival_time.localeCompare(b.estimated_arrival_time);
    })
    .slice(0, 4);

  const predictedNextHourPax = topFeatures.length > 0
    ? topFeatures.reduce((acc, f) => acc + (f.estimated_boarding || 0) + (f.estimated_station_passenger_count || 0), 0)
    : Math.round(platformPax * 1.15);

  // Alerts specific to this station
  const allAlerts = alertsQ.data ?? [];
  const stationAlerts = allAlerts.filter(
    (a) =>
      a.stationName?.toLowerCase().includes((station?.name || "").toLowerCase()) ||
      a.description?.toLowerCase().includes((station?.name || "").toLowerCase()) ||
      a.title?.toLowerCase().includes((station?.name || "").toLowerCase()),
  );
  const activeStationAlerts = stationAlerts.filter((a) => !a.resolved);

  return (
    <div className="animate-fade-in-up space-y-8 px-4 py-6 md:px-8 md:py-8">
      {/* Station Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <Link
          to="/dashboard/stations"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:border-accent-cyan/50 hover:bg-accent-cyan/10 hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          <span>All Stations Directory</span>
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
              station?.line === "blue"
                ? "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20"
                : "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20"
            )}
          >
            <span className="size-1.5 rounded-full bg-current animate-pulse" />
            {station?.line === "blue" ? "Blue Line" : "Red Line"} · Station ID {stationId}
          </span>
        </div>
      </div>

      {/* 5 Top Station KPI Cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Current Trains"
          value={<AnimatedNumber value={atStation.length + approaching.length} format={(n) => String(Math.round(n)).padStart(2, "0")} />}
          delta={atStation.length > 0 ? `${atStation.length} berthed` : "0 in dwell"}
          deltaTone="positive"
          icon={<TrainFront className="size-4" />}
        />
        <KpiCard
          label="In Transit"
          value={<AnimatedNumber value={platformPax} />}
          delta={`${approaching.length} approaching`}
          deltaTone="positive"
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Avg Occupancy"
          value={<AnimatedNumber value={avgOccupancy} format={(n) => `${Math.round(n)}%`} />}
          delta={avgOccupancy >= 75 ? "High load" : "Optimal"}
          deltaTone={avgOccupancy >= 75 ? "warning" : "positive"}
          icon={<Activity className="size-4" />}
        />
        <KpiCard
          label="Active Alerts"
          value={<AnimatedNumber value={activeStationAlerts.length} format={(n) => String(Math.round(n)).padStart(2, "0")} />}
          delta={activeStationAlerts.length > 0 ? "Requires action" : "Nominal"}
          deltaTone={activeStationAlerts.length > 0 ? "negative" : "positive"}
          icon={<AlertOctagon className="size-4" />}
        />
        <KpiCard
          label="Next-Hour Crowd"
          value={<AnimatedNumber value={predictedNextHourPax} />}
          delta="Forecast"
          deltaTone="positive"
          icon={<Sparkles className="size-4" />}
        />
      </section>

      {/* Overview Main Body (12 Columns Grid) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Column: Active Train Units 1st, Live Network Position 2nd, Predictions Table 3rd */}
        <div className="space-y-6 xl:col-span-8">
          {/* Active Train Units Side-Slider Carousel */}
          <ActiveTrainsSlider trains={stationTrains} stationLine={station?.line} />

          {/* Live Network Position Ticker */}
          <LiveTrainTicker stationLine={station?.line} />

          {/* Station Feature & ML Predictions Table */}
          <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#080a0f] p-6 shadow-xl">
            <SectionHeader
              title={`${station?.name || stationId} · Inbound Predictions`}
              right="Live ML Horizon"
            />
            <div className="overflow-hidden rounded-xl border border-white/5 bg-obsidian-900/50 backdrop-blur-md">
              <table className="w-full border-collapse text-left text-sm text-slate-300">
                <thead className="bg-obsidian-950/80 font-mono text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/5">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Upcoming Train</th>
                    <th className="px-4 py-3.5 font-semibold">Est. Arrival</th>
                    <th className="px-4 py-3.5 font-semibold">Incoming</th>
                    <th className="px-4 py-3.5 font-semibold text-rose-400">Alighting</th>
                    <th className="px-4 py-3.5 font-semibold text-emerald-400">Boarding</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-xs">
                  {topFeatures.length > 0 ? (
                    topFeatures.map((f, i) => (
                      <tr key={f.train_id || i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 font-bold text-accent-cyan flex items-center gap-2">
                          <span className="size-2 rounded-full bg-accent-cyan animate-pulse" />
                          {f.train_id}
                        </td>
                        <td className="px-4 py-3 text-white font-semibold">
                          {f.estimated_arrival_time || "--:--"}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {f.estimated_passenger_incoming?.toLocaleString() ?? 0}
                        </td>
                        <td className="px-4 py-3 text-rose-400">
                          -{f.estimated_alighting?.toLocaleString() ?? 0}
                        </td>
                        <td className="px-4 py-3 text-emerald-400">
                          +{f.estimated_boarding?.toLocaleString() ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 font-sans">
                          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
                            94.8% ML
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-sans text-xs italic">
                        No upcoming train predictions available for this station.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column: Station Alerts Feed */}
        <aside className="space-y-6 xl:col-span-4">
          {/* Recent Station Alerts Feed */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#080a0f] p-6 shadow-xl">
            <SectionHeader title="Station Alerts" right="Live Stream" />
            <ul className="mt-5 space-y-3.5">
              {activeStationAlerts.slice(0, 4).map((a) => {
                const isEmergency = a.severity === "Emergency" || a.severity === "Overcrowding" || a.severity === "Platform Congestion";
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
              {activeStationAlerts.length === 0 && (
                <div className="flex h-24 flex-col items-center justify-center text-center text-xs text-slate-500">
                  <span className="size-2 rounded-full bg-emerald-400 mb-2" />
                  Station platforms nominal · No active alerts
                </div>
              )}
            </ul>
          </section>

          {/* Station Hub Summary Card */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#080a0f] p-6 shadow-xl">
            <SectionHeader title="Platform Status" right="Live Gates" />
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#050608] p-3 text-xs">
                <span className="text-slate-300 font-medium">Turnstile Inflow</span>
                <span className="font-mono font-bold text-emerald-400">Normal Flow</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#050608] p-3 text-xs">
                <span className="text-slate-300 font-medium">Platform 1 &amp; 2 Dwell</span>
                <span className="font-mono font-bold text-accent-cyan">30s Standard</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StationDetailSkeleton() {
  return (
    <div className="space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div className="skeleton h-6 w-40" />
      <div className="skeleton h-8 w-72" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-obsidian-900 p-5">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-3 h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="skeleton h-40 w-full rounded-xl" />
    </div>
  );
}
