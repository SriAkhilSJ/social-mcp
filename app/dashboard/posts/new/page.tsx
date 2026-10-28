"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Coins,
  Film,
  ImagePlus,
  Loader2,
  Save,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { PlatformPreview } from "@/components/posts/platform-preview";
import { ImageKitEditorModal } from "@/components/posts/imagekit-editor-modal";
import {
  PLATFORMS,
  PRIMARY_PLATFORM_IDS,
  type PlatformId,
} from "@/lib/social/platforms";

interface ComposerMedia {
  url: string;
  type: "image" | "video";
}

function defaultScheduleValue(prefillDate?: string | null): string {
  const d = prefillDate
    ? new Date(`${prefillDate}T08:00:00`)
    : new Date(Date.now() + 2 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function PostComposerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const prefillDate = searchParams.get("date");

  const { campaign, profile } = useDashboard();

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(
    profile?.platforms?.length
      ? profile.platforms.slice(0, 3)
      : ["instagram", "facebook"]
  );
  const [mediaItems, setMediaItems] = useState<ComposerMedia[]>([]);
  const [scheduledLocal, setScheduledLocal] = useState(() =>
    defaultScheduleValue(prefillDate)
  );
  const [timeZone, setTimeZone] = useState(
    profile?.timeZone ||
      (typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC")
  );

  // Studio Tab: "image" vs "video" (Google Flow MCP)
  const [studioMode, setStudioMode] = useState<"image" | "video">("video");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAspect, setAiAspect] = useState<"1:1" | "4:5" | "9:16" | "16:9">("1:1");

  const [videoPrompt, setVideoPrompt] = useState("");
  const [flowModel, setFlowModel] = useState<
    "Veo 3.1 - Fast" | "Veo 3.1 - Quality" | "Omni 1.1 Flash"
  >("Veo 3.1 - Fast");
  const [videoAspect, setVideoAspect] = useState<"9:16" | "16:9">("9:16");
  const [videoDuration, setVideoDuration] = useState<4 | 6 | 8 | 10>(8);
  const [maxCredits, setMaxCredits] = useState<number>(25);
  const [flowCredits, setFlowCredits] = useState<number>(45000);
  const [flowConnectedMode, setFlowConnectedMode] = useState<string>("studio-preview");

  const [generatingImg, setGeneratingImg] = useState(false);
  const [generatingVid, setGeneratingVid] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [savingMode, setSavingMode] = useState<string | null>(null);

  // Fetch Google Flow MCP status & credits
  useEffect(() => {
    fetch("/api/video", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.creditsRemaining === "number") {
          setFlowCredits(d.creditsRemaining);
        }
        if (d.mode) setFlowConnectedMode(d.mode);
      })
      .catch(() => null);
  }, []);

  // Load existing post when ?edit=<id> is provided
  useEffect(() => {
    if (!editId) return;
    fetch(`/api/posts?id=${editId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const p = data.post;
        if (!p) return;
        setTitle(p.title || "");
        setCaption(p.caption || "");
        setHashtagInput(
          (p.hashtags || []).map((h: string) => `#${h}`).join(" ")
        );
        setPlatforms(p.platforms || ["instagram"]);
        setMediaItems(
          (p.media || []).map((m: { url: string; type?: string }) => ({
            url: m.url,
            type:
              m.type === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(m.url)
                ? "video"
                : "image",
          }))
        );
        if (p.scheduledAt) {
          const d = new Date(p.scheduledAt);
          const pad = (n: number) => String(n).padStart(2, "0");
          setScheduledLocal(
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
              d.getDate()
            )}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          );
        }
        if (p.timeZone) setTimeZone(p.timeZone);
      })
      .catch(() => null);
  }, [editId]);

  const parsedHashtags = hashtagInput
    .split(/[\s,]+/)
    .map((h) => h.replace(/^#/, "").trim())
    .filter(Boolean);

  function togglePlatform(id: string) {
    setPlatforms((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((p) => p !== id)
          : prev
        : [...prev, id]
    );
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/media", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const mediaType: "image" | "video" =
        data.mediaType === "video" || file.type.startsWith("video/")
          ? "video"
          : "image";
      setMediaItems((prev) => [...prev, { url: data.url, type: mediaType }]);
      toast.success(
        mediaType === "video" ? "Video uploaded!" : "Image uploaded!"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingMedia(false);
      e.target.value = "";
    }
  }

  async function handleGenerateImage() {
    if (!aiPrompt.trim()) {
      toast.error("Describe the visual you want Gemini / Nano Banana to create");
      return;
    }
    setGeneratingImg(true);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          prompt: aiPrompt.trim(),
          aspect: aiAspect,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setMediaItems((prev) => [...prev, { url: data.url, type: "image" }]);
      setAiPrompt("");
      toast.success(`Generated ${aiAspect} image!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate image");
    } finally {
      setGeneratingImg(false);
    }
  }

  async function handleGenerateFlowVideo() {
    if (!videoPrompt.trim()) {
      toast.error("Describe the video scene for Google Flow (Veo 3.1 / Omni Flash)");
      return;
    }
    setGeneratingVid(true);
    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: videoPrompt.trim(),
          model: flowModel,
          aspect: videoAspect,
          duration: videoDuration,
          maxCredits,
          project: campaign.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Video generation failed");
      setMediaItems((prev) => [...prev, { url: data.url, type: "video" }]);
      if (typeof data.creditsUsed === "number" && data.creditsUsed > 0) {
        setFlowCredits((c) => Math.max(0, c - data.creditsUsed));
      }
      setVideoPrompt("");
      toast.success(
        `Generated ${videoAspect} video via ${data.model} (${data.provider})!`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate video");
    } finally {
      setGeneratingVid(false);
    }
  }

  async function submitPost(mode: "draft" | "schedule" | "publish-now") {
    if (!caption.trim() && mediaItems.length === 0) {
      toast.error("Add a caption or at least one image/video before saving");
      return;
    }
    setSavingMode(mode);
    try {
      const payload = {
        action: editId ? "update" : "create",
        id: editId ? Number(editId) : undefined,
        title:
          title.trim() || caption.trim().slice(0, 48) || "Social Campaign Post",
        caption,
        hashtags: parsedHashtags,
        platforms,
        media: mediaItems.map((m) => ({
          url: m.url,
          type: m.type,
          mimeType: m.url.endsWith(".mp4")
            ? "video/mp4"
            : m.url.endsWith(".webm")
            ? "video/webm"
            : "image/webp",
        })),
        status: mode === "draft" ? "draft" : "scheduled",
        scheduledAt:
          mode === "draft" ? null : new Date(scheduledLocal).toISOString(),
        publishNow: mode === "publish-now",
        timeZone,
      };

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save post");

      if (editId && mode === "publish-now") {
        await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "publish-now", id: Number(editId) }),
        });
      }

      toast.success(
        mode === "draft"
          ? "Saved draft!"
          : mode === "publish-now"
          ? `Published to ${platforms.join(", ")}!`
          : "Scheduled post on your Campaign Calendar!"
      );
      router.push("/dashboard/posts");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save post");
    } finally {
      setSavingMode(null);
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/dashboard/posts"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Posts
        </Link>
        <span className="text-xs font-semibold text-slate-400">
          {editId ? `Editing Post #${editId}` : "Post & Google Flow Video Composer"}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Composer Form */}
        <div className="lg:col-span-7 space-y-5 rounded-3xl border border-slate-200/90 bg-white p-5 lg:p-6 shadow-2xs">
          {/* Target Platforms (Including Facebook!) */}
          <div>
            <label className="block text-xs font-extrabold text-slate-900 mb-2">
              1. Target Social Platforms
            </label>
            <div className="flex flex-wrap gap-2">
              {PRIMARY_PLATFORM_IDS.map((pid: PlatformId) => {
                const spec = PLATFORMS[pid];
                const selected = platforms.includes(pid);
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => togglePlatform(pid)}
                    className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                      selected
                        ? "border-blue-600 bg-blue-600 text-white shadow-2xs"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {spec.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visual Media: Google Flow Video MCP + Gemini Image + Upload */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setStudioMode("video")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    studioMode === "video"
                      ? "bg-white text-blue-600 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Film className="h-3.5 w-3.5" />
                  Google Flow Video MCP
                </button>
                <button
                  type="button"
                  onClick={() => setStudioMode("image")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    studioMode === "image"
                      ? "bg-white text-blue-600 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Gemini / ImageKit Studio
                </button>
              </div>

              <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
                {uploadingMedia ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5 text-blue-600" />
                )}
                Upload Image / MP4
                <input
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {studioMode === "video" ? (
              /* Google Flow MCP Video Generator Box */
              <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/70 via-blue-50/50 to-white p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
                    <Film className="h-4 w-4 text-violet-600" />
                    <span>Google Flow Video Generator (Veo 3.1 &amp; Omni Flash)</span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-800">
                    <Coins className="h-3 w-3" />
                    {flowCredits.toLocaleString()} Flow Credits •{" "}
                    {flowConnectedMode === "flow-mcp-daemon"
                      ? "Live MCP"
                      : "Ready"}
                  </span>
                </div>

                <textarea
                  rows={2}
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="Describe camera motion, subject, lighting & sound (e.g. Close-up slow-motion espresso pour on sunlit oak counter, golden steam rising, warm acoustic cafe ambiance)..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs focus:border-violet-500 focus:outline-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={flowModel}
                      onChange={(e) =>
                        setFlowModel(
                          e.target.value as
                            | "Veo 3.1 - Fast"
                            | "Veo 3.1 - Quality"
                            | "Omni 1.1 Flash"
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"
                    >
                      <option value="Veo 3.1 - Fast">Veo 3.1 — Fast (8s)</option>
                      <option value="Veo 3.1 - Quality">
                        Veo 3.1 — Quality (8s 1080p)
                      </option>
                      <option value="Omni 1.1 Flash">
                        Omni 1.1 Flash (4s–10s)
                      </option>
                    </select>

                    <select
                      value={videoAspect}
                      onChange={(e) =>
                        setVideoAspect(e.target.value as "9:16" | "16:9")
                      }
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"
                    >
                      <option value="9:16">9:16 Vertical (Reels/Shorts)</option>
                      <option value="16:9">16:9 Landscape</option>
                    </select>

                    {flowModel === "Omni 1.1 Flash" && (
                      <select
                        value={videoDuration}
                        onChange={(e) =>
                          setVideoDuration(
                            Number(e.target.value) as 4 | 6 | 8 | 10
                          )
                        }
                        className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"
                      >
                        <option value={4}>4s</option>
                        <option value={6}>6s</option>
                        <option value={8}>8s</option>
                        <option value={10}>10s</option>
                      </select>
                    )}

                    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                      <span>Max credits:</span>
                      <input
                        type="number"
                        min={5}
                        max={200}
                        value={maxCredits}
                        onChange={(e) =>
                          setMaxCredits(Number(e.target.value) || 25)
                        }
                        className="w-12 font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={generatingVid}
                    onClick={handleGenerateFlowVideo}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50 cursor-pointer"
                  >
                    {generatingVid ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Film className="h-3.5 w-3.5" />
                    )}
                    {generatingVid ? "Generating Reel..." : "Generate Flow Video"}
                  </button>
                </div>
              </div>
            ) : (
              /* AI Image Generator Bar */
              <div className="flex flex-wrap sm:flex-nowrap gap-2 rounded-2xl border border-blue-100 bg-blue-50/50 p-2.5">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe an image to generate with Gemini Nano Banana / Studio..."
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
                <select
                  value={aiAspect}
                  onChange={(e) =>
                    setAiAspect(
                      e.target.value as "1:1" | "4:5" | "9:16" | "16:9"
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700"
                >
                  <option value="1:1">1:1</option>
                  <option value="4:5">4:5</option>
                  <option value="9:16">9:16</option>
                  <option value="16:9">16:9</option>
                </select>
                <button
                  type="button"
                  disabled={generatingImg}
                  onClick={handleGenerateImage}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {generatingImg ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Generate
                </button>
              </div>
            )}

            {/* Attached Media Strip */}
            {mediaItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {mediaItems.map((item, idx) => {
                  const isMp4 = /\.(mp4|webm|mov)(\?|$)/i.test(item.url);
                  return (
                    <div
                      key={`${item.url}-${idx}`}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-900"
                    >
                      {isMp4 ? (
                        <video
                          src={item.url}
                          muted
                          loop
                          autoPlay
                          playsInline
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={item.url}
                          alt={`Media ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      )}

                      {item.type === "video" && (
                        <span className="absolute top-2 left-2 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          🎬 VIDEO
                        </span>
                      )}

                      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
                        {item.type === "image" && !isMp4 ? (
                          <button
                            type="button"
                            onClick={() => setEditingIndex(idx)}
                            className="inline-flex items-center gap-1 rounded-xl bg-white/95 backdrop-blur px-2.5 py-1.5 text-[11px] font-extrabold text-slate-900 shadow-md hover:bg-blue-600 hover:text-white transition cursor-pointer"
                          >
                            <Wand2 className="h-3 w-3" />
                            Edit Image
                          </button>
                        ) : (
                          <span />
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setMediaItems((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="rounded-xl bg-red-600/90 p-1.5 text-white shadow-md hover:bg-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Title, Caption & Hashtags */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-900 mb-1">
                3. Internal Post Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Morning Espresso Launch Reel — Facebook & Instagram"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-900 mb-1">
                4. Post Caption &amp; Hook
              </label>
              <textarea
                rows={5}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Start with a scroll-stopping hook in the first 100 characters..."
                className="w-full rounded-xl border border-slate-200 p-3.5 text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-900 mb-1">
                5. Hashtags
              </label>
              <input
                type="text"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                placeholder="#reels #facebookreels #cafelaunch #veo3"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Schedule Date, Time & Timezone */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
              <CalendarClock className="h-4 w-4 text-blue-600" />
              6. Schedule Delivery (Facebook Graph API / Blotato / OpenPost MCP)
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledLocal}
                  onChange={(e) => setScheduledLocal(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              disabled={savingMode !== null}
              onClick={() => submitPost("draft")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              Save Draft
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={savingMode !== null}
                onClick={() => submitPost("publish-now")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                Publish Now
              </button>

              <button
                type="button"
                disabled={savingMode !== null}
                onClick={() => submitPost("schedule")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {savingMode === "schedule" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarClock className="h-3.5 w-3.5" />
                )}
                Schedule Post
              </button>
            </div>
          </div>
        </div>

        {/* Right Live Platform Preview */}
        <div className="lg:col-span-5">
          <div className="sticky top-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
              Live Platform Preview
            </h3>
            <PlatformPreview
              platforms={platforms}
              brandName={profile?.brandName || campaign.name}
              title={title}
              caption={caption}
              hashtags={parsedHashtags}
              mediaUrls={mediaItems.map((m) => m.url)}
              mediaTypes={mediaItems.map((m) => m.type)}
            />
          </div>
        </div>
      </div>

      {/* ImageKit AI Studio Modal */}
      {editingIndex !== null && mediaItems[editingIndex] && (
        <ImageKitEditorModal
          imageUrl={mediaItems[editingIndex].url}
          onClose={() => setEditingIndex(null)}
          onApply={(newUrl) => {
            setMediaItems((prev) =>
              prev.map((m, idx) =>
                idx === editingIndex ? { ...m, url: newUrl } : m
              )
            );
          }}
        />
      )}
    </div>
  );
}

export default function NewPostPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-500">
          Loading Post Composer...
        </div>
      }
    >
      <PostComposerInner />
    </Suspense>
  );
}
