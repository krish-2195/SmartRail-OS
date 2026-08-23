import { useEffect, useState, useMemo, memo } from "react";
import { BLUE_LINE, RED_LINE, type Train, type Station } from "@/lib/mock/data";
import { useTrains } from "@/lib/api/hooks";
import { LineBadge } from "./badges";
import { cn } from "@/lib/utils";
import { Timer } from "lucide-react";
import { formatEta } from "@/lib/use-live-tick";

// Normalize station names and IDs for fast lookup
function normalizeStation(st: string): string {
  return (st || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Pre-build lookup maps for instant 0ms station resolution
function createStationLookup(lineStations: Station[]) {
  const map = new Map<string, Station>();
  for (let i = 0; i < lineStations.length; i++) {
    const s = lineStations[i];
    map.set(s.id.toLowerCase(), s);
    map.set(s.name.toLowerCase(), s);
    map.set(normalizeStation(s.id), s);
    map.set(normalizeStation(s.name), s);
    map.set(String(s.order), s);
    map.set(String(i + 1), s);
  }
  return map;
}

const blueMap = createStationLookup(BLUE_LINE);
const redMap = createStationLookup(RED_LINE);

function resolveStationFast(stIdOrName: string | undefined, isBlue: boolean): Station | undefined {
  if (!stIdOrName) return undefined;
  const raw = stIdOrName.trim().toLowerCase();
  const map = isBlue ? blueMap : redMap;
  const direct = map.get(raw);
  if (direct) return direct;
  const clean = normalizeStation(raw);
  return map.get(clean);
}

function formatFullStation(stIdOrName: string | undefined, isBlue: boolean): string {
  if (!stIdOrName) return "En Route";
  const st = resolveStationFast(stIdOrName, isBlue);
  if (st) return `${st.id}-${st.name}`;
  return stIdOrName;
}

function isUpTrain(train: Train, curIdx: number, nextIdx: number): boolean {
  if (curIdx !== nextIdx) return nextIdx > curIdx;
  const id = train.id.toUpperCase();
  const dir = (train.direction || "").toUpperCase();
  if (
    id.includes("UP") ||
    dir.includes("UP") ||
    dir.includes("VASTRAL") ||
    dir.includes("MOTERA") ||
    dir.includes("NORTH") ||
    dir.includes("EAST")
  ) {
    return true;
  }
  return false;
}

export function LiveTrainTicker({
  className,
  defaultLine = "all",
  stationLine,
}: {
  className?: string;
  defaultLine?: "all" | "blue" | "red";
  stationLine?: "blue" | "red";
}) {
  const trainsQ = useTrains();
  const trainsRaw = trainsQ.data ?? [];
  const trains = useMemo(
    () => trainsRaw,
    [trainsRaw]
  );
  const initialLine = stationLine || defaultLine;
  const [filterLine, setFilterLine] = useState<"all" | "blue" | "red">(initialLine);

  useEffect(() => {
    if (stationLine) {
      setFilterLine(stationLine);
    }
  }, [stationLine]);

  const filteredTrains = useMemo(() => {
    if (filterLine === "all") return trains;
    return trains.filter((t) => {
      const isBlue = t.line === "blue" || t.id.toLowerCase().startsWith("bl");
      return filterLine === "blue" ? isBlue : !isBlue;
    });
  }, [trains, filterLine]);

  const blueCount = useMemo(
    () => trains.filter((t) => t.line === "blue" || t.id.toLowerCase().startsWith("bl")).length,
    [trains]
  );
  const redCount = useMemo(
    () => trains.filter((t) => !(t.line === "blue" || t.id.toLowerCase().startsWith("bl"))).length,
    [trains]
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080a0f] p-5 shadow-xl",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <h3 className="flex items-center gap-2.5 text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-cyan opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-accent-cyan" />
          </span>
          Live Network Position
        </h3>

        {/* Line Filter Tabs / Static Respected Line Badge */}
        {stationLine ? (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider ring-1 shadow-sm font-mono",
              stationLine === "blue"
                ? "bg-blue-500/15 text-blue-400 ring-blue-500/30"
                : "bg-rose-500/15 text-rose-400 ring-rose-500/30"
            )}
          >
            <span className="size-1.5 rounded-full bg-current animate-pulse" />
            <span>{stationLine === "blue" ? "Blue Line" : "Red Line"}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setFilterLine("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold transition-all",
                filterLine === "all"
                  ? "bg-accent-cyan/20 text-accent-cyan shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              All ({trains.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterLine("blue")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold transition-all",
                filterLine === "blue"
                  ? "bg-blue-500/20 text-blue-400 shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Blue ({blueCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterLine("red")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold transition-all",
                filterLine === "red"
                  ? "bg-rose-500/20 text-rose-400 shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Red ({redCount})
            </button>
          </div>
        )}
      </div>

      {/* Train rows list with stealth dark scrollbar */}
      <div className="mt-4 max-h-[480px] space-y-3.5 overflow-x-hidden overflow-y-auto pr-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
        {filteredTrains.length === 0 ? (
          <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#050608] text-center">
            <p className="text-sm font-medium text-slate-300">No Trains on Line</p>
            <p className="text-xs text-slate-500">No active trains found for the selected filter.</p>
          </div>
        ) : (
          filteredTrains.map((t) => {
            const isBlue = t.line === "blue" || t.id.toLowerCase().startsWith("bl");
            const stations = isBlue ? BLUE_LINE : RED_LINE;
            return <TrainTickerRow key={t.id} train={t} stations={stations} isBlue={isBlue} />;
          })
        )}
      </div>
    </div>
  );
}

