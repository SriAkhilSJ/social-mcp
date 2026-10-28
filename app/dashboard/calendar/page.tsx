"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Globe,
  GripVertical,
  Plus,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { PlatformPreview } from "@/components/posts/platform-preview";
import { PLATFORMS, type PlatformId } from "@/lib/social/platforms";

interface CalendarPost {
  id: number;
  title: string;
  caption: string;
  hashtags: string[];
  platforms: string[];
  media: Array<{ url: string; type: string }>;
  status: string;
  source: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  timeZone: string;
}

function toDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CalendarPage() {
  const { campaign, profile } = useDashboard();
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [dragPostId, setDragPostId] = useState<number | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);

  const loadPosts = useCallback(async () => {
    const res = await fetch("/api/posts", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts || []);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [campaign.id, loadPosts]);

  // Compute grid days for Month or Week view
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    if (viewMode === "week") {
      const start = new Date(cursorDate);
      start.setDate(start.getDate() - start.getDay());
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push(d);
      }
      return days;
    }

    const firstOfMonth = new Date(
      cursorDate.getFullYear(),
      cursorDate.getMonth(),
      1
    );
    const startOffset = firstOfMonth.getDay();
    const start = new Date(firstOfMonth);
    start.setDate(firstOfMonth.getDate() - startOffset);

    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursorDate, viewMode]);

  function navigatePeriod(delta: number) {
    setCursorDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "month") {
        next.setMonth(prev.getMonth() + delta);
      } else {
        next.setDate(prev.getDate() + delta * 7);
      }
      return next;
    });
  }

  async function handleDropOnDate(targetDay: Date) {
    setDragOverKey(null);
    if (!dragPostId) return;
    const post = posts.find((p) => p.id === dragPostId);
    setDragPostId(null);
    if (!post) return;

    const existing = post.scheduledAt ? new Date(post.scheduledAt) : new Date();
    const updatedDate = new Date(
      targetDay.getFullYear(),
      targetDay.getMonth(),
      targetDay.getDate(),
      existing.getHours() || 8,
      existing.getMinutes() || 0,
      0
    );

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, scheduledAt: updatedDate.toISOString(), status: "scheduled" }
          : p
      )
    );

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          id: post.id,
          scheduledAt: updatedDate.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Reschedule failed");
      toast.success(
        `Rescheduled "${post.title}" to ${updatedDate.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })} (synced with Blotato)`
      );
      await loadPosts();
    } catch {
      toast.error("Could not reschedule post");
      await loadPosts();
    }
  }

  async function handlePublishNow(postId: number) {
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish-now", id: postId }),
      });
      if (!res.ok) throw new Error("Publish failed");
      toast.success("Published post via Blotato MCP!");
      setSelectedPost(null);
      await loadPosts();
    } catch {
      toast.error("Publish failed");
    }
  }

  const todayKey = toDateKey(new Date());
  const activeTz =
    profile?.timeZone ||
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC");

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Calendar Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => navigatePeriod(-1)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCursorDate(new Date())}
              className="px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => navigatePeriod(1)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-base font-extrabold text-slate-900">
            {cursorDate.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h2>

          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            <Globe className="h-3 w-3 text-blue-600" />
            {activeTz}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden md:inline text-[11px] text-slate-400">
            Drag & drop posts between days to reschedule
          </span>
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                viewMode === "month"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                viewMode === "week"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xs">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="px-3 py-2.5 text-center text-[11px] font-extrabold uppercase tracking-wider text-slate-500"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {calendarDays.map((day) => {
            const key = toDateKey(day);
            const isToday = key === todayKey;
            const isCurrentMonth = day.getMonth() === cursorDate.getMonth();
            const dayPosts = posts.filter((p) => {
              const target = p.scheduledAt || p.publishedAt;
              if (!target) return false;
              return toDateKey(new Date(target)) === key;
            });

            return (
              <div
                key={key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverKey(key);
                }}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={() => handleDropOnDate(day)}
                className={`group relative transition ${
                  viewMode === "week" ? "min-h-[380px]" : "min-h-[132px]"
                } p-2 ${
                  dragOverKey === key
                    ? "bg-blue-50/80 ring-2 ring-inset ring-blue-500"
                    : !isCurrentMonth && viewMode === "month"
                    ? "bg-slate-50/50"
                    : "bg-white"
                }`}
              >
                {/* Day Number + Hover Quick Add */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isToday
                        ? "bg-blue-600 text-white"
                        : isCurrentMonth
                        ? "text-slate-800"
                        : "text-slate-400"
                    }`}
                  >
                    {day.getDate()}
                  </span>

                  <Link
                    href={`/dashboard/posts/new?date=${key}`}
                    title={`Schedule post on ${key}`}
                    className="opacity-0 group-hover:opacity-100 rounded-lg bg-slate-100 p-1 text-slate-600 hover:bg-blue-600 hover:text-white transition"
                  >
                    <Plus className="h-3 w-3" />
                  </Link>
                </div>

                {/* Scheduled Post Pills */}
                <div className="space-y-1.5">
                  {dayPosts.map((p) => {
                    const firstPlat = p.platforms[0] as PlatformId;
                    const spec = PLATFORMS[firstPlat];
                    const timeStr = p.scheduledAt
                      ? new Date(p.scheduledAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <div
                        key={p.id}
                        draggable={p.status !== "published"}
                        onDragStart={() => setDragPostId(p.id)}
                        onClick={() => setSelectedPost(p)}
                        className={`flex items-center gap-1.5 rounded-xl border p-1.5 text-left text-[11px] shadow-2xs transition cursor-pointer hover:border-blue-400 ${
                          p.status === "published"
                            ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-800"
                        }`}
                      >
                        <GripVertical className="h-3 w-3 shrink-0 text-slate-300" />
                        {p.media?.[0]?.url && (
                          <img
                            src={p.media[0].url}
                            alt=""
                            className="h-6 w-6 shrink-0 rounded-md object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold truncate leading-tight">
                            {p.title}
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-slate-500">
                            <span>{spec?.name || firstPlat}</span>
                            {timeStr && <span>• {timeStr}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right-Side Post Preview Drawer */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-l border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {selectedPost.title}
                  </h3>
                  {selectedPost.scheduledAt && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(selectedPost.scheduledAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <PlatformPreview
                platforms={selectedPost.platforms}
                brandName={profile?.brandName || campaign.name}
                title={selectedPost.title}
                caption={selectedPost.caption}
                hashtags={selectedPost.hashtags || []}
                mediaUrls={(selectedPost.media || []).map((m) => m.url)}
              />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-4 bg-slate-50/70">
              <Link
                href={`/dashboard/posts/new?edit=${selectedPost.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit in Composer
              </Link>

              {selectedPost.status !== "published" && (
                <button
                  type="button"
                  onClick={() => handlePublishNow(selectedPost.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  Publish Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
