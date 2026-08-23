import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ArrowRight, Loader2, TrainFront, Layers, ShieldCheck } from "lucide-react";
import { useStations, useTrains } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { SectionHeader } from "@/routes/dashboard.index";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/stations/")({
  head: () => ({
    meta: [
      { title: "Stations · SmartRail OS" },
      {
        name: "description",
        content:
          "Browse every Ahmedabad Metro station across Blue and Red lines with platform details and live train activity.",
      },
    ],
  }),
  component: StationsIndex,
});

// Station metadata helper for platform and junction information
function getStationMetadata(name: string, id: string) {
  const normName = (name || "").toLowerCase();
  const normId = (id || "").toUpperCase();

  if (normName.includes("old high court") || normId === "BL11" || normId === "RL07") {
    return {
      platforms: "Platform 1–4",
      hubLabel: "Interchange Hub",
      isInterchange: true,
    };
  }
  if (normName.includes("kalupur") || normName.includes("sabarmati rly") || normId === "BL08" || normId === "RL12") {
    return {
      platforms: "Platform 1–3",
      hubLabel: "Railway Junction",
      isInterchange: true,
    };
  }
  if (normName.includes("motera stadium") || normName.includes("vastral gam") || normName.includes("thaltej gam") || normName.includes("apmc")) {
    return {
      platforms: "Platform 1–2",
      hubLabel: "Terminal",
      isInterchange: false,
    };
  }
  return {
    platforms: "Platform 1–2",
    hubLabel: null,
    isInterchange: false,
  };
}

