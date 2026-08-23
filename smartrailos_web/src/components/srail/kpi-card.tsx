import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  delta,
  deltaTone = "neutral",
  icon,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaTone?: "positive" | "negative" | "warning" | "neutral";
  icon?: ReactNode;
  hint?: string;
  className?: string;
}) {
  const tone =
    deltaTone === "positive"
      ? "text-emerald-400 bg-emerald-500/10"
      : deltaTone === "negative"
        ? "text-rose-400 bg-rose-500/10"
        : deltaTone === "warning"
          ? "text-amber-400 bg-amber-500/10"
          : "text-cyan-400 bg-cyan-500/10";
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080a0f] p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:bg-[#0c0e16]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{label}</p>
        {icon && (
          <span className="grid size-7 place-items-center rounded-lg bg-white/[0.04] text-slate-400 transition-colors group-hover:text-cyan-400">
            {icon}
          </span>
        )}
      </div>

      {/* Bright white primary data metrics in geometric sans-serif typeface */}
      <div className="mt-4 font-sans text-3xl font-extrabold tabular-nums tracking-tight text-white md:text-4xl">
        {value}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {delta && (
          <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider", tone)}>
            {delta}
          </span>
        )}
        {hint && <span className="font-mono text-[10px] text-slate-500">{hint}</span>}
      </div>
    </div>
  );
}
