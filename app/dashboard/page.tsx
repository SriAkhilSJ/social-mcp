"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileImage,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { AgentOffice } from "@/components/office/agent-office";
import { AgentPanel } from "@/components/agents/agent-panel";
import { AGENT_ROLES, type AgentRoleId } from "@/lib/agent-roles";
import { PLATFORMS, type PlatformId } from "@/lib/social/platforms";

interface PostSummary {
  id: number;
  title: string;
  caption: string;
  platforms: string[];
  status: string;
  source: string;
  scheduledAt: string | null;
  media: Array<{ url: string; type: string }>;
}

interface TaskSummary {
  id: number;
  agentId: string;
  title: string;
  status: string;
  currentStep: string | null;
  output: string | null;
  updatedAt: string;
}

export default function DashboardOverviewPage() {
  const { campaign, profile, liveStatus, refreshStatus } = useDashboard();
  const [selectedAgent, setSelectedAgent] = useState<AgentRoleId | null>(null);
  const [layoutMode, setLayoutMode] = useState<"split" | "office" | "content">("split");
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [recentTasks, setRecentTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOverviewData = useCallback(async () => {
    try {
      const [postsRes, tasksRes] = await Promise.all([
        fetch("/api/posts", { cache: "no-store" }),
        fetch("/api/agents/tasks", { cache: "no-store" }),
      ]);
      if (postsRes.ok) {
        const pData = await postsRes.json();
        setPosts(pData.posts || []);
      }
      if (tasksRes.ok) {
        const tData = await tasksRes.json();
        setRecentTasks((tData.tasks || []).slice(0, 6));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadOverviewData();
  }, [campaign.id, loadOverviewData]);

  // Refresh overview lists when active plans finish steps
  useEffect(() => {
    if ((liveStatus?.activePlanCount || 0) === 0) return;
    const id = setInterval(() => {
      void loadOverviewData();
    }, 3000);
    return () => clearInterval(id);
  }, [liveStatus?.activePlanCount, loadOverviewData]);

  const scheduledPosts = posts.filter((p) => p.status === "scheduled");
  const publishedPosts = posts.filter((p) => p.status === "published");
  const draftPosts = posts.filter((p) => p.status === "draft");
  const runningAgentsCount = Object.values(liveStatus?.agents || {}).filter(
    (a) => a.status === "running" || a.status === "queued"
  ).length;

  const needsBrief =
    !profile?.description?.trim() && !profile?.audience?.trim();

  return (
    <div className="h-full p-3 sm:p-4 lg:p-5 flex flex-col min-h-0">
      {/* Overview Layout Switcher Bar */}
      <div className="shrink-0 flex items-center justify-between gap-2 mb-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
          <span>Overview Layout:</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setLayoutMode("split")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              layoutMode === "split"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>◫ Split View</span>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode("office")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              layoutMode === "office"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>🏢 Focus Office</span>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode("content")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              layoutMode === "content"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>📊 Focus Content</span>
          </button>
        </div>
      </div>

      <div className="grid flex-1 min-h-[calc(100vh-8.5rem)] gap-4 md:grid-cols-12 overflow-hidden">
        {/* Left Half: Campaign Overview OR Inline Agent Panel */}
        {layoutMode !== "office" && (
          <div
            className={`flex flex-col min-h-0 ${
              layoutMode === "content"
                ? "col-span-12"
                : "col-span-12 md:col-span-6 lg:col-span-5"
            }`}
          >
          {selectedAgent ? (
            <AgentPanel
              agentId={selectedAgent}
              campaignId={campaign.id}
              liveStatus={liveStatus}
              onStatusRefresh={() => {
                refreshStatus();
                void loadOverviewData();
              }}
              onBackToOverview={() => setSelectedAgent(null)}
            />
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
              {/* Brand Brief Nudge */}
              {needsBrief && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50 via-indigo-50/70 to-white p-3.5 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Complete your Campaign Brand Brief
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Give your AI team your audience, tone, and goals so every post sounds authentic.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard/settings?tab=brief"
                    className="shrink-0 rounded-xl bg-white border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 transition"
                  >
                    Set Brief →
                  </Link>
                </div>
              )}

              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Scheduled
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <CalendarClock className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-slate-900">
                    {scheduledPosts.length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Queued via Blotato MCP
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Published
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-slate-900">
                    {publishedPosts.length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Live across channels
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">
                      AI Team Status
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-extrabold text-slate-900">
                    {runningAgentsCount > 0
                      ? `${runningAgentsCount} Working`
                      : "5 Ready"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Click any agent in Office →
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Drafts Ready
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                      <FileImage className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-slate-900">
                    {draftPosts.length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Awaiting review
                  </div>
                </div>
              </div>

              {/* Quick Launch AI Coordinator Banner */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span>🧠</span> Assign a Goal to Your AI Team
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Master Agent coordinates Research, Creator, Scheduler & Analytics automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAgent("master")}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Chat with Master
                  </button>
                </div>

                {/* Quick Agent Pills */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(["research", "creator", "scheduler", "analytics"] as const).map(
                    (id) => {
                      const r = AGENT_ROLES[id];
                      const st = liveStatus?.agents?.[id]?.status || "idle";
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedAgent(id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50/60 transition cursor-pointer"
                        >
                          <span>{r.emoji}</span>
                          <span>{r.shortName}</span>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              st === "running"
                                ? "bg-emerald-500 animate-ping"
                                : "bg-slate-300"
                            }`}
                          />
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Upcoming Scheduled Posts */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-extrabold text-slate-900">
                    Upcoming Scheduled Posts
                  </h3>
                  <Link
                    href="/dashboard/calendar"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    Open Calendar <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {loading ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Loading scheduled posts...
                  </div>
                ) : scheduledPosts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center">
                    <p className="text-xs font-semibold text-slate-700">
                      No upcoming posts scheduled yet
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Click an agent in the Office or create a post manually to fill your queue.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {scheduledPosts.slice(0, 4).map((post) => (
                      <Link
                        key={post.id}
                        href="/dashboard/posts"
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 hover:border-blue-200 hover:bg-blue-50/30 transition"
                      >
                        {post.media?.[0]?.url ? (
                          <img
                            src={post.media[0].url}
                            alt={post.title}
                            className="h-11 w-11 shrink-0 rounded-lg object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <FileImage className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {post.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {post.platforms.map((pl) => {
                              const spec = PLATFORMS[pl as PlatformId];
                              return (
                                <span
                                  key={pl}
                                  className={`rounded-full border px-1.5 py-0.2 text-[9px] font-semibold ${
                                    spec?.badgeClass ||
                                    "bg-slate-100 text-slate-700 border-slate-200"
                                  }`}
                                >
                                  {spec?.name || pl}
                                </span>
                              );
                            })}
                            {post.scheduledAt && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(post.scheduledAt).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Agent Activity */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-extrabold text-slate-900">
                    Recent AI Team Activity
                  </h3>
                  <Link
                    href="/dashboard/agents"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    Full Team Log <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {recentTasks.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">
                    Your agents are standing by at their desks. Click any character in the Office!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recentTasks.map((t) => {
                      const role = AGENT_ROLES[t.agentId as AgentRoleId];
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            setSelectedAgent(
                              (role?.id || "master") as AgentRoleId
                            )
                          }
                          className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left hover:bg-slate-50 transition cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 truncate">
                              {role?.emoji || "🤖"} {role?.shortName || t.agentId}:{" "}
                              {t.title}
                            </div>
                            {t.currentStep && (
                              <div className="text-[10px] text-blue-600 truncate">
                                {t.currentStep}
                              </div>
                            )}
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              t.status === "completed"
                                ? "bg-emerald-50 text-emerald-700"
                                : t.status === "in_progress"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {t.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Right Half: Full-Height Responsive Animated Isometric AI Agent Office */}
      {layoutMode !== "content" && (
        <div
          className={`min-h-[380px] overflow-hidden ${
            layoutMode === "office"
              ? "col-span-12"
              : "col-span-12 md:col-span-6 lg:col-span-7"
          }`}
        >
          <AgentOffice
            officeKey={campaign.officeImage}
            selectedAgentId={selectedAgent}
            onSelectAgent={(id) => setSelectedAgent(id)}
            liveStatus={liveStatus}
          />
        </div>
      )}
    </div>
  </div>
  );
}
