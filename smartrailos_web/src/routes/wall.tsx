import { createFileRoute } from "@tanstack/react-router";
import { useClock, formatTime, formatDate } from "@/lib/use-live-tick";
import { useLiveTrains } from "@/lib/use-live-trains";
import { useAlerts, useKpi } from "@/lib/api/hooks";
import {
  KPI,
  ALERTS,
  CURRENT_STATION,
  findStation,
  statusFromOccupancy,
  OCC_TW,
  ALERT_SEVERITY_TW,
  riskFor,
  RISK_TW,
} from "@/lib/mock/data";
import { AlertOctagon, TrainFront, Users, Activity, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wall")({
  head: () => ({
    meta: [
      { title: "SmartRail · Wall Board" },
      { name: "description", content: "Full-screen operations wall board for control rooms." },
    ],
  }),
  component: WallBoard,
});

function fmtEta(s: number) {
  if (s <= 0) return "NOW";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`;
}

function WallBoard() {
  const now = useClock();
  const trains = useLiveTrains();
  const alertsQ = useAlerts();
  const kpiQ = useKpi();

  const activeAlerts = (alertsQ.data && alertsQ.data.length > 0 ? alertsQ.data : ALERTS).filter(
    (a: any) => !a.resolved
  );
  const kpi = (kpiQ.data as any) ?? KPI;
  const sorted = [...trains].sort((a, b) => a.etaSeconds - b.etaSeconds);

  const stats = [
    { label: "Trains Active", value: kpi.currentTrains ?? trains.length, icon: TrainFront, tone: "text-accent-cyan" },
    { label: "In Station", value: (kpi.passengersInStation ?? 0).toLocaleString(), icon: Users, tone: "text-white" },
    { label: "In Transit", value: (kpi.passengersInTransit ?? 0).toLocaleString(), icon: Activity, tone: "text-white" },
    { label: "Avg Occupancy", value: `${Math.round(kpi.avgOccupancy ?? 0)}%`, icon: Activity, tone: "text-warning" },
    { label: "Active Alerts", value: activeAlerts.length, icon: Bell, tone: "text-danger" },
    { label: "Next-Hour Pred.", value: (kpi.predictedNextHour ?? 0).toLocaleString(), icon: Activity, tone: "text-accent-cyan" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-obsidian-950 text-slate-200">
      <header className="flex items-center justify-between border-b border-white/10 bg-obsidian-900/80 px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="grid size-10 place-items-center rounded-md bg-accent-cyan text-obsidian-950">
            <span className="text-lg font-extrabold italic">S</span>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
              SmartRail · Wall Board
            </div>
            <h1 className="text-2xl font-extrabold uppercase tracking-wide text-white">
              {CURRENT_STATION}
            </h1>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-4xl tabular-nums text-white">{formatTime(now)}</div>
          <div className="font-mono text-xs text-slate-500">{formatDate(now)} IST</div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 border-b border-white/5 p-4 md:grid-cols-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-lg border border-white/10 bg-obsidian-900 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {s.label}
                </div>
                <Icon className={cn("size-4", s.tone)} />
              </div>
              <div className={cn("mt-2 font-mono text-3xl tabular-nums", s.tone)}>{s.value}</div>
            </div>
          );
        })}
      </section>

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-obsidian-900 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">
              Train Board · Live
            </h2>
            <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-success">
              <span className="size-1.5 animate-pulse rounded-full bg-success" />
              streaming
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-slate-500">
              <tr className="border-b border-white/5">
                <th className="px-5 py-2 text-left">Train</th>
                <th className="px-2 py-2 text-left">Direction</th>
                <th className="px-2 py-2 text-left">Next</th>
                <th className="px-2 py-2 text-right">ETA</th>
                <th className="px-2 py-2 text-right">Occ.</th>
                <th className="px-5 py-2 text-right">Risk</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const next = findStation(t.nextStationId);
                const avgOcc = Math.round(
                  t.coaches.reduce((a, c) => a + c.occupancy, 0) / t.coaches.length,
                );
                const occStatus = statusFromOccupancy(avgOcc);
                const risk = riskFor(t);
                return (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-mono text-xs text-white">{t.id}</td>
                    <td className="px-2 py-3 text-xs text-slate-400">{t.direction}</td>
                    <td className="px-2 py-3 text-xs text-slate-300">{next?.name ?? "—"}</td>
                    <td className="px-2 py-3 text-right font-mono text-sm tabular-nums text-accent-cyan">
                      {fmtEta(t.etaSeconds)}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums">
                        <span className={cn("size-1.5 rounded-full", OCC_TW[occStatus])} />
                        {avgOcc}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={cn(
                          "rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                          RISK_TW[risk],
                        )}
                      >
                        {risk}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-white/10 bg-obsidian-900">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">
              Active Alerts
            </h2>
            <span className="rounded bg-danger/20 px-2 py-0.5 font-mono text-[10px] text-danger">
              {activeAlerts.length}
            </span>
          </div>
          <ul className="divide-y divide-white/5">
            {activeAlerts.map((a: any) => (
              <li key={a.id} className="flex gap-3 px-5 py-3">
                <AlertOctagon className="mt-0.5 size-4 shrink-0 text-danger" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                        ALERT_SEVERITY_TW[a.severity as keyof typeof ALERT_SEVERITY_TW] ?? "border-amber-500/30 text-amber-400",
                      )}
                    >
                      {a.severity}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {a.time ?? (a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Live")}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-white">{a.title}</div>
                  <div className="text-xs text-slate-400">{a.description ?? a.message}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
