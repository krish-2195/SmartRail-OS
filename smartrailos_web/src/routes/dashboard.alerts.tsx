import { createFileRoute } from "@tanstack/react-router";
import { SectionHeader } from "./dashboard.index";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCheck,
  X,
  Loader2,
  AlertTriangle,
  Flame,
  Info,
  Clock,
  Compass,
  TrainFront,
  ShieldAlert,
  Users,
  ZapOff,
} from "lucide-react";
import { useAlerts, useAcknowledgeAlert, useResolveAlert } from "@/lib/api/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queries";

export const Route = createFileRoute("/dashboard/alerts")({
  head: () => ({
    meta: [
      { title: "Alert Center · SmartRail OS Operations" },
      { name: "description", content: "Acknowledge and resolve real-time railway operational alerts across Ahmedabad Metro." },
    ],
  }),
  component: AlertsPage,
});

const ALERT_SEVERITY_STYLES: Record<
  string,
  { badge: string; border: string; bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Emergency: {
    badge: "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse",
    border: "border-rose-500/40 hover:border-rose-500/60",
    bg: "bg-rose-950/20",
    icon: Flame,
  },
  Critical: {
    badge: "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse",
    border: "border-rose-500/40 hover:border-rose-500/60",
    bg: "bg-rose-950/20",
    icon: Flame,
  },
  "System Warning": {
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    border: "border-amber-500/30 hover:border-amber-500/50",
    bg: "bg-amber-950/15",
    icon: AlertTriangle,
  },
  Warning: {
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    border: "border-amber-500/30 hover:border-amber-500/50",
    bg: "bg-amber-950/15",
    icon: AlertTriangle,
  },
  Overcrowding: {
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    border: "border-rose-500/30 hover:border-rose-500/50",
    bg: "bg-rose-950/15",
    icon: Users,
  },
  "Platform Congestion": {
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    border: "border-amber-500/30 hover:border-amber-500/50",
    bg: "bg-amber-950/15",
    icon: Users,
  },
  "Coach Full": {
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    border: "border-purple-500/30 hover:border-purple-500/50",
    bg: "bg-purple-950/15",
    icon: TrainFront,
  },
  "Sensor Failure": {
    badge: "bg-red-500/20 text-red-400 border-red-500/40",
    border: "border-red-500/30 hover:border-red-500/50",
    bg: "bg-red-950/15",
    icon: ZapOff,
  },
  Advisory: {
    badge: "bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40",
    border: "border-accent-cyan/30 hover:border-accent-cyan/50",
    bg: "bg-accent-cyan/10",
    icon: Info,
  },
  Info: {
    badge: "bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40",
    border: "border-accent-cyan/30 hover:border-accent-cyan/50",
    bg: "bg-accent-cyan/10",
    icon: Info,
  },
  Minor: {
    badge: "bg-slate-500/20 text-slate-400 border-slate-500/40",
    border: "border-white/10 hover:border-white/20",
    bg: "bg-obsidian-900/40",
    icon: Clock,
  },
};