const TrainTickerRow = memo(function TrainTickerRow({
  train,
  stations,
  isBlue,
}: {
  train: Train;
  stations: Station[];
  isBlue: boolean;
}) {
  const initialEta = train.etaSeconds > 0 ? train.etaSeconds : train.status === "At Station" ? 0 : 35;
  const [secondsRemaining, setSecondsRemaining] = useState<number>(initialEta);

  useEffect(() => {
    const newEta = train.etaSeconds > 0 ? train.etaSeconds : train.status === "At Station" ? 0 : 35;
    setSecondsRemaining(newEta);
  }, [train.etaSeconds, train.status, train.currentStationId, train.nextStationId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const curStationObj = useMemo(
    () => resolveStationFast(train.currentStationId, isBlue),
    [train.currentStationId, isBlue]
  );
  const nextStationObj = useMemo(
    () => resolveStationFast(train.nextStationId, isBlue),
    [train.nextStationId, isBlue]
  );

  const curIdx = curStationObj ? stations.indexOf(curStationObj) : 0;
  const isUp = useMemo(
    () => isUpTrain(train, curIdx, nextStationObj ? stations.indexOf(nextStationObj) : curIdx),
    [train, curIdx, nextStationObj, stations]
  );

  const nextIdx = nextStationObj
    ? stations.indexOf(nextStationObj)
    : isUp
    ? Math.min(stations.length - 1, curIdx + 1)
    : Math.max(0, curIdx - 1);

  const curStationFullName = useMemo(
    () => formatFullStation(train.currentStationId, isBlue),
    [train.currentStationId, isBlue]
  );

  const nextStationFullName = useMemo(() => {
    if (nextStationObj) return `${nextStationObj.id}-${nextStationObj.name}`;
    const target = stations[nextIdx] || stations[curIdx];
    return target ? `${target.id}-${target.name}` : "In Transit";
  }, [nextStationObj, stations, nextIdx, curIdx]);

  const liveTimerFormatted = formatEta(secondsRemaining);

  // Position calculation across station stops
  const totalStops = Math.max(stations.length - 1, 1);
  const startPct = (curIdx / totalStops) * 100;
  const targetPct = (nextIdx / totalStops) * 100;
  const totalHopDuration = Math.max(15, train.etaSeconds || 35);
  const hopProgress =
    train.status === "At Station"
      ? 0
      : secondsRemaining === 0
      ? 1
      : Math.max(0, Math.min(1, 1 - secondsRemaining / totalHopDuration));

  // Continuous interpolated percentage along track line
  const rawPct = startPct + hopProgress * (targetPct - startPct);
  const pct = Math.max(2, Math.min(98, rawPct));

  // Vibrant line colors and active glowing gradients
  const lineColor = isBlue
    ? "bg-blue-500 shadow-lg shadow-blue-500/80 ring-2 ring-blue-300"
    : "bg-rose-500 shadow-lg shadow-rose-500/80 ring-2 ring-rose-300";

  const lineGlow = isBlue
    ? "from-blue-600/40 via-blue-500 to-cyan-400 shadow-[0_0_12px_rgba(59,130,246,0.8)]"
    : "from-rose-600/40 via-rose-500 to-amber-400 shadow-[0_0_12px_rgba(244,63,94,0.8)]";

  const directionLabel = train.direction?.toUpperCase().endsWith("BOUND")
    ? train.direction
    : `${train.direction || ""} Bound`.trim();

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#050608] p-4 transition-colors duration-200 hover:border-white/10 hover:bg-[#07090e]">
      {/* Train Info Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-obsidian-800 px-2.5 py-1 font-mono text-xs font-bold text-accent-cyan ring-1 ring-white/10">
            {train.id}
          </span>
          <LineBadge line={train.line} />
        </div>

        {/* Live Ticking Next Station Pill with Full CODE-Name */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1 font-mono text-[11px] font-bold text-accent-cyan shadow-sm">
            <Timer className="size-3 text-accent-cyan animate-pulse" />
            <span>Next: {nextStationFullName}</span>
            <span className="ml-1 rounded bg-accent-cyan/20 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
              {train.status === "At Station"
                ? "AT PLATFORM"
                : secondsRemaining === 0
                ? "ARRIVING"
                : `ETA ${liveTimerFormatted}`}
            </span>
          </div>

          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-slate-500">
            {directionLabel}
          </span>
        </div>
      </div>

      {/* Realistic Dynamic Track Line with Floating Station Code Label Above Dot */}
      <div className="relative mt-8 mb-2 h-10 select-none">
        {/* Track Base Rail */}
        <div className="absolute inset-x-0 bottom-2 h-2 rounded-full bg-slate-800/90 shadow-inner" />

        {/* Active Vibrant Illuminated Rail */}
        <div
          className={cn(
            "absolute bottom-2 h-2 rounded-full bg-gradient-to-r transition-all duration-700 ease-out",
            lineGlow
          )}
          style={
            isUp
              ? { left: 0, width: `${pct}%` }
              : { left: `${pct}%`, width: `${100 - pct}%` }
          }
        />

        {/* Station Ticks along the Line with Vivid Active Colors */}
        {stations.map((st, idx) => {
          const stPct = (idx / (stations.length - 1)) * 100;
          const isPassed = isUp ? stPct <= pct : stPct >= pct;
          const isNext =
            nextStationObj?.id === st.id ||
            normalizeStation(nextStationFullName).includes(normalizeStation(st.id));

          return (
            <div
              key={st.id}
              className="absolute bottom-2 -translate-x-1/2 translate-y-1/2 flex flex-col items-center z-10"
              style={{ left: `${stPct}%` }}
              title={`${st.id}-${st.name}`}
            >
              <span
                className={cn(
                  "block rounded-full transition-all duration-300",
                  isNext
                    ? "size-3 bg-accent-cyan ring-4 ring-accent-cyan/50 animate-pulse shadow-[0_0_10px_#2dd4bf]"
                    : isPassed
                    ? isBlue
                      ? "size-2 bg-blue-400 ring-2 ring-blue-500/50 shadow-[0_0_8px_#3b82f6]"
                      : "size-2 bg-rose-400 ring-2 ring-rose-500/50 shadow-[0_0_8px_#f43f5e]"
                    : "size-1.5 bg-slate-700"
                )}
              />
            </div>
          );
        })}

        {/* Smooth Moving Train Marker Pod with Full CODE-Name */}
        <div
          className="absolute bottom-2 -translate-x-1/2 translate-y-1/2 transition-all duration-700 ease-out z-20 will-change-transform"
          style={{ left: `${pct}%` }}
        >
          {/* Station CODE-Name Floating Badge */}
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-30">
            <div className="flex items-center gap-1.5 rounded-md border border-accent-cyan/40 bg-[#080a0f] px-2 py-0.5 shadow-2xl ring-1 ring-black/70">
              <span className="size-1.5 rounded-full bg-accent-cyan animate-pulse" />
              <span className="font-mono text-[10px] font-extrabold text-white tracking-tight">
                {curStationFullName}
              </span>
            </div>
            <div className="mx-auto size-0 border-x-4 border-x-transparent border-t-4 border-t-[#080a0f]" />
          </div>

          {/* Glowing Beacon Dot Icon */}
          <div
            className={cn(
              "relative flex size-4 items-center justify-center rounded-full ring-4 ring-black/70 shadow-lg",
              lineColor
            )}
          >
            <span className={cn("absolute inset-0 animate-ping rounded-full opacity-70", lineColor)} />
            <span className="size-1.5 rounded-full bg-white shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  );
});
