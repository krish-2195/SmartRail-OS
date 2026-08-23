import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { OccupancyBar } from "@/components/srail/occupancy-bar";
import {
  useTrains,
  useKpi,
  useStations,
  useStationCurrent,
  useStationFeature,
  useAlerts,
} from "@/lib/api/hooks";
import {
  Box,
  Radar,
  TrainFront,
  Activity,
  Zap,
  Users,
  Radio,
  ArrowRight,
  Sparkles,
  Layers,
  Sliders,
  ShieldCheck,
  ChevronDown,
  Building2,
  AlertTriangle,
  DoorOpen,
  Thermometer,
  Gauge,
  Eye,
  CheckCircle2,
} from "lucide-react";
import {
  type Train,
  BLUE_LINE,
  RED_LINE,
  STATIONS,
  findStation,
} from "@/lib/mock/data";
import { cn } from "@/lib/utils";

interface DigitalTwinSearch {
  stationId?: string;
}

export const Route = createFileRoute("/dashboard/digital-twin")({
  validateSearch: (search: Record<string, unknown>): DigitalTwinSearch => {
    return {
      stationId: typeof search.stationId === "string" ? search.stationId : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Digital Twin · SmartRail OS Command Center" },
      {
        name: "description",
        content:
          "Interactive 3D-inspired Digital Twin & Physical Control Room with station selection and live database telemetry.",
      },
    ],
  }),
  component: DigitalTwin,
});

function getCoachTheme(pct: number) {
  if (pct >= 90)
    return {
      fill: "rgba(239, 68, 68, 0.15)",
      stroke: "#ef4444",
      text: "#fca5a5",
      badgeBg: "rgba(239, 68, 68, 0.3)",
      badgeText: "#ef4444",
      statusText: "CRITICAL",
    };
  if (pct >= 75)
    return {
      fill: "rgba(249, 115, 22, 0.15)",
      stroke: "#f97316",
      text: "#fdba74",
      badgeBg: "rgba(249, 115, 22, 0.3)",
      badgeText: "#f97316",
      statusText: "HIGH",
    };
  if (pct >= 50)
    return {
      fill: "rgba(245, 158, 11, 0.15)",
      stroke: "#f59e0b",
      text: "#fde047",
      badgeBg: "rgba(245, 158, 11, 0.3)",
      badgeText: "#f59e0b",
      statusText: "MODERATE",
    };
  return {
    fill: "rgba(45, 212, 191, 0.12)",
    stroke: "#2dd4bf",
    text: "#5eead4",
    badgeBg: "rgba(45, 212, 191, 0.25)",
    badgeText: "#2dd4bf",
    statusText: "OPTIMAL",
  };
}

function getStationTypeLabel(id: string, name: string) {
  const norm = (name || "").toLowerCase();
  const code = (id || "").toUpperCase();
  if (norm.includes("old high court") || code === "BL11" || code === "RL07") {
    return { label: "Interchange Hub", platforms: "Platform 1 & 2 (Dual Line)" };
  }
  if (norm.includes("kalupur") || norm.includes("sabarmati rly") || code === "BL08" || code === "RL12") {
    return { label: "Railway Junction", platforms: "Platform 1 (UP) & 2 (DOWN)" };
  }
  if (norm.includes("motera stadium") || norm.includes("vastral gam") || norm.includes("thaltej gam") || norm.includes("apmc")) {
    return { label: "Terminal Station", platforms: "Platform 1 (UP) & 2 (DOWN)" };
  }
  return { label: "Elevated Station", platforms: "Platform 1 (UP) & 2 (DOWN)" };
}

