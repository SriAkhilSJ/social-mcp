"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  FileImage,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Plus,
  PowerOff,
  Settings,
  Share2,
  Sparkles,
  Sun,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CampaignAvatar } from "@/components/campaign-icon";
import { useLiveStatus } from "@/components/agents/use-live-status";
import {
  DashboardContext,
  type DashboardCampaign,
  type DashboardProfile,
  type DashboardUser,
} from "@/components/dashboard/dashboard-context";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    badgeBg: "bg-blue-50 text-blue-600",
    activeBadgeBg: "bg-blue-600 text-white",
  },
  {
    href: "/dashboard/agents",
    label: "AI Agent",
    icon: Bot,
    badgeBg: "bg-violet-50 text-violet-600",
    activeBadgeBg: "bg-violet-600 text-white",
  },
  {
    href: "/dashboard/posts",
    label: "Posts",
    icon: FileImage,
    badgeBg: "bg-pink-50 text-pink-600",
    activeBadgeBg: "bg-pink-600 text-white",
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: CalendarDays,
    badgeBg: "bg-amber-50 text-amber-600",
    activeBadgeBg: "bg-amber-500 text-white",
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
    badgeBg: "bg-emerald-50 text-emerald-600",
    activeBadgeBg: "bg-emerald-600 text-white",
  },
  {
    href: "/dashboard/accounts",
    label: "Accounts",
    icon: Share2,
    badgeBg: "bg-cyan-50 text-cyan-600",
    activeBadgeBg: "bg-cyan-600 text-white",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    badgeBg: "bg-slate-100 text-slate-600",
    activeBadgeBg: "bg-slate-800 text-white",
  },
];

