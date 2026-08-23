import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SectionHeader } from "./dashboard.index";
import { useAuth } from "@/lib/auth-context";
import { formatFullStationName } from "@/lib/use-live-train-state";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({
    meta: [
      { title: "Settings · SmartRail OS" },
      { name: "description", content: "Operator account, alerting and integration settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, isOperator, isAdmin, stationId } = useAuth();

  // Stateful interactive notification toggles backed by localStorage
  const [emailDigest, setEmailDigest] = useState(() => {
    return typeof window !== "undefined" ? localStorage.getItem("srail_set_email") !== "false" : true;
  });
  const [pushMobile, setPushMobile] = useState(() => {
    return typeof window !== "undefined" ? localStorage.getItem("srail_set_push") !== "false" : true;
  });
  const [voiceEscalation, setVoiceEscalation] = useState(() => {
    return typeof window !== "undefined" ? localStorage.getItem("srail_set_voice") === "true" : false;
  });

  const handleToggle = (key: string, current: boolean, setter: (val: boolean) => void) => {
    const next = !current;
    setter(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(key, String(next));
    }
  };

  const assignedStationName = stationId ? formatFullStationName(stationId, "BL") : "Old High Court Interchange";
  const roleLabel = isAdmin ? "Administrator" : isOperator ? "Station Operator" : "Rail Dispatcher";
  const displayName = user?.full_name || (user?.user_id_code ? `@${user.user_id_code}` : "Operator 402");

  return (
    <div className="space-y-6 px-4 py-6 md:px-8 md:py-8">
      <SectionHeader title="Settings" right="Operator workspace" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Account">
          <Field label="Operator Name" value={displayName} />
          <Field label="Role" value={roleLabel} />
          <Field label="Assigned Station" value={assignedStationName} />
          <Field label="Status" value="Active · Authenticated" />
        </Card>
        <Card title="Alert Thresholds">
          <Field label="Coach occupancy warning" value="≥ 75%" />
          <Field label="Coach occupancy critical" value="≥ 90%" />
          <Field label="Platform density alert" value="≥ 80%" />
          <Field label="Dwell overtime trigger" value="> 45s" />
        </Card>
        <Card title="Integrations">
          <Field label="Signalling system" value="Connected · TMS v4.2" />
          <Field label="CCTV mesh" value="48 nodes online" />
          <Field label="PA system" value="Active · Low Latency" />
          <Field label="ESP32 IoT Ingestion" value="Synced (Port 8000)" />
        </Card>
        <Card title="Notifications & Escalation">
          <Toggle
            label="Email digest"
            on={emailDigest}
            onToggle={() => handleToggle("srail_set_email", emailDigest, setEmailDigest)}
          />
          <Toggle
            label="Push to mobile"
            on={pushMobile}
            onToggle={() => handleToggle("srail_set_push", pushMobile, setPushMobile)}
          />
          <Toggle
            label="Voice escalation"
            on={voiceEscalation}
            onToggle={() => handleToggle("srail_set_voice", voiceEscalation, setVoiceEscalation)}
          />
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-obsidian-900 p-5">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-white">{value}</span>
    </div>
  );
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs last:border-0">
      <span className="text-slate-400">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className={`grid h-5 w-9 cursor-pointer items-center rounded-full p-0.5 transition-colors ${on ? "bg-accent-cyan" : "bg-white/10"}`}
      >
        <span className={`size-4 rounded-full bg-obsidian-950 transition-transform ${on ? "translate-x-4" : ""}`} />
      </button>
    </div>
  );
}
