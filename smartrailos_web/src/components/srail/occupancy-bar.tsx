import { cn } from "@/lib/utils";

export function OccupancyBar({
  value,
  label,
  className,
  showPaxCount,
}: {
  value: number;
  label?: string;
  className?: string;
  showPaxCount?: boolean;
}) {
  const status =
    value < 50 ? "bg-emerald-500" : value < 75 ? "bg-amber-500" : "bg-rose-500";
  const text =
    value < 50 ? "text-emerald-400" : value < 75 ? "text-amber-400" : "text-rose-400";

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <span>{label}</span>
          <span className={cn("font-mono tabular-nums", text)}>{value}%</span>
        </div>
      )}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", status)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
