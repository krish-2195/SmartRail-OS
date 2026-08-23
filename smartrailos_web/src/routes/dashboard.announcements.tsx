import { createFileRoute } from "@tanstack/react-router";
import { SectionHeader } from "./dashboard.index";
import { Copy, Pencil, Radio, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAnnouncements, useBroadcastAnnouncement } from "@/lib/api/hooks";
import { formatFullStationName } from "@/lib/use-live-train-state";

export const Route = createFileRoute("/dashboard/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements · SmartRail OS" },
      { name: "description", content: "AI-suggested station announcements ready to broadcast." },
    ],
  }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const announcementsQ = useAnnouncements();
  const broadcastM = useBroadcastAnnouncement();
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);

  const announcements = announcementsQ.data || [];

  const handleBroadcast = async (announcement: any) => {
    if (broadcastingId || broadcastM.isPending) return;
    setBroadcastingId(announcement.id);

    // 1. Resilient Text-to-Speech Simulation
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(announcement.text);
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        utterance.onend = () => setBroadcastingId(null);
        utterance.onerror = () => setBroadcastingId(null);
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("Speech synthesis error:", err);
        setBroadcastingId(null);
      }
    }

    // Safety timeout in case onend never fires (e.g. mobile/headless browsers)
    setTimeout(() => {
      setBroadcastingId((curr) => (curr === announcement.id ? null : curr));
    }, 7000);

    // 2. Call backend broadcast mutation
    broadcastM.mutate(
      { text: announcement.text, context: announcement.context },
      {
        onSuccess: () => {
          setToastMsg("Broadcast played & Push Notification sent to Passenger App!");
          setTimeout(() => setToastMsg(null), 5000);
        },
        onError: (err) => console.error("Broadcast sync failed", err),
      }
    );
  };

  return (
    <div className="space-y-6 px-4 py-6 md:px-8 md:py-8 relative">
      {toastMsg && (
        <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 rounded-lg border border-accent-cyan/30 bg-obsidian-900/95 px-6 py-4 shadow-lg shadow-accent-cyan/10 backdrop-blur">
          <div className="flex items-center gap-3">
            <Radio className="size-5 text-accent-cyan" />
            <p className="text-sm font-medium text-white">{toastMsg}</p>
          </div>
        </div>
      )}

      <SectionHeader title="AI-Suggested Announcements" right="Auto-refreshing" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {announcements.map((a: any) => {
          const isBroadcasting = broadcastingId === a.id;
          const contextLabel = a.context ? formatFullStationName(a.context) : "System-Wide";
          return (
            <div 
              key={a.id} 
              className={`rounded-xl border p-5 transition-all duration-300 ${
                isBroadcasting 
                  ? "border-accent-cyan bg-accent-cyan/10 shadow-[0_0_15px_rgba(34,211,238,0.2)]" 
                  : "border-accent-cyan/15 bg-obsidian-900"
              }`}
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent-cyan">
                <Sparkles className={`size-3 ${isBroadcasting ? "animate-pulse" : ""}`} /> 
                {isBroadcasting ? "LIVE BROADCAST" : "AI Draft"}
                <span className="ml-auto font-mono text-slate-400">{contextLabel}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white">{a.text}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(a.text);
                    setCopiedId(a.id);
                    setTimeout(() => setCopiedId(null), 1500);
                  }}
                  className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10"
                >
                  <Copy className="size-3" /> {copiedId === a.id ? "Copied" : "Copy"}
                </button>
                <button 
                  onClick={() => {
                    const newText = prompt("Edit announcement text:", a.text);
                    if (newText) {
                      handleBroadcast({ ...a, text: newText });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10"
                >
                  <Pencil className="size-3" /> Edit
                </button>
                <button 
                  onClick={() => handleBroadcast(a)}
                  disabled={!!broadcastingId || broadcastM.isPending}
                  className={`ml-auto inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    isBroadcasting
                      ? "border-accent-cyan bg-accent-cyan text-obsidian-950"
                      : "border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan hover:text-obsidian-950"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {(isBroadcasting || broadcastM.isPending) ? <Loader2 className="size-3 animate-spin" /> : <Radio className="size-3" />} 
                  {isBroadcasting ? "Broadcasting..." : "Broadcast"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
