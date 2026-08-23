import { useState, useRef, useEffect } from "react";
import { Bell, Search, AlertOctagon, LogOut, Shield, Building2, ChevronDown, Check } from "lucide-react";
import { useClock, formatTime, formatDate } from "@/lib/use-live-tick";
import { CURRENT_STATION, findStation } from "@/lib/mock/data";
import { useEmergencyStatus } from "@/lib/use-emergency-status";
import { useStations } from "@/lib/api/hooks";
import { useRouterState, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export function DashboardTopNav() {
  const now = useClock();
  const emergencyActive = useEmergencyStatus();
  const routerState = useRouterState();
  const navigate = useNavigate();
  const stationsQ = useStations();
  const { user, isAdmin, isOperator, stationId: operatorStationId, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [stationSelectOpen, setStationSelectOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const stationSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (stationSelectRef.current && !stationSelectRef.current.contains(e.target as Node)) {
        setStationSelectOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine current active station
  const pathname = routerState.location.pathname;
  const match = pathname.match(/\/dashboard\/stations\/([^/]+)/);
  const routeStationId = match ? decodeURIComponent(match[1]) : null;

  const effectiveStationId = isOperator ? (operatorStationId || routeStationId) : routeStationId;

  const currentStationObj = effectiveStationId
    ? stationsQ.data?.find((s) => s.id.toLowerCase() === effectiveStationId.toLowerCase()) || findStation(effectiveStationId)
    : null;

  const displayStationName = currentStationObj ? currentStationObj.name.toUpperCase() : CURRENT_STATION;

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : isAdmin
    ? "AD"
    : "OP";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-white/[0.06] bg-[#000000] px-4 backdrop-blur-xl shadow-md md:px-8">
      {/* Left Group: Station Title & Role Scope Indicator */}
      <div className="flex min-w-0 items-center gap-4 md:gap-6">
        <div className="min-w-0 shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xs font-black uppercase tracking-wider text-white sm:text-sm md:text-base">
              {isAdmin ? "Network Command Center" : displayStationName}
            </h1>
            {isOperator ? (
              <span className="hidden items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-400 sm:inline-flex">
                <Building2 className="size-2.5" />
                <span>Station Operator: {currentStationObj?.name || operatorStationId || "Assigned"}</span>
              </span>
            ) : isAdmin ? (
              <span className="hidden items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-purple-300 sm:inline-flex">
                <Shield className="size-2.5" />
                <span>IT Admin · Global View</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Global Search Bar on the Left */}
        <button
          onClick={() => (window as unknown as { __openPalette?: () => void }).__openPalette?.()}
          className="hidden h-9 items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 text-xs text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white sm:flex"
        >
          <Search className="size-3.5 shrink-0 text-slate-400" />
          <span className="hidden md:inline">Search trains, stations, schedules…</span>
          <kbd className="ml-2 hidden rounded border border-white/10 bg-obsidian-950 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 lg:block">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Group: Clock, Notifications, Emergency Button & User Profile Menu */}
      <div className="flex shrink-0 items-center gap-3">
        {/* Live Clock Badge */}
        <div className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-bold tabular-nums text-slate-300 xl:block">
          {formatTime(now)} IST · {formatDate(now)}
        </div>

        {/* Bell Button */}
        <Link
          to="/dashboard/alerts"
          aria-label="Notifications"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <Bell className="size-4" />
        </Link>

        {/* Red Emergency Action Button */}
        <button
          aria-live="assertive"
          aria-label={emergencyActive ? "Emergency active" : "Emergency"}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold uppercase tracking-widest transition-all shadow-sm",
            emergencyActive
              ? "animate-emergency-blink border-rose-500 text-white"
              : "border-rose-500/30 bg-rose-500/15 text-rose-400 hover:bg-rose-600 hover:text-white"
          )}
        >
          <AlertOctagon className="size-4 shrink-0" />
          <span className="hidden sm:inline">{emergencyActive ? "Emergency!" : "Emergency"}</span>
        </button>

        {/* Profile Avatar & Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full text-xs font-black text-white transition-all ring-2",
              isAdmin
                ? "bg-gradient-to-tr from-purple-700 to-indigo-500 ring-purple-400/40"
                : isOperator
                ? "bg-gradient-to-tr from-cyan-700 to-blue-500 ring-cyan-400/40"
                : "bg-slate-800 ring-white/10"
            )}
          >
            {initials}
          </button>

          {/* User Menu Modal */}
          {menuOpen && (
            <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-white/10 bg-[#080c14] p-3 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 animate-fade-in">
              <div className="border-b border-white/[0.08] pb-3">
                <div className="text-xs font-bold text-white truncate">
                  {user?.full_name || (isAdmin ? "IT Administrator" : "Station Operator")}
                </div>
                <div className="font-mono text-[10px] text-slate-400 truncate">
                  {user?.email || (isAdmin ? "admin@smartrail.os" : "operator@smartrail.os")}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 font-mono text-[9px] font-bold uppercase",
                      isAdmin
                        ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40"
                        : "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                    )}
                  >
                    {user?.role || (isAdmin ? "ADMIN" : "OPERATOR")}
                  </span>
                  {user?.station_id && (
                    <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                      Station: {user.station_id}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 space-y-1">
                <Link
                  to="/dashboard/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  <span>System Settings</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <span className="flex items-center gap-2">
                    <LogOut className="size-3.5" />
                    Sign Out
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