function StationsIndex() {
  const [lineFilter, setLineFilter] = useState<"all" | "blue" | "red">("all");
  const stationsQ = useStations();
  const trainsQ = useTrains();
  const { isOperator, stationId } = useAuth();

  const stations = stationsQ.data ?? [];
  const trains = trainsQ.data ?? [];

  const assignedStation = stationId
    ? stations.find((s) => s.id.toLowerCase() === stationId.toLowerCase())
    : null;

  // Count trains per station by matching the train's current station ID to the station ID
  const trainsByStation = new Map<string, number>();
    for (const t of trains) {
      const curKey = (t.currentStationId || "").toLowerCase();
      const nextKey = (t.nextStationId || "").toLowerCase();
      if (curKey) trainsByStation.set(curKey, (trainsByStation.get(curKey) ?? 0) + 1);
      if (nextKey && nextKey !== curKey) trainsByStation.set(nextKey, (trainsByStation.get(nextKey) ?? 0) + 1);
    }

  const blueCount = stations.filter((s) => s.line === "blue").length;
  const redCount = stations.filter((s) => s.line === "red").length;

  const filteredStations = stations.filter((s) => {
    if (lineFilter === "all") return true;
    return s.line === lineFilter;
  });

  return (
    <div className="animate-fade-in-up space-y-8 px-4 py-6 md:px-8 md:py-8">
      {/* Operator Scoped Station Callout */}
      {isOperator && stationId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 to-[#040810] p-4 shadow-lg ring-1 ring-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Your Assigned Console Station
                </span>
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                  {assignedStation?.name || stationId} ({stationId})
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                You have operator management privileges for {assignedStation?.name || stationId}.
              </p>
            </div>
          </div>
          <Link
            to="/dashboard/stations/$stationId"
            params={{ stationId }}
            className="flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-500/30"
          >
            <span>Open Console</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Header with Title and Live Line Slide Filter */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Stations Directory</h1>
          <p className="mt-1 text-sm text-slate-400">
            {stations.length} stations across Blue &amp; Red lines · live platform &amp; train tracking.
          </p>
        </div>

        {/* Interactive Line Filter Slide Buttons with Glowing Indicators */}
        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-obsidian-900/90 p-1.5 shadow-xl backdrop-blur">
          {/* All Lines Button */}
          <button
            onClick={() => setLineFilter("all")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              lineFilter === "all"
                ? "bg-white/10 text-white shadow-sm ring-1 ring-white/20"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full transition-all",
                lineFilter === "all"
                  ? "bg-accent-cyan shadow-md shadow-accent-cyan/80 animate-pulse"
                  : "bg-slate-500"
              )}
            />
            <span>All Lines ({stations.length})</span>
          </button>

          {/* Blue Line Button */}
          <button
            onClick={() => setLineFilter("blue")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              lineFilter === "blue"
                ? "border border-cyan-500/50 bg-cyan-500/20 text-cyan-300 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500/40"
                : "text-slate-400 hover:text-cyan-400"
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full transition-all",
                lineFilter === "blue"
                  ? "bg-cyan-400 shadow-lg shadow-cyan-400/90 animate-pulse"
                  : "bg-cyan-600/40"
              )}
            />
            <span>Blue Line ({blueCount})</span>
          </button>

          {/* Red Line Button */}
          <button
            onClick={() => setLineFilter("red")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              lineFilter === "red"
                ? "border border-rose-500/50 bg-rose-500/20 text-rose-300 shadow-md shadow-rose-500/20 ring-1 ring-rose-500/40"
                : "text-slate-400 hover:text-rose-400"
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full transition-all",
                lineFilter === "red"
                  ? "bg-rose-500 shadow-lg shadow-rose-500/90 animate-pulse"
                  : "bg-rose-600/40"
              )}
            />
            <span>Red Line ({redCount})</span>
          </button>
        </div>
      </header>

      {/* Stations List Grid */}
      <section>
        <div className="flex items-center justify-between">
          <SectionHeader
            title={
              lineFilter === "all"
                ? "All Stations"
                : lineFilter === "blue"
                ? "Blue Line Stations (Vastral Gam ↔ Thaltej Gam)"
                : "Red Line Stations (APMC ↔ Motera Stadium)"
            }
            right={`${filteredStations.length} of ${stations.length} stations`}
          />
          {stationsQ.isLoading && <Loader2 className="size-4 animate-spin text-slate-500" />}
        </div>

        <ul className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {filteredStations.map((s) => {
            const count = trainsByStation.get(s.id.toLowerCase()) ?? 0;
            const isBlue = s.line === "blue";
            const meta = getStationMetadata(s.name, s.id);

            return (
              <li key={s.id}>
                <Link
                  to="/dashboard/stations/$stationId"
                  params={{ stationId: s.id }}
                  className={cn(
                    "group flex items-center gap-3.5 rounded-xl border p-4 transition-all hover:shadow-lg",
                    isBlue
                      ? "border-white/5 bg-obsidian-900 hover:border-cyan-500/40 hover:shadow-cyan-500/5"
                      : "border-white/5 bg-obsidian-900 hover:border-rose-500/40 hover:shadow-rose-500/5"
                  )}
                >
                  {/* Station Line Icon */}
                  <span
                    className={cn(
                      "grid size-10 place-items-center rounded-lg text-xs font-extrabold ring-1 transition-transform group-hover:scale-105",
                      isBlue
                        ? "bg-cyan-500/10 text-cyan-400 ring-cyan-500/20"
                        : "bg-rose-500/10 text-rose-400 ring-rose-500/20"
                    )}
                  >
                    <Building2 className="size-4" />
                  </span>

                  {/* Station Name & Platform / Line Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-white group-hover:text-accent-cyan transition-colors">
                        {s.name}
                      </span>
                      {meta.hubLabel && (
                        <span className="rounded bg-accent-cyan/15 px-1.5 py-0.2 font-mono text-[9px] font-bold text-accent-cyan ring-1 ring-accent-cyan/30">
                          {meta.hubLabel}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-slate-400">
                      {/* Line Tag */}
                      <span
                        className={cn(
                          "font-bold uppercase tracking-wider",
                          isBlue ? "text-cyan-400" : "text-rose-400"
                        )}
                      >
                        {isBlue ? "Blue Line" : "Red Line"}
                      </span>

                      <span className="text-slate-600">•</span>

                      {/* Platforms Badge */}
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300 ring-1 ring-white/10">
                        {meta.platforms}
                      </span>

                      <span className="text-slate-600">•</span>

                      {/* Live Trains Tag */}
                      <span
                        className={cn(
                          "flex items-center gap-1 font-bold",
                          count > 0 ? "text-emerald-400" : "text-slate-500"
                        )}
                      >
                        {count > 0 && <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />}
                        <TrainFront className="size-3" />
                        {count} {count === 1 ? "train" : "trains"}
                      </span>
                    </div>
                  </div>

                  <ArrowRight className="size-4 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-cyan" />
                </Link>
              </li>
            );
          })}

          {!stationsQ.isLoading && filteredStations.length === 0 && (
            <li className="col-span-full rounded-xl border border-white/5 bg-obsidian-900 p-8 text-center text-sm text-slate-500">
              No stations found for this line.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