function AlertsPage() {
  const alertsQ = useAlerts();
  const ackM = useAcknowledgeAlert();
  const resM = useResolveAlert();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"all" | "active" | "emergency" | "acknowledged" | "resolved">("active");
  const [pendingAckId, setPendingAckId] = useState<string | null>(null);
  const [pendingResId, setPendingResId] = useState<string | null>(null);

  const rawAlerts = alertsQ.data || [];

  const activeCount = rawAlerts.filter((a) => !a.resolved).length;
  const emergencyCount = rawAlerts.filter((a) => !a.resolved && a.severity === "Emergency").length;
  const acknowledgedCount = rawAlerts.filter((a) => !a.resolved && a.acknowledged).length;
  const resolvedCount = rawAlerts.filter((a) => a.resolved).length;

  const list = rawAlerts.filter((a) => {
    if (filter === "active") return !a.resolved;
    if (filter === "emergency") return !a.resolved && a.severity === "Emergency";
    if (filter === "acknowledged") return !a.resolved && a.acknowledged;
    if (filter === "resolved") return a.resolved;
    return true; // "all"
  });

  const activeEmergency = rawAlerts.find((a) => !a.resolved && a.severity === "Emergency");

  const handleAcknowledge = async (id: string) => {
    setPendingAckId(id);
    try {
      await ackM.mutateAsync(id);
      qc.setQueryData(queryKeys.alerts, (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((item) => (item.id === id ? { ...item, acknowledged: true } : item));
      });
    } finally {
      setPendingAckId(null);
    }
  };

  const handleResolve = async (id: string) => {
    setPendingResId(id);
    try {
      await resM.mutateAsync(id);
      qc.setQueryData(queryKeys.alerts, (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((item) => (item.id === id ? { ...item, resolved: true } : item));
      });
    } finally {
      setPendingResId(null);
    }
  };

  return (
    <div className="space-y-6 px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <SectionHeader
        title="Alert Center & Incident Dispatch"
        right={`${activeCount} Active Incidents (${emergencyCount} Critical)`}
      />

      {/* Emergency Hero Banner */}
      {activeEmergency && (
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/50 bg-gradient-to-r from-rose-950/80 via-rose-900/40 to-obsidian-950 p-6 shadow-2xl backdrop-blur-xl">
          <div className="absolute -right-8 -top-8 size-40 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-rose-500/50 bg-rose-500/20 text-rose-400 shadow-lg animate-bounce">
                <Flame className="size-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/60 bg-rose-500/30 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-rose-300 animate-pulse">
                    Priority 1 Emergency Incident
                  </span>
                  {activeEmergency.stationName && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/10 px-2 py-0.5 font-mono text-xs font-bold text-white">
                      <Compass className="size-3 text-accent-cyan" />
                      {activeEmergency.stationName}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-white tracking-wide">{activeEmergency.title}</h2>
                <p className="text-sm text-rose-200/90 leading-relaxed">{activeEmergency.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => handleAcknowledge(activeEmergency.id)}
                disabled={activeEmergency.acknowledged || (ackM.isPending && pendingAckId === activeEmergency.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider transition-all",
                  activeEmergency.acknowledged
                    ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-300 opacity-90 cursor-not-allowed"
                    : "border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/40 shadow-lg"
                )}
              >
                {ackM.isPending && pendingAckId === activeEmergency.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : activeEmergency.acknowledged ? (
                  <CheckCheck className="size-4 text-emerald-400" />
                ) : (
                  <Check className="size-4" />
                )}
                <span>{activeEmergency.acknowledged ? "Acknowledged" : "Acknowledge"}</span>
              </button>

              <button
                onClick={() => handleResolve(activeEmergency.id)}
                disabled={resM.isPending && pendingResId === activeEmergency.id}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-500/60 bg-rose-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-xl hover:bg-rose-500 transition-all disabled:opacity-50"
              >
                {resM.isPending && pendingResId === activeEmergency.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="size-4" />
                )}
                <span>Resolve</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#080a0f] p-1.5 w-fit shadow-md">
        <button
          onClick={() => setFilter("active")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
            filter === "active"
              ? "bg-accent-cyan text-obsidian-950 shadow-md font-black"
              : "text-slate-400 hover:bg-white/5 hover:text-white"
          )}
        >
          Active Incidents ({activeCount})
        </button>

        <button
          onClick={() => setFilter("emergency")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
            filter === "emergency"
              ? "bg-rose-600 text-white shadow-md font-black"
              : "text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
          )}
        >
          <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
          Critical Emergency ({emergencyCount})
        </button>

        <button
          onClick={() => setFilter("acknowledged")}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
            filter === "acknowledged"
              ? "bg-emerald-600 text-white shadow-md font-black"
              : "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
          )}
        >
          Acknowledged ({acknowledgedCount})
        </button>

        <button
          onClick={() => setFilter("resolved")}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
            filter === "resolved"
              ? "bg-white/20 text-white shadow-md font-black"
              : "text-slate-400 hover:bg-white/5 hover:text-white"
          )}
        >
          Resolved Archive ({resolvedCount})
        </button>

        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
            filter === "all"
              ? "bg-white/20 text-white shadow-md font-black"
              : "text-slate-400 hover:bg-white/5 hover:text-white"
          )}
        >
          All ({rawAlerts.length})
        </button>
      </div>

      {/* Incident List */}
      <div className="space-y-3.5">
        {list.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#080a0f] p-12 text-center shadow-lg">
            <ShieldAlert className="mx-auto size-8 text-slate-600" />
            <h4 className="mt-3 text-sm font-bold text-white">No incidents in this view</h4>
            <p className="mt-1 text-xs text-slate-500">All railway sectors are currently operating safely within normal parameters.</p>
          </div>
        ) : (
          list.map((a) => {
            const style = ALERT_SEVERITY_STYLES[a.severity] || ALERT_SEVERITY_STYLES["System Warning"];
            const Icon = style.icon;
            const isAckPending = ackM.isPending && pendingAckId === a.id;
            const isResPending = resM.isPending && pendingResId === a.id;

            return (
              <div
                key={a.id}
                className={cn(
                  "relative rounded-2xl border p-5 transition-all",
                  style.border,
                  a.resolved ? "bg-[#050608] opacity-50 border-white/5" : style.bg
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left info */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-xl border",
                        style.badge
                      )}
                    >
                      <Icon className="size-4" />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                            style.badge
                          )}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          {a.severity}
                        </span>

                        {a.stationName && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                            <Compass className="size-3 text-accent-cyan" />
                            {a.stationName}
                          </span>
                        )}

                        {a.trainId && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-950/40 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-300">
                            <TrainFront className="size-3 text-blue-400" />
                            {a.trainId}
                          </span>
                        )}

                        <span className="font-mono text-[11px] text-slate-500">
                          {a.time || "Just now"}
                        </span>

                        {a.acknowledged && !a.resolved && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            <CheckCheck className="size-3" />
                            Acknowledged
                          </span>
                        )}

                        {a.resolved && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-500/30 bg-slate-800/40 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                            ✓ Resolved
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-white md:text-base">{a.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{a.description}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {!a.resolved && (
                    <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">
                      <button
                        onClick={() => handleAcknowledge(a.id)}
                        disabled={a.acknowledged || isAckPending}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all",
                          a.acknowledged
                            ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300 cursor-not-allowed opacity-80"
                            : "border-white/10 bg-white/5 text-slate-200 hover:border-emerald-500/40 hover:bg-emerald-950/30 hover:text-emerald-300"
                        )}
                      >
                        {isAckPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : a.acknowledged ? (
                          <CheckCheck className="size-3.5 text-emerald-400" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        <span>{a.acknowledged ? "Acknowledged" : "Acknowledge"}</span>
                      </button>

                      <button
                        onClick={() => handleResolve(a.id)}
                        disabled={isResPending}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-accent-cyan/40 bg-accent-cyan/15 px-3 py-1.5 text-xs font-bold text-accent-cyan transition-all hover:bg-accent-cyan hover:text-obsidian-950 disabled:opacity-50"
                      >
                        {isResPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <X className="size-3.5" />
                        )}
                        <span>Resolve</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
