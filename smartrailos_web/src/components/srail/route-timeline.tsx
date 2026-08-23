import { BLUE_LINE, RED_LINE, type Train } from "@/lib/mock/data";
import { cn } from "@/lib/utils";

export function RouteTimeline({ train }: { train: Train }) {
  if (!train) return null;
  const isBlue = train.line === "blue";
  const lineStations = isBlue ? BLUE_LINE : RED_LINE;

  // Normalize station IDs for reliable matching (e.g. "BL08", "bl-8", "BL-08", "BL08_STATION")
  const norm = (id: string) => (id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  
  const trainCurrentNorm = norm(train.currentStationId);
  const trainNextNorm = norm(train.nextStationId);

  let currentIdx = lineStations.findIndex((s) => norm(s.id) === trainCurrentNorm || norm(s.name) === trainCurrentNorm);
  if (currentIdx < 0) {
    currentIdx = lineStations.findIndex((s) => norm(s.id) === trainNextNorm || norm(s.name) === trainNextNorm);
  }
  if (currentIdx < 0) {
    const rawPos = (train as any).currentPosition ?? (train as any).journey_completed_pct;
    const pct = typeof rawPos === "number" ? rawPos / 100 : 0.5;
    currentIdx = Math.max(0, Math.min(lineStations.length - 1, Math.floor(pct * (lineStations.length - 1))));
  }

  // Display a window of 7 stations around the current train index
  const windowStart = Math.max(0, Math.min(lineStations.length - 7, currentIdx - 3));
  const visibleStations = lineStations.slice(windowStart, windowStart + 7);
  const activeStationIdxInWindow = visibleStations.findIndex((s) => norm(s.id) === trainCurrentNorm);
  const activeIdx = activeStationIdxInWindow >= 0 ? activeStationIdxInWindow : 3;

  return (
    <div className="rounded-xl border border-white/5 bg-obsidian-900 p-4 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Live Route Progress · {isBlue ? "Blue Line" : "Red Line"}
        </h4>
        <span className="font-mono text-[10px] font-bold text-accent-cyan">
          Active Station: {visibleStations[activeIdx]?.name ?? "En Route"}
        </span>
      </div>

      <div className="relative pt-2 pb-1">
        {/* Track Line */}
        <div className="absolute left-3 right-3 top-5 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        
        {/* Filled Progress Line */}
        <div
          className={cn(
            "absolute left-3 top-5 h-1 -translate-y-1/2 rounded-full transition-all duration-700",
            isBlue ? "bg-gradient-to-r from-blue-600 to-cyan-400" : "bg-gradient-to-r from-rose-600 to-amber-400"
          )}
          style={{ width: `${(activeIdx / (visibleStations.length - 1)) * 92}%` }}
        />

        <div className="relative flex justify-between">
          {visibleStations.map((st, i) => {
            const passed = i < activeIdx;
            const isCurrent = i === activeIdx;
            const isNext = i === activeIdx + 1;
            const diffStations = i - activeIdx;
            const nextEtaMin = train.etaSeconds ? Math.max(1, Math.round(train.etaSeconds / 60)) : 2;
            const upcomingMinutes = isNext ? nextEtaMin : (diffStations > 0 ? nextEtaMin + (diffStations - 1) * 2 : 0);

            return (
              <div key={st.id} className="flex w-20 flex-col items-center text-center">
                <div
                  className={cn(
                    "z-10 grid size-6 place-items-center rounded-full border-2 transition-all",
                    isCurrent
                      ? isBlue
                        ? "border-cyan-400 bg-cyan-500 shadow-md shadow-cyan-500/50 animate-pulse"
                        : "border-rose-400 bg-rose-500 shadow-md shadow-rose-500/50 animate-pulse"
                      : isNext
                      ? "border-amber-400 bg-amber-500/40 text-amber-300 ring-2 ring-amber-400/30 animate-pulse"
                      : passed
                      ? "border-slate-500 bg-slate-700 text-white"
                      : "border-white/10 bg-obsidian-950 text-slate-600"
                  )}
                >
                  {isCurrent ? (
                    <div className="size-2 rounded-full bg-white" />
                  ) : isNext ? (
                    <div className="size-1.5 rounded-full bg-amber-300" />
                  ) : passed ? (
                    <div className="size-1.5 rounded-full bg-slate-300" />
                  ) : null}
                </div>
                
                <div
                  className={cn(
                    "mt-2 line-clamp-2 text-[9.5px] font-bold leading-tight transition-colors",
                    isCurrent
                      ? "text-accent-cyan font-extrabold"
                      : isNext
                      ? "text-amber-300 font-bold"
                      : passed
                      ? "text-slate-400"
                      : "text-slate-500"
                  )}
                >
                  {st.name}
                </div>

                <div className="mt-1 font-mono text-[8.5px]">
                  {isCurrent ? (
                    <span className="rounded bg-accent-cyan/20 px-1 py-0.2 font-bold text-accent-cyan">
                      Current
                    </span>
                  ) : isNext ? (
                    <span className="rounded bg-amber-500/20 px-1 py-0.2 font-bold text-amber-400">
                      Next Stop
                    </span>
                  ) : passed ? (
                    <span className="text-slate-600">Passed</span>
                  ) : (
                    <span className="text-slate-400">+{upcomingMinutes}m</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
