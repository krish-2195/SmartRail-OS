import { createFileRoute } from "@tanstack/react-router";
import { SectionHeader } from "./dashboard.index";
import { KpiCard } from "@/components/srail/kpi-card";
import { HOURLY_FLOW, WEEKLY_TREND } from "@/lib/mock/data";
import { useHourlyFlow, useWeeklyTrend, useKpi } from "@/lib/api/hooks";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Clock, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/dashboard/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics • SmartRail OS" },
      { name: "description", content: "Operational analytics for station performance and ridership." },
    ],
  }),
  component: Analytics,
});

function Analytics() {
  const hourlyQ = useHourlyFlow();
  const weeklyQ = useWeeklyTrend();
  const kpiQ = useKpi();

  const rawHourly = hourlyQ.data && hourlyQ.data.length > 0 ? hourlyQ.data : HOURLY_FLOW;
  const rawWeekly = weeklyQ.data && weeklyQ.data.length > 0 ? weeklyQ.data : WEEKLY_TREND;
  const kpi = kpiQ.data as any;

  // Normalize hourly data to guarantee both inflow & outflow exist
  const hourlyData = rawHourly.map((d: any) => ({
    ...d,
    inflow: d.inflow ?? d.boarding ?? 0,
    outflow: d.outflow ?? d.alighting ?? 0,
  }));

  // Normalize weekly data to guarantee passengers / total exist
  const weeklyData = rawWeekly.map((d: any) => ({
    ...d,
    passengers: d.passengers ?? d.total ?? 0,
    total: d.total ?? d.passengers ?? 0,
  }));

  // Real Ridership calculation from weekly totals or KPI
  const totalWeeklyRidership = weeklyData.reduce((acc: number, curr: any) => acc + (Number(curr.passengers) || 0), 0);
  const ridershipFormatted = totalWeeklyRidership > 0 
    ? totalWeeklyRidership.toLocaleString() 
    : kpi?.passengersInTransit 
      ? (kpi.passengersInTransit * 20).toLocaleString() 
      : "184,250";

  // Dynamic KPI values from backend snapshot
  const onTimeVal = kpi?.onTimePerformance ? `${Number(kpi.onTimePerformance).toFixed(1)}%` : "98.4%";
  const avgDwellVal = kpi?.averageDwellSeconds ? `${Math.round(Number(kpi.averageDwellSeconds))}s` : "38s";
  const peakLoadVal = kpi?.avgOccupancy ? `${(Number(kpi.avgOccupancy) / 100).toFixed(2)}` : "0.78";

  return (
    <div className="space-y-6 px-4 py-6 md:px-8 md:py-8">
      <SectionHeader title="Operational Analytics" right="Last 7 days" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Ridership" value={ridershipFormatted} delta="+4.2%" deltaTone="positive" icon={<Users className="size-4" />} />
        <KpiCard label="On-Time Performance" value={onTimeVal} delta="+0.6 pp" deltaTone="positive" icon={<Clock className="size-4" />} />
        <KpiCard label="Avg Dwell Time" value={avgDwellVal} delta="-3s" deltaTone="positive" icon={<Activity className="size-4" />} />
        <KpiCard label="Peak Load Factor" value={peakLoadVal} delta="Stable" deltaTone="neutral" icon={<TrendingUp className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Hourly Flow (today)">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ag_out" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#121216", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="inflow" name="Inflow" stroke="#2dd4bf" strokeWidth={2} fill="url(#ag)" />
              <Area type="monotone" dataKey="outflow" name="Outflow" stroke="#a78bfa" strokeWidth={2} fill="url(#ag_out)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Weekly Ridership">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#121216", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="passengers" name="Passengers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-obsidian-900 p-5">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="mt-4 h-64">{children}</div>
    </div>
  );
}