export function DashboardShell({
  initialUser,
  initialCampaign,
  initialCampaigns,
  initialProfile,
  children,
}: {
  initialUser: DashboardUser;
  initialCampaign: DashboardCampaign;
  initialCampaigns: DashboardCampaign[];
  initialProfile: DashboardProfile | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [campaign, setCampaign] = useState<DashboardCampaign>(initialCampaign);
  const [campaigns, setCampaigns] =
    useState<DashboardCampaign[]>(initialCampaigns);
  const [profile, setProfile] = useState<DashboardProfile | null>(initialProfile);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [endingCampaign, setEndingCampaign] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("socialix-theme") as "light" | "dark" | null;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const active = saved || (prefersDark ? "dark" : "light");
    setTheme(active);
    if (active === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("socialix-theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
      toast.success("Switched to Dark Theme");
    } else {
      document.documentElement.classList.remove("dark");
      toast.success("Switched to Light Theme");
    }
  }

  const switcherRef = useRef<HTMLDivElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);

  const { status: liveStatus, refresh: refreshStatus } = useLiveStatus(
    campaign.id
  );

  // Close popovers on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(e.target as Node)
      ) {
        setSwitcherOpen(false);
      }
      if (
        createMenuRef.current &&
        !createMenuRef.current.contains(e.target as Node)
      ) {
        setCreateMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const refreshCampaignData = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.activeCampaign) {
        setCampaign(data.activeCampaign);
      }
      if (Array.isArray(data.campaigns)) {
        setCampaigns(data.campaigns);
      }
      setProfile(data.profile || null);
    } catch {
      // Ignore transient fetch errors
    }
  }, []);

  async function handleSwitchCampaign(targetId: number) {
    setSwitcherOpen(false);
    if (targetId === campaign.id) return;
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch", campaignId: targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not switch campaign");
      setCampaign(data.campaign);
      await refreshCampaignData();
      refreshStatus();
      router.refresh();
      toast.success(`Switched to ${data.campaign.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Switch failed");
    }
  }

  async function handleEndCampaign() {
    setEndingCampaign(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", campaignId: campaign.id }),
      });
      if (!res.ok) throw new Error("Failed to end campaign");
      setEndConfirmOpen(false);
      toast.success(`Ended "${campaign.name}"`);
      const nextRes = await fetch("/api/campaigns", { cache: "no-store" });
      const nextData = await nextRes.json();
      if (nextData.activeCampaign) {
        setCampaign(nextData.activeCampaign);
        setCampaigns(nextData.campaigns || []);
        setProfile(nextData.profile || null);
        router.refresh();
      } else {
        router.push("/create-campaign");
      }
    } catch {
      toast.error("Could not end campaign");
    } finally {
      setEndingCampaign(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign-out" }),
    });
    router.push("/sign-in");
  }

  const workingAgentsCount = Object.values(liveStatus?.agents || {}).filter(
    (a) => a.status === "running" || a.status === "queued"
  ).length;

  const activeNav =
    NAV_ITEMS.find((item) =>
      item.href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(item.href)
    ) || NAV_ITEMS[0];

  function renderSidebarContent(isMobile = false) {
    const isMini = collapsed && !isMobile;

    return (
      <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200/90 select-none">
        <div className="p-3 space-y-4">
          {/* Brand Logo + Collapse Toggle */}
          <div className="flex items-center justify-between px-1.5 pt-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 min-w-0"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/25">
                <Sparkles className="h-4 w-4" />
              </div>
              {!isMini && (
                <div className="min-w-0">
                  <div className="text-sm font-extrabold tracking-tight text-slate-900 leading-none">
                    Socialix
                  </div>
                  <div className="text-[10px] font-semibold text-blue-600 mt-0.5">
                    AI Agent Studio
                  </div>
                </div>
              )}
            </Link>

            {isMobile ? (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {/* Campaign Switcher */}
          <div className="relative" ref={isMobile ? undefined : switcherRef}>
            <button
              type="button"
              onClick={() => setSwitcherOpen((o) => !o)}
              title={campaign.name}
              className={`w-full flex items-center ${
                isMini ? "justify-center p-1.5" : "justify-between px-2.5 py-2"
              } rounded-2xl border border-slate-200/90 bg-slate-50/80 hover:bg-slate-100/80 transition cursor-pointer`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CampaignAvatar
                  icon={campaign.icon}
                  iconUrl={campaign.iconUrl}
                  name={campaign.name}
                  size="sm"
                />
                {!isMini && (
                  <div className="text-left min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {campaign.name}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {campaign.officeImage?.includes("modern")
                        ? "Modern Office"
                        : "Wooden Office"}
                    </div>
                  </div>
                )}
              </div>
              {!isMini && (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
            </button>

            {switcherOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50">
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Active Campaigns
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {campaigns.map((c) => {
                    const selected = c.id === campaign.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSwitchCampaign(c.id)}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition cursor-pointer ${
                          selected
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CampaignAvatar
                            icon={c.icon}
                            iconUrl={c.iconUrl}
                            name={c.name}
                            size="sm"
                          />
                          <span className="truncate">{c.name}</span>
                        </div>
                        {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="my-1.5 border-t border-slate-100" />

                <Link
                  href="/create-campaign"
                  onClick={() => setSwitcherOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create New Campaign
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setSwitcherOpen(false);
                    setEndConfirmOpen(true);
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
                >
                  <PowerOff className="h-3.5 w-3.5" />
                  End Current Campaign
                </button>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={isMini ? item.label : undefined}
                  className={`group flex items-center ${
                    isMini ? "justify-center px-2 py-2.5" : "justify-between px-2.5 py-2"
                  } rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? "bg-blue-50/90 text-blue-700 shadow-2xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                        isActive ? item.activeBadgeBg : item.badgeBg
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {!isMini && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isMini &&
                    item.href === "/dashboard/agents" &&
                    workingAgentsCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        {workingAgentsCount}
                      </span>
                    )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="border-t border-slate-100 p-3">
          <div
            className={`flex items-center ${
              isMini ? "justify-center" : "justify-between gap-2"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white">
                {initialUser.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              {!isMini && (
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {initialUser.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {initialUser.email}
                  </div>
                </div>
              )}
            </div>

            {!isMini && (
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardContext.Provider
      value={{
        user: initialUser,
        campaign,
        campaigns,
        profile,
        liveStatus,
        refreshStatus,
        refreshCampaignData,
      }}
    >
      <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC]">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:block shrink-0 transition-all duration-200 ${
            collapsed ? "w-[74px]" : "w-60"
          }`}
        >
          {renderSidebarContent(false)}
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative z-10 w-64 h-full">
              {renderSidebarContent(true)}
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Top Header */}
          <header className="flex h-15 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 backdrop-blur px-4 lg:px-6 z-20">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 md:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold tracking-tight text-slate-900 truncate">
                    {activeNav.label}
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {campaign.name}
                  </span>
                  {workingAgentsCount > 0 && (
                    <Link
                      href="/dashboard/agents"
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                      {workingAgentsCount} agent{workingAgentsCount > 1 ? "s" : ""}{" "}
                      working
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Right Header Actions: Theme Toggle & Create Post Dropdown */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-600" />
                )}
              </button>

              <div className="relative" ref={createMenuRef}>
                <button
                  type="button"
                  onClick={() => setCreateMenuOpen((o) => !o)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Post</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                </button>

                {createMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50">
                    <Link
                      href="/dashboard/posts/new"
                      onClick={() => setCreateMenuOpen(false)}
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 transition"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                        <PenSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Create Manually
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Composer, ImageKit AI edits & preview
                        </div>
                      </div>
                    </Link>

                    <Link
                      href="/dashboard/agents?agent=master"
                      onClick={() => setCreateMenuOpen(false)}
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-blue-50/60 transition"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Wand2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Create Using AI Agent
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Master Agent researches, designs & schedules
                        </div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
        </div>
      </div>

      {/* End Campaign Confirmation Modal */}
      {endConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <PowerOff className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  End &ldquo;{campaign.name}&rdquo;?
                </h3>
                <p className="text-xs text-slate-500">
                  Active agent plans and sandboxes for this campaign will stop.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Your published posts and analytics remain stored, and you can start a
              new campaign anytime.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEndConfirmOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Keep Campaign
              </button>
              <button
                type="button"
                disabled={endingCampaign}
                onClick={handleEndCampaign}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {endingCampaign ? "Ending..." : "End Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardContext.Provider>
  );
}
