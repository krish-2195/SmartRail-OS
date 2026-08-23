import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  esp32LiveQuery,
  esp32EventsQuery,
  queryKeys,
  sendEsp32Telemetry,
  resetEsp32Counters,
  updateEsp32Config,
} from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import {
  Cpu,
  ArrowDownRight,
  ArrowUpRight,
  Radio,
  RefreshCw,
  Zap,
  Gauge,
  Wifi,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  Info,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/dashboard/esp-sensor")({
  head: () => ({
    meta: [
      { title: "Live ESP32 Passenger Sensor · SmartRail OS" },
      { name: "description", content: "Real-time directional passenger counter and hardware telemetry." },
    ],
  }),
  component: EspSensorPage,
});

export function EspSensorPage() {
  const qc = useQueryClient();
  const liveQ = useQuery(esp32LiveQuery);
  const eventsQ = useQuery(esp32EventsQuery);

  const live = liveQ.data;
  const events = eventsQ.data ?? [];

  // Local feedback animations
  const [pulseState, setPulseState] = useState<"IN" | "OUT" | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedStation, setSelectedStation] = useState<string>("BL08");
  const [capacityInput, setCapacityInput] = useState<number>(400);

  // Sync capacity input with live data
  useEffect(() => {
    if (live?.coach_capacity) {
      setCapacityInput(live.coach_capacity);
    }
  }, [live?.coach_capacity]);

  // Flash pulse state when new events arrive
  useEffect(() => {
    if (live?.last_direction === "IN" || live?.last_direction === "OUT") {
      setPulseState(live.last_direction);
      const timer = setTimeout(() => setPulseState(null), 800);
      return () => clearTimeout(timer);
    }
  }, [live?.last_updated, live?.last_direction]);

  // Chart data: build rolling timeline from events
  const chartData = (events.slice(0, 20).reverse() || []).map((e, idx) => ({
    index: idx + 1,
    time: e.timestamp ? new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : `${idx}s`,
    occupancy: e.occupancy,
    total_in: e.total_in,
    total_out: e.total_out,
  }));

  // If no events yet, provide baseline preview points
  const displayChartData = chartData.length > 0 ? chartData : [
    { index: 1, time: "00:00", occupancy: live?.occupancy ?? 0, total_in: live?.total_in ?? 0, total_out: live?.total_out ?? 0 },
    { index: 2, time: "Live", occupancy: live?.occupancy ?? 0, total_in: live?.total_in ?? 0, total_out: live?.total_out ?? 0 },
  ];

  // Actions
  async function handleTrigger(direction: "IN" | "OUT", inDelta: number, outDelta: number) {
    try {
      setPulseState(direction);
      await sendEsp32Telemetry({
        direction,
        in_delta: inDelta,
        out_delta: outDelta,
        station_id: selectedStation === "ALL" ? null : selectedStation,
        distance_s1: direction === "IN" ? 14.2 : 42.0,
        distance_s2: direction === "IN" ? 38.0 : 16.5,
      });
      qc.invalidateQueries({ queryKey: queryKeys.esp32Live });
      qc.invalidateQueries({ queryKey: queryKeys.esp32Events });
    } catch (e) {
      console.error("Telemetry send failed", e);
    } finally {
      setTimeout(() => setPulseState(null), 800);
    }
  }

  async function handleBurstSimulation() {
    if (isSimulating) return;
    setIsSimulating(true);
    try {
      // Rapid sequence of 6 boarders and 2 alighters
      const steps = [
        { dir: "IN" as const, in: 1, out: 0 },
        { dir: "IN" as const, in: 1, out: 0 },
        { dir: "OUT" as const, in: 0, out: 1 },
        { dir: "IN" as const, in: 1, out: 0 },
        { dir: "IN" as const, in: 1, out: 0 },
        { dir: "OUT" as const, in: 0, out: 1 },
        { dir: "IN" as const, in: 1, out: 0 },
      ];
      for (const s of steps) {
        await handleTrigger(s.dir, s.in, s.out);
        await new Promise((r) => setTimeout(r, 450));
      }
    } finally {
      setIsSimulating(false);
    }
  }

  async function handleReset() {
    try {
      await resetEsp32Counters();
      qc.invalidateQueries({ queryKey: queryKeys.esp32Live });
      qc.invalidateQueries({ queryKey: queryKeys.esp32Events });
    } catch (e) {
      console.error("Reset failed", e);
    }
  }

  async function handleConfigSave() {
    try {
      await updateEsp32Config({
        target_station_id: selectedStation === "ALL" ? null : selectedStation,
        coach_capacity: capacityInput,
      });
      qc.invalidateQueries({ queryKey: queryKeys.esp32Live });
    } catch (e) {
      console.error("Config save failed", e);
    }
  }

  const occupancy = live?.occupancy ?? 0;
  const totalIn = live?.total_in ?? 0;
  const totalOut = live?.total_out ?? 0;
  const occupancyPct = live?.occupancy_pct ?? 0;
  const isActive = live?.is_active ?? false;

  const occupancyBadge =
    occupancyPct >= 85
      ? { label: "CRITICAL LOAD", bg: "bg-rose-500/20 text-rose-400 border-rose-500/30" }
      : occupancyPct >= 60
        ? { label: "HEAVY / SURGE", bg: "bg-amber-500/20 text-amber-400 border-amber-500/30" }
        : occupancyPct >= 30
          ? { label: "MODERATE", bg: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" }
          : { label: "NOMINAL", bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };

  return (
    <div className="space-y-6 px-4 py-6 md:px-8 md:py-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">
              ESP32 Live Passenger Counter
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
                isActive
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-700 bg-slate-800 text-slate-400"
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  isActive ? "animate-pulse bg-emerald-400" : "bg-slate-500"
                )}
              />
              {isActive ? "Telemetry Active" : "Standby / Ready"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Real-time directional IR & ultrasonic beam tracking for Coach Door C1 · Device:{" "}
            <span className="font-mono text-slate-300">{live?.device_id || "ESP32_COACH_01"}</span>
          </p>
        </div>

        {/* Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleTrigger("IN", 1, 0)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/20 active:scale-95"
          >
            <ArrowDownRight className="size-3.5" />
            +1 Boarding (IN)
          </button>
          <button
            onClick={() => handleTrigger("OUT", 0, 1)}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-500/20 active:scale-95"
          >
            <ArrowUpRight className="size-3.5" />
            +1 Alighting (OUT)
          </button>
          <button
            onClick={handleBurstSimulation}
            disabled={isSimulating}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:opacity-50"
          >
            <Zap className={cn("size-3.5", isSimulating && "animate-spin text-cyan-400")} />
            {isSimulating ? "Simulating..." : "Rush Hour Burst"}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-obsidian-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:bg-white/5"
            title="Reset counters to zero"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Net Occupancy Card */}
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border bg-obsidian-900 p-5 transition-all",
            pulseState === "IN"
              ? "border-emerald-500/50 shadow-lg shadow-emerald-500/10"
              : pulseState === "OUT"
                ? "border-amber-500/50 shadow-lg shadow-amber-500/10"
                : "border-white/5"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Coach Occupancy
            </span>
            <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", occupancyBadge.bg)}>
              {occupancyBadge.label}
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-extrabold text-white">{occupancy}</span>
            <span className="text-sm font-medium text-slate-500">/ {live?.coach_capacity ?? 400} pax</span>
          </div>

          {/* Radial progress bar */}
          <div className="mt-3">
            <div className="flex justify-between text-[11px] font-medium text-slate-400">
              <span>Capacity Load</span>
              <span className="font-mono font-bold text-white">{occupancyPct}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-obsidian-800">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  occupancyPct >= 85
                    ? "bg-rose-500"
                    : occupancyPct >= 60
                      ? "bg-amber-500"
                      : "bg-cyan-500"
                )}
                style={{ width: `${Math.min(100, occupancyPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Total Boarded (IN) */}
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border border-white/5 bg-obsidian-900 p-5 transition-all",
            pulseState === "IN" && "border-emerald-500/40 bg-emerald-950/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Boarded (IN)
            </span>
            <div className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowDownRight className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold text-emerald-400">{totalIn}</span>
            <span className="text-xs text-slate-500">passengers</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Flow Rate: <span className="font-mono font-bold text-white">{live?.in_rate_per_min ?? 0}</span> pax/min
          </p>
        </div>

        {/* Total Alighted (OUT) */}
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border border-white/5 bg-obsidian-900 p-5 transition-all",
            pulseState === "OUT" && "border-amber-500/40 bg-amber-950/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Alighted (OUT)
            </span>
            <div className="grid size-7 place-items-center rounded-lg bg-amber-500/10 text-amber-400">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold text-amber-400">{totalOut}</span>
            <span className="text-xs text-slate-500">passengers</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Exit Rate: <span className="font-mono font-bold text-white">{live?.out_rate_per_min ?? 0}</span> pax/min
          </p>
        </div>

        {/* Active Station & Device Link */}
        <div className="relative overflow-hidden rounded-xl border border-white/5 bg-obsidian-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Station Target
            </span>
            <div className="grid size-7 place-items-center rounded-lg bg-cyan-500/10 text-accent-cyan">
              <Radio className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white">
              {live?.target_station_id || "ALL STATIONS"}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
            <Wifi className="size-3 text-accent-cyan" />
            <span>RSSI: {live?.rssi ? `${live.rssi} dBm` : "USB Serial"}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Ultrasonic Visualizer & Live Flow Graph */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Dual Ultrasonic Beam Visualizer */}
        <div className="rounded-xl border border-white/5 bg-obsidian-900 p-5 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-accent-cyan" />
              <h2 className="text-sm font-bold text-white">Hardware Sensor Visualizer</h2>
            </div>
            <span className="font-mono text-[10px] uppercase text-slate-500">Dual HC-SR04</span>
          </div>

          <div className="mt-5 flex flex-col items-center justify-center space-y-6">
            {/* Metro Door Frame Visualization */}
            <div className="relative flex w-full max-w-xs flex-col items-center rounded-xl border border-dashed border-white/15 bg-obsidian-950 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Metro Coach Door 1
              </div>

              {/* Sensor 1 (Platform Entry) */}
              <div className="mt-4 flex w-full items-center justify-between rounded-lg border border-white/10 bg-obsidian-900 p-3">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "size-3 rounded-full transition-colors",
                      (live?.sensor_s1_distance ?? 999) <= 25.0
                        ? "animate-ping bg-emerald-400"
                        : "bg-slate-600"
                    )}
                  />
                  <div>
                    <p className="text-xs font-bold text-white">Sensor 1 (Platform)</p>
                    <p className="text-[10px] text-slate-500">Trig: Pin 4 · Echo: Pin 14</p>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-accent-cyan">
                  {(live?.sensor_s1_distance ?? 999) > 400 ? "CLEAR" : `${live?.sensor_s1_distance} cm`}
                </span>
              </div>

              {/* Directional Indicator in Doorway */}
              <div className="my-3 flex items-center gap-3">
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold transition-all",
                    pulseState === "IN"
                      ? "bg-emerald-500 text-obsidian-950 shadow-lg shadow-emerald-500/50"
                      : "bg-obsidian-800 text-slate-400"
                  )}
                >
                  <ArrowDownRight className="size-3" />
                  BOARDING (IN)
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold transition-all",
                    pulseState === "OUT"
                      ? "bg-amber-500 text-obsidian-950 shadow-lg shadow-amber-500/50"
                      : "bg-obsidian-800 text-slate-400"
                  )}
                >
                  <ArrowUpRight className="size-3" />
                  ALIGHTING (OUT)
                </div>
              </div>

              {/* Sensor 2 (Coach Interior) */}
              <div className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-obsidian-900 p-3">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "size-3 rounded-full transition-colors",
                      (live?.sensor_s2_distance ?? 999) <= 25.0
                        ? "animate-ping bg-amber-400"
                        : "bg-slate-600"
                    )}
                  />
                  <div>
                    <p className="text-xs font-bold text-white">Sensor 2 (Coach Exit)</p>
                    <p className="text-[10px] text-slate-500">Trig: Pin 27 · Echo: Pin 33</p>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-accent-cyan">
                  {(live?.sensor_s2_distance ?? 999) > 400 ? "CLEAR" : `${live?.sensor_s2_distance} cm`}
                </span>
              </div>
            </div>

            {/* Diagnostic Details */}
            <div className="w-full space-y-2 rounded-lg border border-white/5 bg-obsidian-950 p-3 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Threshold Distance:</span>
                <span className="font-mono text-white">&lt; 25.0 cm</span>
              </div>
              <div className="flex justify-between">
                <span>Crossing Timeout:</span>
                <span className="font-mono text-white">2000 ms</span>
              </div>
              <div className="flex justify-between">
                <span>Cooldown Window:</span>
                <span className="font-mono text-white">500 ms</span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated:</span>
                <span className="font-mono text-white">
                  {live?.last_updated ? new Date(live.last_updated).toLocaleTimeString() : "--:--:--"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Flow Area Chart */}
        <div className="rounded-xl border border-white/5 bg-obsidian-900 p-5 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Real-Time Passenger Dynamics</h2>
              <p className="text-xs text-slate-400">Continuous occupancy curve & passenger accumulation</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
                <span className="size-2 rounded-full bg-cyan-400" />
                Occupancy
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="size-2 rounded-full bg-emerald-400" />
                Cumulative IN
              </div>
            </div>
          </div>

          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayChartData} margin={{ top: 10, right: 12, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="colorOcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0b0f19",
                    borderColor: "#ffffff15",
                    borderRadius: "0.5rem",
                    color: "#f8fafc",
                    fontSize: "0.75rem",
                  }}
                />
                <Area type="monotone" dataKey="occupancy" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorOcc)" name="Occupancy" />
                <Area type="monotone" dataKey="total_in" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" fillOpacity={1} fill="url(#colorIn)" name="Total In" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row: Configuration Panel & Live Event Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Device & Station Configuration */}
        <div className="rounded-xl border border-white/5 bg-obsidian-900 p-5 lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Sliders className="size-4 text-accent-cyan" />
            <h2 className="text-sm font-bold text-white">Sensor & Coach Settings</h2>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Target Station Attachment
              </label>
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-obsidian-800 px-3 py-2 text-xs font-medium text-white focus:border-accent-cyan focus:outline-none"
              >
                <option value="BL08">BL08 · Old High Court Interchange</option>
                <option value="BL01">BL01 · Vastral Gam</option>
                <option value="BL18">BL18 · Thaltej</option>
                <option value="RL01">RL01 · APMC</option>
                <option value="RL08">RL08 · Old High Court (Red)</option>
                <option value="RL15">RL15 · Motera Stadium</option>
                <option value="ALL">Broadcast to ALL Stations</option>
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                Mobile app will reflect live sensor counts when viewing this station.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Coach Capacity Limit
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(Number(e.target.value))}
                  className="w-24 rounded-lg border border-white/10 bg-obsidian-800 px-3 py-2 font-mono text-xs font-bold text-white focus:border-accent-cyan focus:outline-none"
                />
                <span className="text-xs text-slate-400">passengers max</span>
              </div>
            </div>

            <button
              onClick={handleConfigSave}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-cyan px-4 py-2 text-xs font-bold text-obsidian-950 transition-colors hover:bg-cyan-300"
            >
              <RefreshCw className="size-3.5" />
              Apply Configuration
            </button>
          </div>
        </div>

        {/* Live Crossing Activity Feed */}
        <div className="rounded-xl border border-white/5 bg-obsidian-900 p-5 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent-cyan" />
              <h2 className="text-sm font-bold text-white">Live Event Stream</h2>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {events.length} events logged
            </span>
          </div>

          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {events.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 text-center text-xs text-slate-500">
                <Info className="size-4 mb-1 text-slate-600" />
                Waiting for crossing pulses... Trigger Boarding/Alighting above to test.
              </div>
            ) : (
              events.map((ev, idx) => (
                <div
                  key={ev.id ?? idx}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-obsidian-950/70 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                        ev.direction === "IN"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : ev.direction === "OUT"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-slate-800 text-slate-400"
                      )}
                    >
                      {ev.direction === "IN" ? "🟢 BOARD (+1)" : ev.direction === "OUT" ? "🟠 ALIGHT (-1)" : "🔄 SYNC"}
                    </span>
                    <span className="text-slate-300">
                      Coach {ev.coach_id || "C1"} · Occupancy: <span className="font-mono font-bold text-white">{ev.occupancy}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-500">
                    {ev.distance_s1 != null && ev.distance_s2 != null && (
                      <span className="hidden font-mono text-[10px] sm:inline">
                        S1:{ev.distance_s1}cm · S2:{ev.distance_s2}cm
                      </span>
                    )}
                    <span className="font-mono text-[10px]">
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
