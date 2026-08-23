import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import { useCrowdForecast, useTrains } from "@/lib/api/hooks";
import { useMemo } from "react";

export function CrowdForecast({ className }: { className?: string }) {
  const trainsQ = useTrains();
  const trainsRaw = trainsQ.data ?? [];
  const forecastQ = useCrowdForecast();
  const rawForecast = forecastQ.data ?? [];
  const hasData = rawForecast.length > 0 && trainsRaw.length > 0;

  // Normalize data keys (supporting both label/value and time/predicted_passengers)
  const forecastData = useMemo(() => {
    return rawForecast.map((f: any) => ({
      label: f.label ?? f.time ?? "",
      value: Number(f.value ?? f.predicted_passengers ?? 0),
      delta: f.delta ?? 0,
    }));
  }, [rawForecast]);

  const max = Math.max(...forecastData.map((f) => f.value), 1);
  
  return (
    <div className={cn("rounded-xl border border-white/5 bg-obsidian-900 p-6", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">
          Station Crowd Forecast
        </h3>
        {hasData && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-warning">
            <TrendingUp className="size-3" /> Surge expected +30m
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="mt-6 flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-obsidian-900/50 text-center">
          <p className="text-sm font-medium text-slate-300">No Data Available</p>
          <p className="text-xs text-slate-500">Forecasting requires active train operations.</p>
        </div>
      ) : (
        <div className="mt-6 flex h-40 items-end gap-2 md:gap-3">
        {forecastData.map((f, i) => {
          const h = Math.max(8, (f.value / max) * 100);
          const isPeak = f.value === max && f.value > 0;
          return (
            <div key={f.label || i} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex h-full w-full items-end">
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all duration-700",
                    isPeak ? "bg-warning" : i === 0 ? "bg-accent-cyan" : "bg-accent-cyan/40",
                  )}
                  style={{ height: `${h}%` }}
                />
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] tabular-nums text-slate-400">
                  {f.value.toLocaleString()}
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                {f.label}
              </span>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
