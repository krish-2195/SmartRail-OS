import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useStations } from "@/lib/api/hooks";
import {
  Building2,
  Lock,
  User,
  Mail,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import smartRailLogo from "@/assets/smartrail-logo.png";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Operator Registration · SmartRail OS" },
      { name: "description", content: "Register a new Station Operator account with assigned metro station." },
    ],
  }),
  component: RegisterPage,
});

// Fallback station catalog if stations API is still loading
const DEFAULT_STATIONS = [
  { id: "BL11", name: "Old High Court (Interchange)", line: "blue" },
  { id: "BL01", name: "Vastral Gam", line: "blue" },
  { id: "BL08", name: "Kalupur Railway Station", line: "blue" },
  { id: "BL18", name: "Thaltej Gam", line: "blue" },
  { id: "RL01", name: "APMC", line: "red" },
  { id: "RL07", name: "Old High Court (RL)", line: "red" },
  { id: "RL15", name: "Motera Stadium", line: "red" },
];

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const stationsQ = useStations();

  const [fullName, setFullName] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [email, setEmail] = useState("");
  const [stationId, setStationId] = useState("BL11");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stations = stationsQ.data && stationsQ.data.length > 0 ? stationsQ.data : DEFAULT_STATIONS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage("Please fill all required fields.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await register({
        full_name: fullName.trim(),
        user_id_code: operatorId.trim() || undefined,
        email: email.trim(),
        password,
        role: "operator",
        station_id: stationId,
      });

      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#030508] px-4 py-12 text-slate-200">
      {/* Background Glows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(6,182,212,0.12),transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Branding */}
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-white/20">
            <img src={smartRailLogo} alt="SmartRail" className="size-full object-contain" />
          </div>
          <h1 className="mt-4 text-2xl font-black uppercase tracking-widest text-white">
            Operator Registration
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-slate-400">
            SmartRail OS Station Console Access
          </p>
        </div>

        {/* Card */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-[#080c14]/90 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-relaxed text-cyan-200">
            <div className="flex items-center gap-2 font-bold">
              <Building2 className="size-4 text-cyan-400" />
              <span>Station-Scoped Console Privileges</span>
            </div>
            <p className="mt-1 text-[11px] text-cyan-300/80">
              Upon account creation, your dashboard, train arrivals, platform metrics, and alerts will be customized to your assigned station.
            </p>
          </div>

          {errorMessage && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="size-4 shrink-0 text-rose-400" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Full Name
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <User className="size-4" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    required
                    className="w-full rounded-xl border border-white/10 bg-[#05080e] py-2.5 pl-9 pr-3 text-xs font-semibold text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Operator Badge ID
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <ShieldCheck className="size-4" />
                  </div>
                  <input
                    type="text"
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    placeholder="e.g. OP_BL08"
                    className="w-full rounded-xl border border-white/10 bg-[#05080e] py-2.5 pl-9 pr-3 text-xs font-semibold text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Official Email
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Mail className="size-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator.station@smartrail.os"
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#05080e] py-2.5 pl-9 pr-3 text-xs font-semibold text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Assigned Metro Station
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Building2 className="size-4" />
                </div>
                <select
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#05080e] py-2.5 pl-9 pr-3 text-xs font-bold text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <optgroup label="Blue Line Stations (Line 1)">
                    {stations
                      .filter((s) => s.line === "blue" || !s.line)
                      .map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#080c14] text-white">
                          [{s.id}] {s.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Red Line Stations (Line 2)">
                    {stations
                      .filter((s) => s.line === "red")
                      .map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#080c14] text-white">
                          [{s.id}] {s.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Password
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Lock className="size-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl border border-white/10 bg-[#05080e] py-2.5 pl-9 pr-3 text-xs font-semibold text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Confirm Password
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Lock className="size-4" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl border border-white/10 bg-[#05080e] py-2.5 pl-9 pr-3 text-xs font-semibold text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "group relative flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/50 bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-500 hover:to-blue-500",
                isLoading && "opacity-70 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <span>Creating Account…</span>
              ) : (
                <>
                  <span>Create Station Operator Account</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            <span>Already have an assigned station badge? </span>
            <Link
              to="/login"
              className="font-bold text-cyan-400 transition-colors hover:text-cyan-300 hover:underline"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
