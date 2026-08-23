import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  Shield,
  Building2,
  Lock,
  User,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  TrainFront,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import smartRailLogo from "@/assets/smartrail-logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In · SmartRail OS Command Center" },
      { name: "description", content: "Sign in to SmartRail OS Operator Console or IT Admin Center." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"operator" | "admin">("operator");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setErrorMessage("Please enter both user ID/email and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await login(identifier, password);
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed. Please check credentials.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (demoId: string, demoPass: string, role: "operator" | "admin") => {
    setActiveTab(role);
    setIdentifier(demoId);
    setPassword(demoPass);
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await login(demoId, demoPass);
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Demo login failed";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#030508] px-4 py-12 text-slate-200">
      {/* Dynamic Background Glow Grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(6,182,212,0.12),transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-10 h-72 w-72 rounded-full bg-blue-600/10 blur-[100px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-white/20">
            <img src={smartRailLogo} alt="SmartRail" className="size-full object-contain" />
          </div>
          <h1 className="mt-4 text-2xl font-black uppercase tracking-widest text-white">
            SmartRail OS
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-slate-400">
            Command Center Access Portal
          </p>
        </div>

        {/* Auth Card */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-[#080c14]/90 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
          {/* Role Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#03060a] p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveTab("operator");
                setErrorMessage(null);
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg py-2.5 transition-all",
                activeTab === "operator"
                  ? "border border-cyan-500/40 bg-cyan-500/15 font-extrabold text-cyan-300 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Building2 className="size-3.5" />
              <span>Station Operator</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("admin");
                setErrorMessage(null);
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg py-2.5 transition-all",
                activeTab === "admin"
                  ? "border border-purple-500/40 bg-purple-500/15 font-extrabold text-purple-300 shadow-md shadow-purple-500/10 ring-1 ring-purple-500/30"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Shield className="size-3.5" />
              <span>IT Administrator</span>
            </button>
          </div>

          {/* Role Explanation Subtitle */}
          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-slate-400">
            {activeTab === "operator" ? (
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>
                  <strong>Station Operator Mode:</strong> Telemetry, incoming trains &amp; crowd metrics are strictly scoped to your assigned station.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-purple-400 animate-pulse" />
                <span>
                  <strong>IT Admin Mode:</strong> Global access across all 33 stations, 24 rakes &amp; full system diagnostics.
                </span>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="size-4 shrink-0 text-rose-400" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {activeTab === "operator" ? "Operator ID or Official Email" : "Admin ID or Email"}
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <User className="size-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={activeTab === "operator" ? "OP_BL11 or operator.bl11@smartrail.os" : "ADMIN01 or admin@smartrail.os"}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#05080e] py-2.5 pl-9 pr-3 text-xs font-semibold text-white placeholder-slate-600 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

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
                  className="w-full rounded-xl border border-white/10 bg-[#05080e] py-2.5 pl-9 pr-3 text-xs font-semibold text-white placeholder-slate-600 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "group relative flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold uppercase tracking-wider text-white transition-all shadow-lg",
                activeTab === "operator"
                  ? "border border-cyan-500/50 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-500/20"
                  : "border border-purple-500/50 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-500/20",
                isLoading && "opacity-70 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <span>Authenticating…</span>
              ) : (
                <>
                  <span>{activeTab === "operator" ? "Sign In as Operator" : "Sign In as IT Admin"}</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-6 border-t border-white/[0.08] pt-5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-3 text-amber-400" />
                Quick 1-Click Demo Accounts
              </span>
              <span className="text-[9px] text-slate-500">Instant test</span>
            </div>

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => handleQuickDemo("ADMIN01", "admin123", "admin")}
                className="flex w-full items-center justify-between rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5 text-left text-xs transition-colors hover:border-purple-500/60 hover:bg-purple-500/20"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-purple-300">
                    <Shield className="size-3" />
                    <span>IT Administrator (Full Network Access)</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                    ID: ADMIN01 · Pass: admin123
                  </div>
                </div>
                <span className="rounded bg-purple-500/20 px-2 py-0.5 font-mono text-[9px] font-bold text-purple-300">
                  1-CLICK LOGIN
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("OP_BL11", "operator123", "operator")}
                className="flex w-full items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-left text-xs transition-colors hover:border-cyan-500/60 hover:bg-cyan-500/20"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                    <Building2 className="size-3" />
                    <span>Station Operator (Old High Court · BL11)</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                    ID: OP_BL11 · Pass: operator123
                  </div>
                </div>
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-300">
                  1-CLICK LOGIN
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("OP_BL01", "operator123", "operator")}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-left text-xs transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Building2 className="size-3 text-cyan-400" />
                    <span>Station Operator (Vastral Gam · BL01)</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                    ID: OP_BL01 · Pass: operator123
                  </div>
                </div>
                <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                  1-CLICK LOGIN
                </span>
              </button>
            </div>
          </div>

          {/* Registration Link */}
          <div className="mt-6 text-center text-xs text-slate-500">
            <span>New station staff? </span>
            <Link
              to="/register"
              className="font-bold text-cyan-400 transition-colors hover:text-cyan-300 hover:underline"
            >
              Register Station Operator Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
