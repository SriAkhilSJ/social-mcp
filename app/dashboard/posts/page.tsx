"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  Edit3,
  FileImage,
  Loader2,
  PenSquare,
  Send,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { PLATFORMS, type PlatformId } from "@/lib/social/platforms";

interface PostItem {
  id: number;
  title: string;
  caption: string;
  hashtags: string[];
  platforms: string[];
  media: Array<{ url: string; type: string }>;
  source: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  publishError: string | null;
}

const FILTERS = [
  { id: "all", label: "All Posts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "draft", label: "Drafts" },
  { id: "published", label: "Published" },
];

export default function PostsPage() {
  const { campaign } = useDashboard();
  const [filter, setFilter] = useState("all");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts?status=${filter}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadPosts();
  }, [campaign.id, loadPosts]);

  async function runPostAction(
    id: number,
    action: "publish-now" | "unschedule" | "duplicate" | "delete"
  ) {
    setBusyId(id);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      if (!res.ok) throw new Error("Action failed");
      toast.success(
        action === "publish-now"
          ? "Published post via Blotato MCP!"
          : action === "unschedule"
          ? "Moved post back to Drafts"
          : action === "duplicate"
          ? "Duplicated post"
          : "Deleted post"
      );
      await loadPosts();
    } catch {
      toast.error("Could not update post");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                filter === f.id
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/agents?agent=master"
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Generate with AI Team
          </Link>
          <Link
            href="/dashboard/posts/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            <PenSquare className="h-3.5 w-3.5" />
            Manual Composer
          </Link>
        </div>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-xs text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
          Loading campaign posts...
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <FileImage className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">
            No posts in this view yet
          </h3>
          <p className="mx-auto max-w-md text-xs text-slate-500">
            Create posts manually with ImageKit AI edits or ask your Master Agent to research, design, and schedule posts automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((post) => {
            const thumb = post.media?.[0]?.url;
            const isVideoMedia =
              post.media?.[0]?.type === "video" ||
              Boolean(thumb && /\.(mp4|webm|mov)(\?|$)/i.test(thumb));
            const isMp4 = Boolean(thumb && /\.(mp4|webm|mov)(\?|$)/i.test(thumb));
            const isBusy = busyId === post.id;

            return (
              <div
                key={post.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-md transition"
              >
                {/* Thumbnail */}
                <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                  {thumb ? (
                    isMp4 ? (
                      <video
                        src={thumb}
                        muted
                        loop
                        autoPlay
                        controls
                        playsInline
                        className="h-full w-full object-cover group-hover:scale-[1.02] transition"
                      />
                    ) : (
                      <img
                        src={thumb}
                        alt={post.title}
                        className="h-full w-full object-cover group-hover:scale-[1.02] transition"
                      />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <FileImage className="h-10 w-10" />
                    </div>
                  )}

                  {isVideoMedia && (
                    <span className="absolute bottom-2.5 left-2.5 rounded-full bg-violet-600/95 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      🎬 Flow Video
                    </span>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-xs ${
                        post.status === "published"
                          ? "bg-emerald-600 text-white"
                          : post.status === "scheduled"
                          ? "bg-blue-600 text-white"
                          : post.status === "failed"
                          ? "bg-red-600 text-white"
                          : "bg-white/95 text-slate-700"
                      }`}
                    >
                      {post.status.toUpperCase()}
                    </span>

                    <span className="rounded-full bg-slate-900/80 backdrop-blur px-2 py-0.5 text-[10px] font-semibold text-white">
                      {post.source === "ai" ? "🤖 AI Team" : "✍️ Manual"}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {post.platforms.map((pl) => {
                        const spec = PLATFORMS[pl as PlatformId];
                        return (
                          <span
                            key={pl}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              spec?.badgeClass ||
                              "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {spec?.name || pl}
                          </span>
                        );
                      })}
                    </div>

                    <h3 className="text-xs font-extrabold text-slate-900 line-clamp-1">
                      {post.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {post.caption}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    {post.scheduledAt && post.status === "scheduled" && (
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {new Date(post.scheduledAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    )}

                    {post.status === "published" && (
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Published via Blotato MCP
                      </div>
                    )}

                    {/* Action Row */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/posts/new?edit=${post.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </Link>

                        {post.status !== "published" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => runPostAction(post.id, "publish-now")}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                          >
                            <Send className="h-3 w-3" />
                            Publish
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5">
                        {post.status === "scheduled" && (
                          <button
                            type="button"
                            title="Unschedule to draft"
                            disabled={isBusy}
                            onClick={() => runPostAction(post.id, "unschedule")}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Duplicate post"
                          disabled={isBusy}
                          onClick={() => runPostAction(post.id, "duplicate")}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete post"
                          disabled={isBusy}
                          onClick={() => runPostAction(post.id, "delete")}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
