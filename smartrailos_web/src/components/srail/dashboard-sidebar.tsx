import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  TrainFront,
  ArrowDownToLine,
  Users,
  Cpu,
  Sparkles,
  BarChart3,
  Bell,
  Megaphone,
  Boxes,
  Building2,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import smartRailLogo from "@/assets/smartrail-logo.png";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/live-trains", label: "Live Trains", icon: TrainFront },
  { to: "/dashboard/esp-sensor", label: "Live Sensor (ESP32)", icon: Cpu },
  { to: "/dashboard/incoming", label: "Incoming Trains", icon: ArrowDownToLine },
  { to: "/dashboard/stations", label: "Stations", icon: Building2 },
  { to: "/dashboard/crowd", label: "Station Crowd", icon: Users },
  { to: "/dashboard/predictions", label: "Predictions", icon: Sparkles },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { to: "/dashboard/announcements", label: "Announcements", icon: Megaphone },
  { to: "/dashboard/digital-twin", label: "Digital Twin", icon: Boxes },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, isAdmin, isOperator, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-white/[0.06] bg-[#000000] shadow-2xl lg:flex">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-5">
        <div className="grid size-9 place-items-center rounded-md bg-white p-1">
          <img src={smartRailLogo} alt="SmartRail logo" className="size-full object-contain" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-extrabold uppercase tracking-wider text-white">SmartRail</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Command Center
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-white/[0.06] font-semibold text-accent-cyan"
                  : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-accent-cyan" : "text-slate-400 group-hover:text-slate-200")} />
              <span className="flex-1 truncate">{item.label}</span>
              {active && <span className="size-1.5 rounded-full bg-accent-cyan" />}
            </Link>
          );
        })}
      </nav>

      {/* User Session Profile & System Health Card */}
      <div className="border-t border-white/[0.06] p-3.5 space-y-2">
        {/* User Card */}
        <div className="rounded-xl border border-white/[0.08] bg-[#080a0f] p-3 shadow-inner">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isAdmin ? (
                  <Shield className="size-3 text-purple-400 shrink-0" />
                ) : (
                  <Building2 className="size-3 text-cyan-400 shrink-0" />
                )}
                <span className="truncate text-xs font-bold text-white">
                  {user?.full_name || (isAdmin ? "IT Administrator" : "Station Operator")}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-slate-400">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.2 font-bold uppercase",
                    isAdmin ? "bg-purple-500/20 text-purple-300" : "bg-cyan-500/20 text-cyan-300"
                  )}
                >
                  {isAdmin ? "IT ADMIN" : user?.station_id ? `STATION ${user.station_id}` : "OPERATOR"}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Telemetry Health */}
        <div className="flex items-center justify-between px-2 font-mono text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Telemetry Online
          </span>
          <span className="text-cyan-400 font-bold">100% Sync</span>
        </div>
      </div>
    </aside>
  );
}

