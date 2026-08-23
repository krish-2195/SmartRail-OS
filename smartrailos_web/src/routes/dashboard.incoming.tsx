import { createFileRoute } from "@tanstack/react-router";
import { RISK_TW, riskFor } from "@/lib/mock/data";
import { useDashboardSnapshot, useTrains } from "@/lib/api/hooks";
import { LineBadge } from "@/components/srail/badges";
import { OccupancyBar } from "@/components/srail/occupancy-bar";
import { formatEta } from "@/lib/use-live-tick";
import { SectionHeader } from "./dashboard.index";
import { ArrowRight, UserPlus, UserMinus, Clock, TrainFront, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFullStationName } from "@/lib/use-live-train-state";

export const Route = createFileRoute("/dashboard/incoming")({
  head: () => ({
    meta: [
      { title: "Incoming Trains · SmartRail OS Operations" },
      { name: "description", content: "Inbound trains approaching corridor platforms with live passenger flow and boarding forecasts." },
    ],
  }),
  component: IncomingPage,
});

function IncomingPage() {
  const snapQ = useDashboardSnapshot();
  const trainsQ = useTrains();

  const snapIncoming = (snapQ.data?.incoming_trains ?? []).filter((t) => t.train_id !== "ESP32_DEMO");
  const allTrains = (trainsQ.data ?? []).filter((t) => t.id !== "ESP32_DEMO");

  // Inbound trains across network (Approaching, En Route, Departing)
  const networkIncoming = allTrains
    .filter((t) => t.status === "Approaching" || t.status === "En Route" || t.status === "Departing")
    .map((t) => {
      const avg = t.coaches.length > 0
        ? Math.round(t.coaches.reduce((s, c) => s + c.occupancy, 0) / t.coaches.length)
        : 0;
      const etaMin = Math.max(1, Math.round((t.etaSeconds || 90) / 60));
      return {
        train_id: t.id,
        train_name: t.name,
        line_name: t.line === "blue" ? "Blue Line" : "Red Line",
        direction: t.direction,
        eta_minutes: etaMin,
        route: `${formatFullStationName(t.currentStationId, t.line)} ➔ ${formatFullStationName(t.nextStationId, t.line)}`,
        current_occupancy: avg,
        predicted_occupancy_at_station: t.predictedOccupancy ?? avg,
        predicted_boarding_count: t.predictedBoarding ?? 85,
        predicted_deboarding_count: t.predictedDeboarding ?? 60,
      };
    })
    .sort((a, b) => a.eta_minutes - b.eta_minutes);

  const displayList = snapIncoming.length > 0 ? snapIncoming : networkIncoming;

  return (
    <div className="animate-fade-in-up space-y-6 px-4 py-6 md:px-8 md:py-8">
      <SectionHeader title="Incoming Trains Telemetry" right={`${displayList.length} inbound units`} />

      {displayList.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-obsidian-900/50 text-center">
          <TrainFront className="size-8 text-slate-600 mb-2" />
          <p className="text-lg font-medium text-slate-300">No Incoming Trains</p>
          <p className="mt-1 text-xs text-slate-500">There are currently no trains scheduled to arrive in the next 30 minutes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {displayList.map((t) => {
            const avg = t.predicted_occupancy_at_station ?? 0;
            const risk = riskFor(avg);
            const isRed = (t.line_name || "").toLowerCase().includes("red");

            return (
              <div
                key={t.train_id}
                className="rounded-2xl border border-white/10 bg-obsidian-900/90 p-5 shadow-xl backdrop-blur-md transition-all hover:border-white/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-obsidian-800 px-2.5 py-1 font-mono text-xs font-black text-accent-cyan border border-white/10">
                      {t.train_id}
                    </span>
                    <LineBadge line={isRed ? "red" : "blue"} />
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                      RISK_TW[risk]
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {risk} risk
                  </span>
                </div>

                <h3 className="mt-3 text-base font-bold text-white">{t.train_name}</h3>

                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <Compass className="size-3.5 text-accent-cyan shrink-0" />
                  <span>{t.route}</span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Cell icon={<Clock className="size-3.5 text-accent-cyan" />} label="ETA" value={`${t.eta_minutes} min`} />
                  <Cell icon={<UserPlus className="size-3.5 text-emerald-400" />} label="Est. Boarding" value={`+${t.predicted_boarding_count} pax`} accent />
                  <Cell icon={<UserMinus className="size-3.5 text-amber-400" />} label="Est. Alighting" value={`-${t.predicted_deboarding_count} pax`} />
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <span>Predicted Platform Occupancy</span>
                    <span className="font-mono font-bold text-accent-cyan">{avg}%</span>
                  </div>
                  <OccupancyBar value={avg} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cell({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-obsidian-950/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {icon} {label}
      </div>
      <div className={cn("mt-1 font-mono text-sm font-black", accent ? "text-accent-cyan" : "text-white")}>
        {value}
      </div>
    </div>
  );
}
