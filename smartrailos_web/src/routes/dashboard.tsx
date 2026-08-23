import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { DashboardSidebar } from "@/components/srail/dashboard-sidebar";
import { DashboardTopNav } from "@/components/srail/dashboard-topnav";
import { CommandPalette } from "@/components/srail/command-palette";
import { useAuth } from "@/lib/auth-context";
import { USE_MOCK } from "@/lib/api/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "SmartRail OS · Command Center" },
      { name: "description", content: "Real-time station operations dashboard for SmartRail OS." },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, token, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !token && !user && !USE_MOCK) {
      navigate({ to: "/login" });
    }
  }, [isLoading, token, user, navigate]);

  return (
    <div className="flex min-h-screen w-full bg-[#000000] pl-0 text-slate-300 lg:pl-64">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopNav />
        <main className="flex-1 overflow-x-hidden bg-[#000000]">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

