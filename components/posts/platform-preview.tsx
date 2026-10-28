"use client";

import { useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Film,
  Heart,
  MessageCircle,
  Music2,
  Send,
  Share2,
  ThumbsUp,
} from "lucide-react";
import { PLATFORMS, type PlatformId } from "@/lib/social/platforms";

function isNativeVideoUrl(url: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

function MediaElement({
  url,
  isVideoHint,
}: {
  url: string;
  isVideoHint?: boolean;
}) {
  if (isNativeVideoUrl(url)) {
    return (
      <video
        src={url}
        autoPlay
        muted
        loop
        playsInline
        controls
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div className="relative h-full w-full">
      <img src={url} alt="Social media preview" className="h-full w-full object-cover" />
      {isVideoHint && (
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/70 backdrop-blur px-2.5 py-0.5 text-[10px] font-bold text-white">
          <Film className="h-3 w-3 text-blue-400" />
          Flow Motion Reel
        </span>
      )}
    </div>
  );
}

export function PlatformPreview({
  platforms,
  brandName,
  title,
  caption,
  hashtags,
  mediaUrls,
  mediaTypes,
}: {
  platforms: string[];
  brandName: string;
  title?: string;
  caption: string;
  hashtags: string[];
  mediaUrls: string[];
  mediaTypes?: Array<"image" | "video">;
}) {
  const validPlatforms =
    platforms.length > 0 ? platforms : (["instagram"] as string[]);
  const [activePlatform, setActivePlatform] = useState<string>(
    validPlatforms[0]
  );
  const [slideIdx, setSlideIdx] = useState(0);

  const currentPlat = validPlatforms.includes(activePlatform)
    ? activePlatform
    : validPlatforms[0];
  const spec = PLATFORMS[currentPlat as PlatformId] || PLATFORMS.instagram;

  const handle =
    brandName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 18) || "socialixbrand";

  const formattedTags = hashtags
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .join(" ");
  const fullCopy = [caption.trim(), formattedTags].filter(Boolean).join("\n\n");
  const overCharLimit = fullCopy.length > spec.captionMax;
  const activeImg = mediaUrls[slideIdx] || mediaUrls[0] || null;
  const activeType = mediaTypes?.[slideIdx] || mediaTypes?.[0];
  const isVideo = activeType === "video" || isNativeVideoUrl(activeImg);

  const renderVerticalReel =
    currentPlat === "tiktok" ||
    currentPlat === "youtube" ||
    (currentPlat === "facebook" && isVideo);

  return (
    <div className="space-y-3">
      {/* Platform Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {validPlatforms.map((pl) => {
            const pSpec = PLATFORMS[pl as PlatformId];
            const selected = pl === currentPlat;
            return (
              <button
                key={pl}
                type="button"
                onClick={() => setActivePlatform(pl)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  selected
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {pSpec?.name || pl}
              </button>
            );
          })}
        </div>

        <span
          className={`text-[11px] font-semibold ${
            overCharLimit ? "text-red-600" : "text-slate-400"
          }`}
        >
          {fullCopy.length} / {spec.captionMax} chars
        </span>
      </div>

      {/* Simulated Device Card */}
      {renderVerticalReel ? (
        /* Vertical 9:16 Short-Form Frame (TikTok / YouTube Shorts / Facebook Reels) */
        <div className="mx-auto max-w-[300px] overflow-hidden rounded-[28px] border-4 border-slate-900 bg-slate-950 text-white shadow-xl">
          <div className="relative aspect-[9/15] w-full bg-slate-900">
            {activeImg ? (
              <MediaElement url={activeImg} isVideoHint={isVideo} />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-xs text-slate-400">
                Upload or generate a Google Flow video / image to preview {spec.name}
              </div>
            )}

            {/* Right Engagement Rail */}
            <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4 text-white drop-shadow pointer-events-none">
              <div className="flex flex-col items-center gap-0.5">
                {currentPlat === "facebook" ? (
                  <ThumbsUp className="h-6 w-6 fill-white/20" />
                ) : (
                  <Heart className="h-6 w-6 fill-white/20" />
                )}
                <span className="text-[10px] font-bold">2.4K</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <MessageCircle className="h-6 w-6" />
                <span className="text-[10px] font-bold">148</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <Share2 className="h-6 w-6" />
                <span className="text-[10px] font-bold">Share</span>
              </div>
            </div>

            {/* Bottom Overlay Copy */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 pt-12 pointer-events-none">
              <div className="text-xs font-bold">
                {currentPlat === "facebook" ? `${brandName} • Reels` : `@${handle}`}
              </div>
              {title && (
                <div className="text-xs font-semibold text-white/95 mt-0.5">
                  {title}
                </div>
              )}
              <p className="mt-1 text-[11px] text-white/85 line-clamp-3 whitespace-pre-wrap">
                {fullCopy || "Your caption & hashtags appear here..."}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/75">
                <Music2 className="h-3 w-3" />
                <span>Original Audio — {brandName}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Feed Card (Instagram / Facebook Page / LinkedIn / X) */
        <div className="mx-auto max-w-[380px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md">
          {/* Post Author Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div
                style={{
                  backgroundColor:
                    currentPlat === "facebook" ? "#1877F2" : undefined,
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
                  currentPlat === "facebook"
                    ? ""
                    : "bg-gradient-to-tr from-blue-600 via-violet-600 to-pink-500"
                }`}
              >
                {brandName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-none">
                  {currentPlat === "linkedin" || currentPlat === "facebook"
                    ? brandName
                    : handle}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {spec.name} {currentPlat === "facebook" ? "Page • Just now • 🌐" : "• Preview"}
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-400">•••</span>
          </div>

          {/* Copy above image for Facebook / X / LinkedIn */}
          {(currentPlat === "facebook" ||
            currentPlat === "x" ||
            currentPlat === "linkedin") && (
            <div className="px-4 py-3 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {fullCopy || "Write your post copy on the left..."}
            </div>
          )}

          {/* Media Canvas */}
          <div
            className={`relative ${
              isVideo ? "aspect-[9/14]" : "aspect-square"
            } w-full bg-slate-100 overflow-hidden`}
          >
            {activeImg ? (
              <MediaElement url={activeImg} isVideoHint={isVideo} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
                <span>Add an image or Google Flow video to preview</span>
                <span className="text-[10px] mt-1 text-slate-400">
                  Recommended: {spec.formats[0]?.recommendedSize}
                </span>
              </div>
            )}

            {mediaUrls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setSlideIdx((i) => (i - 1 + mediaUrls.length) % mediaUrls.length)
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSlideIdx((i) => (i + 1) % mediaUrls.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute top-3 right-3 rounded-full bg-black/65 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  {slideIdx + 1}/{mediaUrls.length}
                </div>
              </>
            )}
          </div>

          {/* Action Icons + Caption below image */}
          <div className="p-4 space-y-2">
            {currentPlat === "facebook" ? (
              <div className="flex items-center justify-around border-t border-slate-100 pt-2 text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <ThumbsUp className="h-4 w-4 text-[#1877F2]" /> Like
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4" /> Comment
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Share2 className="h-4 w-4" /> Share
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-slate-800">
                  <div className="flex items-center gap-3.5">
                    {currentPlat === "linkedin" ? (
                      <ThumbsUp className="h-5 w-5" />
                    ) : (
                      <Heart className="h-5 w-5" />
                    )}
                    <MessageCircle className="h-5 w-5" />
                    <Send className="h-5 w-5" />
                  </div>
                  <Bookmark className="h-5 w-5" />
                </div>

                {currentPlat !== "x" && currentPlat !== "linkedin" && (
                  <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    <span className="font-bold mr-1.5">{handle}</span>
                    {fullCopy || "Your caption & hashtags will appear here..."}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Platform Guidance Footer */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 text-[11px] text-slate-500 flex items-center justify-between gap-2">
        <span>💡 {spec.hashtagAdvice}</span>
        {spec.hashtagMax !== null && hashtags.length > spec.hashtagMax && (
          <span className="font-bold text-amber-600">
            Max {spec.hashtagMax} tags on {spec.name}
          </span>
        )}
      </div>
    </div>
  );
}
