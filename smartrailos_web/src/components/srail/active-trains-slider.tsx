import { useState, useMemo, useEffect } from "react";
import { type Train } from "@/lib/mock/data";
import { TrainCard } from "./train-card";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, TrainFront } from "lucide-react";

export function ActiveTrainsSlider({
  trains,
  className,
  defaultLine = "all",
  stationLine,
}: {
  trains: Train[];
  className?: string;
  defaultLine?: "all" | "blue" | "red";
  stationLine?: "blue" | "red";
}) {
  const initialLine = stationLine || defaultLine;
  const [selectedLine, setSelectedLine] = useState<"all" | "blue" | "red">(initialLine);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (stationLine) {
      setSelectedLine(stationLine);
    }
  }, [stationLine]);

  // Filter trains based on selected line
  const filteredTrains = useMemo(() => {
    if (selectedLine === "all") return trains;
    return trains.filter((t) => {
      const isBlue = t.line === "blue" || t.id.toLowerCase().startsWith("bl");
      return selectedLine === "blue" ? isBlue : !isBlue;
    });
  }, [trains, selectedLine]);

  // Reset index when filter tab changes or if out of bounds
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedLine]);

  useEffect(() => {
    if (currentIndex >= filteredTrains.length && filteredTrains.length > 0) {
      setCurrentIndex(filteredTrains.length - 1);
    }
  }, [filteredTrains.length, currentIndex]);

  // Counts for tabs
  const blueCount = useMemo(
    () => trains.filter((t) => t.line === "blue" || t.id.toLowerCase().startsWith("bl")).length,
    [trains]
  );
  const redCount = useMemo(
    () => trains.filter((t) => t.line === "red" || t.id.toLowerCase().startsWith("rl")).length,
    [trains]
  );

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < filteredTrains.length - 1;

  const handlePrev = () => {
    if (canGoPrev) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const currentTrain = filteredTrains[currentIndex];

  return (
    <section className={cn("space-y-4", className)}>
      {/* Header with Title, Filter Tabs & 1-by-1 Slider Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-cyan opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-accent-cyan" />
            </span>
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-slate-200">
              Active Train Units
            </h2>
          </div>
          {filteredTrains.length > 0 && (
            <span className="rounded-full bg-accent-cyan/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-accent-cyan ring-1 ring-accent-cyan/20">
              Unit {currentIndex + 1} of {filteredTrains.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Line Filter Tabs / Static Respected Line Badge */}
          {stationLine ? (
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-extrabold uppercase tracking-wider ring-1 shadow-sm",
                stationLine === "blue"
                  ? "bg-blue-500/15 text-blue-400 ring-blue-500/30"
                  : "bg-rose-500/15 text-rose-400 ring-rose-500/30"
              )}
            >
              <span className="size-2 rounded-full bg-current animate-pulse" />
              <span>{stationLine === "blue" ? "Blue Line Corridor" : "Red Line Corridor"}</span>
            </div>
          ) : (
            <div className="flex items-center rounded-lg bg-[#10131c] p-0.5 ring-1 ring-white/10">
              <button
                type="button"
                onClick={() => setSelectedLine("all")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide transition-all",
                  selectedLine === "all"
                    ? "bg-accent-cyan text-obsidian-950 shadow-sm font-extrabold"
                    : "text-slate-400 hover:text-white"
                )}
              >
                All ({trains.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedLine("blue")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide transition-all",
                  selectedLine === "blue"
                    ? "bg-blue-500 text-white shadow-sm font-extrabold"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Blue ({blueCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedLine("red")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide transition-all",
                  selectedLine === "red"
                    ? "bg-rose-500 text-white shadow-sm font-extrabold"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Red ({redCount})
              </button>
            </div>
          )}

          {/* Slider Arrow Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              disabled={!canGoPrev}
              aria-label="Previous active train"
              className={cn(
                "flex size-8 items-center justify-center rounded-lg border transition-all",
                canGoPrev
                  ? "border-white/15 bg-white/10 text-white hover:border-accent-cyan/60 hover:bg-accent-cyan/20 hover:text-accent-cyan active:scale-95 shadow-sm"
                  : "border-white/5 bg-white/[0.02] text-slate-600 opacity-30 cursor-not-allowed"
              )}
            >
              <ChevronLeft className="size-4" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              aria-label="Next active train"
              className={cn(
                "flex size-8 items-center justify-center rounded-lg border transition-all",
                canGoNext
                  ? "border-white/15 bg-white/10 text-white hover:border-accent-cyan/60 hover:bg-accent-cyan/20 hover:text-accent-cyan active:scale-95 shadow-sm"
                  : "border-white/5 bg-white/[0.02] text-slate-600 opacity-30 cursor-not-allowed"
              )}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Full-Width Card Display with Smooth Slide Transitions */}
      {trains.length === 0 ? (
        <div className="flex h-44 flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#07090e] p-6 text-center shadow-xl">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10 mb-3">
            <TrainFront className="size-6 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-white">Metro Service Closed (Overnight Maintenance)</p>
          <p className="mt-1 text-xs text-slate-400 max-w-md">
            All train units are securely stabled in terminal depots. Live circulating fleet will resume at 06:00 AM.
          </p>
        </div>
      ) : filteredTrains.length === 0 ? (
        <div className="flex h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#141720]/50 text-center">
          <TrainFront className="mb-2 size-6 text-slate-500" />
          <p className="text-sm font-medium text-slate-300">No Trains on Selected Line</p>
          <p className="text-xs text-slate-500">Select "All" to view units operating across the network.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Full-width card container preserving exact original spacious dimensions */}
          <div key={currentTrain.id} className="w-full animate-fade-in-up">
            <TrainCard train={currentTrain} className="w-full" />
          </div>

          {/* Interactive Pagination Dots / Indicator Pills */}
          {filteredTrains.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {filteredTrains.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Jump to train ${t.id}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    idx === currentIndex
                      ? "w-7 bg-accent-cyan shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                      : "w-2 bg-white/20 hover:bg-white/40"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