function DigitalTwin() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const stationsQ = useStations();
  const trainsQ = useTrains();
  const kpiQ = useKpi();
  const alertsQ = useAlerts();

  const stations = stationsQ.data && stationsQ.data.length > 0 ? stationsQ.data : STATIONS;
  const trains = trainsQ.data ?? [];
  const kpi = kpiQ.data;

  // Selected Station ID (URL search param or default to BL11 Old High Court)
  const currentStationId = (search.stationId || "BL11").toUpperCase();

  const activeStation = useMemo(() => {
    return (
      stations.find((s) => s.id.toUpperCase() === currentStationId) ||
      findStation(currentStationId) ||
      BLUE_LINE[10] // Fallback to BL11 Old High Court
    );
  }, [stations, currentStationId]);

  const isInterchange =
    activeStation.name.toLowerCase().includes("old high court") ||
    activeStation.id === "BL11" ||
    activeStation.id === "RL07";

  const isBlueLine = activeStation.line === "blue" || activeStation.id.startsWith("BL");
  const isRedLine = activeStation.line === "red" || activeStation.id.startsWith("RL");

  // Station Database State Queries (from SQLite table station_current_* and station_feature_*)
  const stationCurrentQ = useStationCurrent(activeStation.id);
  const stationFeatureQ = useStationFeature(activeStation.id);

  const stationCurrent = stationCurrentQ.data;
  const featureDataArray = Array.isArray(stationFeatureQ.data)
    ? stationFeatureQ.data
    : stationFeatureQ.data
    ? [stationFeatureQ.data]
    : [];

  const topUpcoming = useMemo(() => {
    return [...featureDataArray]
      .filter((f) => f && f.estimated_arrival_time)
      .sort((a, b) => (a.estimated_arrival_time || "").localeCompare(b.estimated_arrival_time || ""))
      .slice(0, 4);
  }, [featureDataArray]);

  // Station Matcher Function
  const isMatchStation = (tStationIdOrName?: string | null) => {
    if (!tStationIdOrName) return false;
    const lower = tStationIdOrName.toLowerCase();
    if (lower === activeStation.id.toLowerCase()) return true;
    if (lower.includes(activeStation.name.toLowerCase())) return true;
    if (isInterchange && (lower === "bl11" || lower === "rl07" || lower.includes("old high court"))) return true;
    return false;
  };

  // Group Trains for Platform 1 & Platform 2 based on station topology
  const { p1Trains, p2Trains } = useMemo(() => {
    if (isInterchange) {
      // Platform 1 = Blue Line, Platform 2 = Red Line
      const blue = trains.filter((t) => t.line === "blue");
      const red = trains.filter((t) => t.line === "red");
      return { p1Trains: blue, p2Trains: red };
    }

    // Standard Station: Platform 1 = UP, Platform 2 = DOWN
    const lineTrains = trains.filter(
      (t) => (isBlueLine && t.line === "blue") || (isRedLine && t.line === "red")
    );

    const up = lineTrains.filter(
      (t) =>
        t.direction.toLowerCase().includes("up") ||
        t.direction.toLowerCase().includes("thaltej") ||
        t.direction.toLowerCase().includes("motera")
    );
    const down = lineTrains.filter(
      (t) =>
        t.direction.toLowerCase().includes("down") ||
        t.direction.toLowerCase().includes("vastral") ||
        t.direction.toLowerCase().includes("apmc")
    );

    return {
      p1Trains: up.length > 0 ? up : lineTrains.slice(0, Math.ceil(lineTrains.length / 2)),
      p2Trains: down.length > 0 ? down : lineTrains.slice(Math.ceil(lineTrains.length / 2)),
    };
  }, [trains, isInterchange, isBlueLine, isRedLine]);

  // Selected Train ID for inspection
  const [selectedP1TrainId, setSelectedP1TrainId] = useState<string | null>(null);
  const [selectedP2TrainId, setSelectedP2TrainId] = useState<string | null>(null);
  const [inspectedTrainId, setInspectedTrainId] = useState<string | null>(null);

  // Active Train on Platform 1
  const activeP1Train = useMemo(() => {
    const matched = p1Trains.find(
      (t) =>
        (t.id === selectedP1TrainId) ||
        (isMatchStation(t.currentStationId) && t.status === "At Station") ||
        (isMatchStation(t.nextStationId) && (t.status === "Approaching" || t.status === "At Station"))
    );
    return matched || p1Trains.find((t) => t.id === selectedP1TrainId) || p1Trains[0] || null;
  }, [p1Trains, selectedP1TrainId, activeStation]);

  // Active Train on Platform 2
  const activeP2Train = useMemo(() => {
    const matched = p2Trains.find(
      (t) =>
        (t.id === selectedP2TrainId) ||
        (isMatchStation(t.currentStationId) && t.status === "At Station") ||
        (isMatchStation(t.nextStationId) && (t.status === "Approaching" || t.status === "At Station"))
    );
    return matched || p2Trains.find((t) => t.id === selectedP2TrainId) || p2Trains[0] || null;
  }, [p2Trains, selectedP2TrainId, activeStation]);

  // Current Inspected Train for the Right Sidebar
  const currentInspectedTrain = useMemo(() => {
    if (inspectedTrainId) {
      const found = trains.find((t) => t.id === inspectedTrainId);
      if (found) return found;
    }
    // If station has a berthed train in DB, synthesize or use that
    if (stationCurrent?.train_id) {
      const found = trains.find((t) => t.id.toUpperCase() === (stationCurrent.train_id || "").toUpperCase());
      if (found) return found;
    }
    return activeP1Train || activeP2Train || trains[0] || null;
  }, [inspectedTrainId, stationCurrent, trains, activeP1Train, activeP2Train]);

  // Concourse Passenger Dot Count scaled to this station's real database crowd
  const currentStationPax = stationCurrent?.current_passenger_count ?? (kpi?.passengersInTransit ? Math.round(kpi.passengersInTransit / 33) : 180);
  const dotCount = Math.min(80, Math.max(12, Math.round(currentStationPax / 8)));

  // Station Alerts
  const allAlerts = alertsQ.data ?? [];
  const stationAlerts = allAlerts.filter(
    (a) =>
      a.stationName?.toLowerCase().includes(activeStation.name.toLowerCase()) ||
      a.description?.toLowerCase().includes(activeStation.name.toLowerCase()) ||
      a.title?.toLowerCase().includes(activeStation.name.toLowerCase())
  );

  const handleStationChange = (stId: string) => {
    setSelectedP1TrainId(null);
    setSelectedP2TrainId(null);
    setInspectedTrainId(null);
    navigate({
      search: { stationId: stId },
    });
  };

  const stMetadata = getStationTypeLabel(activeStation.id, activeStation.name);

  return (
    <div className="space-y-6 px-4 py-6 md:px-8 md:py-8">
      {/* ── TOP CONTROL & STATION SELECTOR BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <Radio className="size-3 text-accent-cyan animate-pulse" /> Telemetry Stream · Live WebSocket (0.2 Hz) · Station Telemetry
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              {activeStation.name} · Digital Twin
            </h1>
            <span
              className={cn(
                "rounded-full px-3 py-0.5 font-mono text-xs font-bold ring-1",
                isInterchange
                  ? "bg-purple-500/20 text-purple-300 ring-purple-500/30"
                  : isBlueLine
                  ? "bg-blue-500/20 text-blue-300 ring-blue-500/30"
                  : "bg-rose-500/20 text-rose-300 ring-rose-500/30"
              )}
            >
              {activeStation.id} · {isInterchange ? "Interchange" : isBlueLine ? "Blue Line" : "Red Line"}
            </span>
          </div>
        </div>

        {/* Station Selector Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={activeStation.id}
              onChange={(e) => handleStationChange(e.target.value)}
              className="appearance-none rounded-xl border border-white/15 bg-obsidian-900 py-2 pl-4 pr-10 font-mono text-xs font-bold text-white shadow-lg transition-all focus:border-accent-cyan focus:outline-none focus:ring-1 focus:ring-accent-cyan"
            >
              <optgroup label="── INTERCHANGE HUB ──">
                <option value="BL11">BL11 / RL07 · Old High Court Interchange</option>
              </optgroup>
              <optgroup label="── BLUE LINE (VASTRAL GAM ↔ THALTEJ GAM) ──">
                {BLUE_LINE.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} · {s.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="── RED LINE (APMC ↔ MOTERA STADIUM) ──">
                {RED_LINE.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} · {s.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-obsidian-900 px-3 py-1.5 text-xs font-mono text-slate-300">
            <Activity className="size-3.5 text-emerald-400" />
            <span>Health: <strong className="text-white">{Math.max(92, 100 - (stationAlerts?.length ?? 0) * 2.5).toFixed(1)}%</strong></span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1.5 text-xs font-mono font-bold text-accent-cyan">
            <Zap className="size-3.5" />
            <span>Live DB Sync</span>
          </div>
        </div>
      </div>

      {/* Quick Station Jump Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
          Quick Hubs:
        </span>
        {[
          { id: "BL11", name: "Old High Court" },
          { id: "BL08", name: "Kalupur (Rly)" },
          { id: "BL01", name: "Vastral Gam" },
          { id: "BL18", name: "Thaltej Gam" },
          { id: "RL01", name: "APMC" },
          { id: "RL15", name: "Motera Stadium" },
          { id: "RL12", name: "Sabarmati (Rly)" },
        ].map((h) => {
          const isCurrent = activeStation.id === h.id || (isInterchange && h.id === "BL11");
          return (
            <button
              key={h.id}
              onClick={() => handleStationChange(h.id)}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold transition-all",
                isCurrent
                  ? "bg-accent-cyan/20 text-accent-cyan ring-1 ring-accent-cyan/40"
                  : "bg-obsidian-800/80 text-slate-400 hover:bg-white/10 hover:text-white"
              )}
            >
              {h.id} · {h.name}
            </button>
          );
        })}
      </div>

      {/* ── MAIN DIGITAL TWIN BLUEPRINT GRID ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        {/* Left Interactive Canvas Container */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-obsidian-950 shadow-2xl backdrop-blur-xl">
          
          {/* ── PLATFORM 1 CONTROLS HEADER ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-obsidian-900/90 px-6 py-3.5">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-3 items-center justify-center rounded-full",
                  isInterchange || isBlueLine ? "bg-blue-500/20" : "bg-rose-500/20"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full animate-ping",
                    isInterchange || isBlueLine ? "bg-blue-400" : "bg-rose-400"
                  )}
                />
              </span>
              <div>
                <h3 className="font-mono text-xs font-extrabold text-white tracking-wider">
                  {isInterchange
                    ? "PLATFORM 1 · BLUE LINE TRACK"
                    : isBlueLine
                    ? "PLATFORM 1 · UP TRACK (THALTEJ GAM BOUND)"
                    : "PLATFORM 1 · UP TRACK (MOTERA STADIUM BOUND)"}
                </h3>
                <p className="text-[10px] text-slate-400 font-mono">
                  {isInterchange
                    ? "Bound: Thaltej Gam ↔ Vastral Gam"
                    : isBlueLine
                    ? "Direction: UP · Towards Thaltej Gam (BL18)"
                    : "Direction: UP · Towards Motera Stadium (RL15)"}
                </p>
              </div>
            </div>

            {/* Train Selector Tabs for Platform 1 */}
            <div className="flex flex-wrap items-center gap-1.5">
              {p1Trains.length === 0 ? (
                <span className="text-[11px] font-mono text-slate-500 italic">No trains on track</span>
              ) : (
                p1Trains.slice(0, 5).map((t) => {
                  const isActive = t.id === activeP1Train?.id;
                  const isDwelling = isMatchStation(t.currentStationId) && t.status === "At Station";
                  const isApproaching = isMatchStation(t.nextStationId) || t.status === "Approaching";
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedP1TrainId(t.id);
                        setInspectedTrainId(t.id);
                      }}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition-all duration-200",
                        isActive
                          ? isRedLine && !isInterchange
                            ? "bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-lg shadow-rose-500/25 ring-1 ring-white/30"
                            : "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/30"
                          : "bg-obsidian-800 text-slate-400 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <TrainFront className={cn("size-3.5", isActive ? "text-white" : isRedLine && !isInterchange ? "text-rose-400" : "text-blue-400")} />
                      <span>{t.id}</span>
                      {isDwelling ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                          HERE
                        </span>
                      ) : isApproaching ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-400 ring-1 ring-inset ring-amber-500/30">
                          ETA {Math.max(1, Math.round((t.etaSeconds || 60) / 60))}m
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── PLATFORM 2 CONTROLS HEADER ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-obsidian-900/60 px-6 py-2.5">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-3 items-center justify-center rounded-full",
                  isInterchange || isRedLine ? "bg-rose-500/20" : "bg-blue-500/20"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full animate-ping",
                    isInterchange || isRedLine ? "bg-rose-400" : "bg-blue-400"
                  )}
                />
              </span>
              <div>
                <h3 className="font-mono text-xs font-extrabold text-white tracking-wider">
                  {isInterchange
                    ? "PLATFORM 2 · RED LINE TRACK"
                    : isBlueLine
                    ? "PLATFORM 2 · DOWN TRACK (VASTRAL GAM BOUND)"
                    : "PLATFORM 2 · DOWN TRACK (APMC BOUND)"}
                </h3>
                <p className="text-[10px] text-slate-400 font-mono">
                  {isInterchange
                    ? "Bound: APMC ↔ Motera Stadium"
                    : isBlueLine
                    ? "Direction: DOWN · Towards Vastral Gam (BL01)"
                    : "Direction: DOWN · Towards APMC (RL01)"}
                </p>
              </div>
            </div>

            {/* Train Selector Tabs for Platform 2 */}
            <div className="flex flex-wrap items-center gap-1.5">
              {p2Trains.length === 0 ? (
                <span className="text-[11px] font-mono text-slate-500 italic">No trains on track</span>
              ) : (
                p2Trains.slice(0, 5).map((t) => {
                  const isActive = t.id === activeP2Train?.id;
                  const isDwelling = isMatchStation(t.currentStationId) && t.status === "At Station";
                  const isApproaching = isMatchStation(t.nextStationId) || t.status === "Approaching";
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedP2TrainId(t.id);
                        setInspectedTrainId(t.id);
                      }}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition-all duration-200",
                        isActive
                          ? "bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-lg shadow-rose-500/25 ring-1 ring-white/30"
                          : "bg-obsidian-800 text-slate-400 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <TrainFront className={cn("size-3.5", isActive ? "text-white" : "text-rose-400")} />
                      <span>{t.id}</span>
                      {isDwelling ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                          HERE
                        </span>
                      ) : isApproaching ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-400 ring-1 ring-inset ring-amber-500/30">
                          ETA {Math.max(1, Math.round((t.etaSeconds || 60) / 60))}m
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* SVG Digital Twin Visual Blueprint Canvas */}
          <div className="relative p-4 md:p-6 bg-obsidian-950">
            <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
            
            <svg viewBox="0 0 840 480" className="relative h-[440px] w-full md:h-[520px] overflow-visible">
              <defs>
                {/* Neon Glow Filters */}
                <filter id="neonBlueGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="neonRedGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Station Outer Boundary Shield */}
              <rect
                x="25"
                y="15"
                width="790"
                height="450"
                rx="16"
                fill="none"
                stroke={isInterchange ? "rgba(168,85,247,0.3)" : isBlueLine ? "rgba(59,130,246,0.3)" : "rgba(244,63,94,0.3)"}
                strokeWidth="1.5"
                strokeDasharray="6 6"
              />

              {/* Station Identification Badge Header in SVG */}
              <text x="45" y="38" fill="#94a3b8" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono">
                📍 {activeStation.id} · {activeStation.name.toUpperCase()} · PHYSICAL DIGITAL TWIN BLUEPRINT
              </text>

              {/* ── PLATFORM 1 SVG ZONE ── */}
              <line
                x1="50"
                y1="50"
                x2="790"
                y2="50"
                stroke={isRedLine && !isInterchange ? "#f43f5e" : "#3b82f6"}
                strokeWidth="2"
                strokeOpacity="0.4"
              />
              <line
                x1="50"
                y1="165"
                x2="790"
                y2="165"
                stroke={isRedLine && !isInterchange ? "#f43f5e" : "#3b82f6"}
                strokeWidth="2"
                strokeOpacity="0.4"
              />
              
              {/* Platform 1 Enclosure */}
              <rect
                x="50"
                y="52"
                width="740"
                height="110"
                rx="12"
                fill={isRedLine && !isInterchange ? "rgba(244,63,94,0.04)" : "rgba(59,130,246,0.04)"}
                stroke={isRedLine && !isInterchange ? "rgba(244,63,94,0.3)" : "rgba(59,130,246,0.3)"}
                strokeWidth="1.2"
              />

              {/* Render Platform 1 Train & Coaches */}
              {renderPlatformCoaches({
                train: activeP1Train,
                platformY: 52,
                isSelected: activeP1Train?.id === currentInspectedTrain?.id,
                onSelectTrain: (id) => setInspectedTrainId(id),
                lineColor: isRedLine && !isInterchange ? "#f43f5e" : "#3b82f6",
                fallbackDirection: isInterchange ? "Thaltej Gam" : isBlueLine ? "Thaltej Gam (UP)" : "Motera Stadium (UP)",
              })}

              {/* ── CONCOURSE LEVEL ── */}
              <rect x="50" y="195" width="740" height="90" rx="12" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
              <text x="68" y="215" fill="#64748b" fontSize="10" fontWeight="800" fontFamily="JetBrains Mono">
                CONCOURSE LEVEL · {activeStation.name.toUpperCase()} · DENSITY: {currentStationPax} PAX · GATES G1–G5
              </text>

              {/* Concourse Passenger Dots */}
              {Array.from({ length: dotCount }).map((_, i) => {
                const cx = 80 + ((i * 16) % 680);
                const cy = 222 + ((i * 7) % 55);
                return <circle key={i} cx={cx} cy={cy} r={1.8} fill="#2dd4bf" opacity={0.4} />;
              })}

              {/* Turnstile Gates G1–G5 */}
              {[75, 215, 355, 495, 635].map((x, i) => {
                const isOffline = i === 3;
                return (
                  <g key={x}>
                    <rect
                      x={x}
                      y="245"
                      width="60"
                      height="26"
                      rx="6"
                      fill={isOffline ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)"}
                      stroke={isOffline ? "#ef4444" : "#10b981"}
                      strokeWidth="1"
                    />
                    <circle cx={x + 12} cy="258" r="3" fill={isOffline ? "#ef4444" : "#10b981"} />
                    <text x={x + 20} y="261" fill="#ffffff" fontSize="10" fontFamily="JetBrains Mono" fontWeight="700">
                      G{i + 1}
                    </text>
                  </g>
                );
              })}

              {/* ── PLATFORM 2 SVG ZONE ── */}
              <line
                x1="50"
                y1="315"
                x2="790"
                y2="315"
                stroke={isBlueLine && !isInterchange ? "#3b82f6" : "#f43f5e"}
                strokeWidth="2"
                strokeOpacity="0.4"
              />
              <line
                x1="50"
                y1="430"
                x2="790"
                y2="430"
                stroke={isBlueLine && !isInterchange ? "#3b82f6" : "#f43f5e"}
                strokeWidth="2"
                strokeOpacity="0.4"
              />

              {/* Platform 2 Enclosure */}
              <rect
                x="50"
                y="317"
                width="740"
                height="110"
                rx="12"
                fill={isBlueLine && !isInterchange ? "rgba(59,130,246,0.04)" : "rgba(244,63,94,0.04)"}
                stroke={isBlueLine && !isInterchange ? "rgba(59,130,246,0.3)" : "rgba(244,63,94,0.3)"}
                strokeWidth="1.2"
              />

              {/* Render Platform 2 Train & Coaches */}
              {renderPlatformCoaches({
                train: activeP2Train,
                platformY: 317,
                isSelected: activeP2Train?.id === currentInspectedTrain?.id,
                onSelectTrain: (id) => setInspectedTrainId(id),
                lineColor: isBlueLine && !isInterchange ? "#3b82f6" : "#f43f5e",
                fallbackDirection: isInterchange ? "APMC" : isBlueLine ? "Vastral Gam (DOWN)" : "APMC (DOWN)",
              })}

              {/* Live Signal Telemetry Radar Ring */}
              <circle cx="770" cy="240" r="6" fill="#2dd4bf">
                <animate attributeName="r" values="6;16;6" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0;0.9" dur="2s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>

          {/* Footer Legend */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-obsidian-900/90 px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-accent-cyan animate-pulse" />
              <span>Active Station: {activeStation.id} · {activeStation.name} · Real-time DB Telemetry</span>
            </div>
            <div className="flex items-center gap-5 text-slate-400 font-mono">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" /> &lt;50% Optimal</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-500" /> 50-75% Mod</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-orange-500" /> 75-90% High</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-rose-500" /> &gt;90% Crit</span>
            </div>
          </div>

        </div>

        {/* ── RIGHT TELEMETRY & INSPECTION SIDEBAR ── */}
        <aside className="space-y-4">
          
          {/* Card 1: Selected Station Overview */}
          <div className="rounded-2xl border border-white/10 bg-obsidian-900 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-accent-cyan" /> Station Information
              </div>
              <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] font-bold text-white ring-1 ring-white/10">
                {activeStation.id}
              </span>
            </div>
            <h3 className="mt-2 text-base font-extrabold text-white">{activeStation.name}</h3>
            <p className="text-xs font-mono text-slate-400">{stMetadata.label} · {stMetadata.platforms}</p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-white/5 bg-[#050608] p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                  <Users className="size-3 text-accent-cyan" /> Current Crowd
                </div>
                <div className="mt-1 font-mono text-base font-extrabold text-white">
                  {currentStationPax.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">pax</span>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-[#050608] p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                  <Sparkles className="size-3 text-emerald-400" /> Next Inbound
                </div>
                <div className="mt-1 font-mono text-base font-extrabold text-emerald-400">
                  {topUpcoming[0]?.estimated_arrival_time || "1m 30s"}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Selected Train Deep Inspection */}
          <div className="rounded-2xl border border-white/10 bg-obsidian-900 p-5 shadow-xl backdrop-blur-xl">
            {currentInspectedTrain ? (
              <>
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  <div className="flex items-center gap-2">
                    <Radar className="size-4 text-accent-cyan" /> Train Inspection
                  </div>
                  <span className="rounded-md bg-accent-cyan/10 px-2.5 py-1 font-mono text-xs font-bold text-accent-cyan ring-1 ring-inset ring-accent-cyan/20">
                    {currentInspectedTrain.id}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-bold text-white">{currentInspectedTrain.direction}</h4>

                <div className="mt-2.5 flex items-center justify-between gap-2 border-b border-white/5 pb-3 text-xs font-mono text-slate-400">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    {currentInspectedTrain.status}
                  </span>
                  <span>Arr {currentInspectedTrain.arrival} · Dep {currentInspectedTrain.departure}</span>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Live Coach Heatmap</span>
                    <span className="font-mono text-slate-500">{currentInspectedTrain.coaches.length} Coaches</span>
                  </div>
                  {currentInspectedTrain.coaches.map((c) => (
                    <OccupancyBar key={c.id} label={`${c.label} (${c.occupancy}%)`} value={c.occupancy} />
                  ))}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Click any train tab or coach in the blueprint to inspect.
              </div>
            )}
          </div>

          {/* Card 3: Station Facilities & Systems Health */}
          <div className="rounded-2xl border border-white/10 bg-obsidian-900 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              <Box className="size-4 text-accent-cyan" /> Station Systems Health
            </div>
            <ul className="mt-3.5 space-y-2 text-xs">
              <Row label="HVAC Platform 1" value="22.4°C" tone="text-white" />
              <Row label="HVAC Platform 2" value="23.1°C" tone="text-emerald-400" />
              <Row label="Escalators E1–E4" value="Nominal" tone="text-emerald-400" />
              <Row label="Turnstile Gate 4" value="Nominal (Active)" tone="text-emerald-400" />
              <Row label="Optical Break-Beam" value="Synced (Live IoT)" tone="text-accent-cyan" />
              <Row label="CCTV Surveillance" value="48 / 48 Active" tone="text-emerald-400" />
            </ul>

            {stationAlerts.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="size-3.5" />
                  <span>Station Alert</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-200/80 leading-snug">
                  {stationAlerts[0]?.description || "High platform volume detected during peak hours."}
                </p>
              </div>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}

// Render Platform Coaches for a single focused train inside platform bounds
function renderPlatformCoaches({
  train,
  platformY,
  isSelected,
  onSelectTrain,
  lineColor,
  fallbackDirection,
}: {
  train: Train | null;
  platformY: number;
  isSelected: boolean;
  onSelectTrain: (id: string) => void;
  lineColor: string;
  fallbackDirection?: string;
}) {
  if (!train) {
    return (
      <g transform={`translate(100, ${platformY + 30})`}>
        <rect
          x="0"
          y="0"
          width="640"
          height="50"
          rx="8"
          fill="rgba(255,255,255,0.02)"
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray="4 4"
        />
        <text x="320" y="30" fill="#64748b" fontSize="11" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="600">
          TRACK CLEAR · NEXT INBOUND TRAIN APPROACHING ({fallbackDirection || "In Transit"})
        </text>
      </g>
    );
  }

  const coaches = train.coaches && train.coaches.length > 0 ? train.coaches : [
    { id: "c1", label: "C1 (Standard)", capacity: 400, occupancy: 35, passengers: 140 },
    { id: "c2", label: "C2 (Ladies)", capacity: 400, occupancy: 25, passengers: 100 },
    { id: "c3", label: "C3 (Standard)", capacity: 400, occupancy: 40, passengers: 160 },
  ];

  const isApproaching = train.status === "Approaching" || train.status === "En Route";
  const avgOcc = Math.round(coaches.reduce((s, c) => s + c.occupancy, 0) / coaches.length);

  const coachWidth = 200;
  const coachGap = 20;
  const startX = 100;

  return (
    <g onClick={() => onSelectTrain(train.id)} style={{ cursor: "pointer" }}>
      {/* Train Info Header Bar inside Platform */}
      <g transform={`translate(${startX}, ${platformY + 8})`}>
        <rect
          x="0"
          y="0"
          width="640"
          height="24"
          rx="6"
          fill="rgba(10, 12, 18, 0.95)"
          stroke={lineColor}
          strokeWidth="1.2"
        />

        {/* 1. Train ID */}
        <text x="12" y="16" fill="#ffffff" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono">
          🚆 <tspan fill={lineColor}>{train.id}</tspan>
        </text>

        {/* 2. Direction */}
        <text x="135" y="16" fill="#cbd5e1" fontSize="9.5" fontWeight="600" fontFamily="JetBrains Mono">
          ➔ {train.direction.replace(" Bound", "")}
        </text>

        {/* 3. Avg Occupancy */}
        <text x="330" y="16" fill="#94a3b8" fontSize="9.5" fontWeight="600" fontFamily="JetBrains Mono">
          Avg Load: <tspan fill="#ffffff" fontWeight="700">{avgOcc}%</tspan>
        </text>

        {/* 4. Status Badge */}
        {isApproaching ? (
          <g transform="translate(485, 3)">
            <rect
              x="0"
              y="0"
              width="145"
              height="18"
              rx="4"
              fill="rgba(245, 158, 11, 0.2)"
              stroke="#f59e0b"
              strokeWidth="1"
            />
            <circle cx="10" cy="9" r="3" fill="#f59e0b">
              <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
            </circle>
            <text x="18" y="13" fill="#f59e0b" fontSize="8.5" fontWeight="800" fontFamily="JetBrains Mono">
              APPROACHING · {train.etaSeconds ? `${Math.ceil(train.etaSeconds / 60)}m` : "1m"}
            </text>
          </g>
        ) : (
          <g transform="translate(525, 3)">
            <rect
              x="0"
              y="0"
              width="105"
              height="18"
              rx="4"
              fill="rgba(16, 185, 129, 0.2)"
              stroke="#10b981"
              strokeWidth="1"
            />
            <circle cx="10" cy="9" r="3" fill="#10b981">
              <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <text x="18" y="13" fill="#10b981" fontSize="8.5" fontWeight="800" fontFamily="JetBrains Mono">
              AT PLATFORM
            </text>
          </g>
        )}
      </g>

      {/* Approaching Signal Track Motion */}
      {isApproaching && (
        <path
          d={`M 50 ${platformY + 21} L 95 ${platformY + 21}`}
          stroke={lineColor}
          strokeWidth="3"
          strokeDasharray="6 4"
        >
          <animate attributeName="stroke-dashoffset" values="10;0" dur="0.6s" repeatCount="indefinite" />
        </path>
      )}

      {/* 3 Non-overlapping Coach Cards */}
      {coaches.map((c, idx) => {
        const cX = startX + idx * (coachWidth + coachGap);
        const cY = platformY + 38;
        const theme = getCoachTheme(c.occupancy);
        const paxCount = c.passengers ?? Math.round(((c.capacity || 400) * c.occupancy) / 100);

        return (
          <g key={c.id || idx}>
            <rect
              x={cX}
              y={cY}
              width={coachWidth}
              height="60"
              rx="8"
              fill={theme.fill}
              stroke={isSelected ? "#ffffff" : theme.stroke}
              strokeWidth={isSelected ? 1.8 : 1}
            />

            <text x={cX + 14} y={cY + 20} fill="#ffffff" fontSize="10.5" fontWeight="700" fontFamily="JetBrains Mono">
              {c.label || `Coach ${idx + 1}`}
            </text>

            <rect x={cX + coachWidth - 58} y={cY + 8} width="46" height="17" rx="4" fill="rgba(0,0,0,0.5)" stroke={theme.stroke} strokeWidth="0.8" />
            <text x={cX + coachWidth - 35} y={cY + 20} fill={theme.text} fontSize="9.5" fontWeight="800" textAnchor="middle" fontFamily="JetBrains Mono">
              {c.occupancy}%
            </text>

            <text x={cX + 14} y={cY + 38} fill="#94a3b8" fontSize="9.5" fontWeight="600" fontFamily="JetBrains Mono">
              {paxCount} pax / max {c.capacity || 400}
            </text>

            <rect x={cX + 14} y={cY + 46} width={coachWidth - 28} height="4" rx="2" fill="rgba(255,255,255,0.08)" />
            <rect
              x={cX + 14}
              y={cY + 46}
              width={Math.max(4, (coachWidth - 28) * (c.occupancy / 100))}
              height="4"
              rx="2"
              fill={theme.stroke}
            />
          </g>
        );
      })}
    </g>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <li className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
      <span className="text-slate-400 font-medium">{label}</span>
      <span className={`font-mono font-bold ${tone}`}>{value}</span>
    </li>
  );
}
