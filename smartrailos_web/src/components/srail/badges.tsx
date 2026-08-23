import { cn } from "@/lib/utils";
import { riskFor, type Train } from "@/lib/mock/data";

const FLAT_RISK_PILL = {
  Low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Moderate: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  High: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  Critical: "bg-rose-600/25 text-rose-300 border-rose-500/30",
};

export function RiskBadge({ train, className }: { train: Train; className?: string }) {
  const risk = riskFor(train);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
        FLAT_RISK_PILL[risk],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {risk}
    </span>
  );
}

export function LineBadge({ line, className }: { line: "blue" | "red"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
        line === "blue"
          ? "border-blue-500/20 bg-blue-500/15 text-blue-400"
          : "border-rose-500/20 bg-rose-500/15 text-rose-400",
        className,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", line === "blue" ? "bg-blue-400" : "bg-rose-400")}
      />
      {line === "blue" ? "Blue Line" : "Red Line"}
    </span>
  );
}
