"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-context";

interface AnalyticsData {
  kpis: {
    totalPublished: number;
    totalScheduled: number;
    totalPosts: number;
    totalViews: number | null;
    successRate: number | null;
    minutesSaved: number;
  };
  dailySeries: Array<{
    date: string;
    scheduled: number;
    published: number;
    views: number;
    engagement: number;
  }>;
  platformBreakdown: Array<{ platform: string; count: number }>;
  sync: {
    status: string;
    lastSyncedAt: string | null;
    error: string | null;
  } | null;
}

const PIE_COLORS = ["#2563EB", "#EC4899", "#8B5CF6", "#10B981", "#F59E0B"];

export default function AnalyticsPage() {
  const { campaign, campaigns } = useDashboard();
  const [days, setDays] = useState<number>(30);
  const [campaignFilter, setCampaignFilter] = useState<string>("current");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const targetCamp =
        campaignFilter === "all" ? "all" : String(campaign.id);
      const res = await fetch(
        `/api/analytics?days=${days}&campaignId=${targetCamp}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [days, campaignFilter, campaign.id]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  async function handleSyncMcp() {
    setSyncing(true);
    try {
      const res = await fetch("/api/analytics", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error("Sync failed");
      if (json.warning) {
        toast.info(json.warning);
      } else {
        toast.success(`Synced ${json.synced || 0} published post metrics!`);
      }
      await loadAnalytics();
    } catch {
      toast.error("Could not sync analytics right now");
    } finally {
      setSyncing(false);
    }
  }

  const kpis = data?.kpis;
  const hoursSaved = kpis
    ? kpis.minutesSaved >= 60
      ? `${(kpis.minutesSaved / 60).toFixed(1)} hrs`
      : `${kpis.minutesSaved} mins`
    : "0 mins";

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Filter & Blotato Sync Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  days === d
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Last {d}d
              </button>
            ))}
          </div>

          {campaigns.length > 1 && (
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs"
            >
              <option value="current">Campaign: {campaign.name}</option>
              <option value="all">All Campaigns</option>
            </select>
          )}
        </div>

        <button
          type="button"
          disabled={syncing}
          onClick={handleSyncMcp}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing Blotato MCP..." : "Sync via Blotato MCP"}
        </button>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Total Posts Published
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Send className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">
            {kpis?.totalPublished ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            +{kpis?.totalScheduled ?? 0} scheduled in queue
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Views</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Eye className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">
            {kpis?.totalViews !== null && kpis?.totalViews !== undefined
              ? kpis.totalViews.toLocaleString()
              : "—"}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {kpis?.totalViews !== null
              ? "Synced from Blotato MCP"
              : "Connect Blotato & publish to track views"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Publishing Success Rate
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">
            {kpis?.successRate !== null && kpis?.successRate !== undefined
              ? `${kpis.successRate}%`
              : "—"}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {kpis?.successRate !== null
              ? "Verified delivery rate"
              : "No delivery attempts yet"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Estimated Time Saved
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">
            {hoursSaved}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            25m/agent task + 15m/AI post
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-xs text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
          Loading campaign analytics...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Chart 1: Daily Posting Activity */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="mb-4">
              <h3 className="text-sm font-extrabold text-slate-900">
                Daily Posting Activity
              </h3>
              <p className="text-xs text-slate-500">
                Scheduled vs. published posts over recent days
              </p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.dailySeries || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="scheduled"
                    name="Scheduled"
                    fill="#93C5FD"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="published"
                    name="Published"
                    fill="#2563EB"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Platform Performance Donut */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Platform Distribution
              </h3>
              <p className="text-xs text-slate-500">
                Share of campaign posts by social network
              </p>
            </div>

            {data?.platformBreakdown && data.platformBreakdown.length > 0 ? (
              <div className="h-64 w-full flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.platformBreakdown}
                      dataKey="count"
                      nameKey="platform"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {data.platformBreakdown.map((entry, idx) => (
                        <Cell
                          key={entry.platform}
                          fill={PIE_COLORS[idx % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="my-auto py-12 text-center text-xs text-slate-400">
                No platform data yet — schedule or draft a post to populate distribution.
              </div>
            )}
          </div>

          {/* Chart 3: Views & Engagement Trend */}
          <div className="lg:col-span-12 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Views & Engagement Trend
                </h3>
                <p className="text-xs text-slate-500">
                  Real audience impressions and likes/comments/shares synced via Blotato MCP
                </p>
              </div>
              {kpis?.totalViews === null && (
                <Link
                  href="/dashboard/accounts"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Connect Accounts for Live Reach
                </Link>
              )}
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.dailySeries || []}>
                  <defs>
                    <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="views"
                    name="Views"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fill="url(#viewsFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="engagement"
                    name="Engagement"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    fillOpacity={0.1}
                    fill="#8B5CF6"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
