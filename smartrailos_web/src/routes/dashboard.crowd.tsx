import { createFileRoute } from "@tanstack/react-router";
import { HOURLY_FLOW, PLATFORM_HEATMAP, WEEKLY_TREND } from "@/lib/mock/data";
import { useTrains, useHourlyFlow, useWeeklyTrend, usePlatformHeatmap } from "@/lib/api/hooks";
import { SectionHeader } from "./dashboard.index";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/dashboard/crowd")({
  head: () => ({
    meta: [
      { title: "Station Crowd Intelligence · SmartRail OS" },
      { name: "description", content: "Hourly, weekly and platform-level crowd analytics." },
    ],
  }),
  component: CrowdPage,
});

function CrowdPage() {
  const [tab, setTab] = useState<"hourly" | "weekly">("hourly");
  const trainsQ = useTrains();
  const hourlyQ = useHourlyFlow();
  const weeklyQ = useWeeklyTrend();
  const heatmapQ = usePlatformHeatmap();

  const rawHourly = hourlyQ.data && hourlyQ.data.length > 0 ? hourlyQ.data : HOURLY_FLOW;
  const rawWeekly = weeklyQ.data && weeklyQ.data.length > 0 ? weeklyQ.data : WEEKLY_TREND;
  const heatmapData = heatmapQ.data && heatmapQ.data.length > 0 ? heatmapQ.data : PLATFORM_HEATMAP;

  const hourlyData = rawHourly.map((d: any) => ({
    ...d,
    hour: d.hour ?? d.time ?? "",
    inflow: d.inflow ?? d.boarding ?? 0,
    outflow: d.outflow ?? d.alighting ?? 0,
  }));
  const weeklyData = rawWeekly.map((d: any) => ({
    ...d,
    day: d.day ?? d.label ?? "",
    passengers: d.passengers ?? d.total ?? d.value ?? 0,
  }));

  return (
    <div className="space-y-6 px-4 py-6 md:px-8 md:py-8">
      <SectionHeader title="Station Crowd Intelligence" right="Live Analytics" />

      <div className="rounded-xl border border-white/5 bg-obsidian-900 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Passenger Flow</h3>
          <div className="flex gap-1 rounded-md border border-white/10 bg-obsidian-800 p-0.5">
            {(["hourly", "weekly"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors",
                  tab === t ? "bg-accent-cyan text-obsidian-950" : "text-slate-400 hover:text-white",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            {tab === "hourly" ? (
              <AreaChart data={hourlyData} margin={{ top: 10, right: 12, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#121216", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="inflow" stroke="#2dd4bf" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="outflow" stroke="#3b82f6" strokeWidth={2} fill="url(#g2)" />
              </AreaChart>
            ) : (
              <BarChart data={weeklyData} margin={{ top: 10, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#121216", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="passengers" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-obsidian-900 p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-white">Platform Heatmap</h3>
          <p className="mt-1 text-xs text-slate-500">Density across Platform 1 & 2 by zone (last 60 min)</p>
          <div className="mt-5 space-y-1.5">
            {heatmapData.map((row, ri) => (
              <div key={ri} className="flex items-center gap-2">
                <div className="w-16 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  P{Math.floor(ri / 2) + 1}·{ri % 2 === 0 ? "N" : "S"}
                </div>
                <div className="flex flex-1 gap-1">
                  {row.map((v, ci) => (
                    <div
                      key={ci}
                      className="h-6 flex-1 rounded-sm"
                      style={{
                        backgroundColor:
                          v > 85 ? "#ef4444" : v > 70 ? "#fb923c" : v > 50 ? "#f59e0b" : v > 30 ? "#2dd4bf" : "#1e293b",
                        opacity: 0.35 + v / 150,
                      }}
                      title={`${v}%`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-[10px] text-slate-500">
            <Legend color="#2dd4bf" label="Light" />
            <Legend color="#f59e0b" label="Moderate" />
            <Legend color="#fb923c" label="Heavy" />
            <Legend color="#ef4444" label="Critical" />
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-obsidian-900 p-5">
          <h3 className="text-sm font-bold text-white">Peak Hours</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <PeakRow time="08:00–10:00" label="Morning peak" value="2,140 / hr" tone="text-warning" />
            <PeakRow time="13:00–14:00" label="Lunch lull" value="640 / hr" tone="text-success" />
            <PeakRow time="17:30–19:30" label="Evening peak" value="2,480 / hr" tone="text-danger" />
            <PeakRow time="22:00–23:00" label="Last service" value="380 / hr" tone="text-slate-400" />
          </ul>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2 rounded-sm" style={{ background: color }} />
      <span className="uppercase tracking-wider">{label}</span>
    </div>
  );
}

function PeakRow({ time, label, value, tone }: { time: string; label: string; value: string; tone: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2 last:border-0">
      <div>
        <div className="font-mono text-xs text-white">{time}</div>
        <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      </div>
      <div className={cn("font-mono text-sm font-bold", tone)}>{value}</div>
    </li>
  );
}
