export type PlatformId =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "linkedin"
  | "facebook"
  | "threads"
  | "pinterest";

export interface PlatformFormatSpec {
  id: string;
  label: string;
  aspects: Array<"1:1" | "4:5" | "9:16" | "16:9">;
  recommendedSize: string;
}

export interface PlatformSpec {
  id: PlatformId;
  name: string;
  color: string;
  badgeClass: string;
  captionMax: number;
  hashtagMax: number | null;
  hashtagAdvice: string;
  linksClickable: boolean;
  truncatesAt: number | null;
  videoOnly?: boolean;
  formats: PlatformFormatSpec[];
  checkedAt: string;
}

export const PLATFORMS: Record<PlatformId, PlatformSpec> = {
  instagram: {
    id: "instagram",
    name: "Instagram",
    color: "#E1306C",
    badgeClass: "bg-pink-50 text-pink-700 border-pink-200",
    captionMax: 2200,
    hashtagMax: 30,
    hashtagAdvice: "Use 3–8 highly relevant niche hashtags",
    linksClickable: false,
    truncatesAt: 125,
    formats: [
      { id: "feed", label: "Feed Post", aspects: ["4:5", "1:1"], recommendedSize: "1080×1350" },
      { id: "carousel", label: "Carousel (up to 20)", aspects: ["4:5", "1:1"], recommendedSize: "1080×1350" },
      { id: "reel", label: "Reel / Story", aspects: ["9:16"], recommendedSize: "1080×1920" },
    ],
    checkedAt: "2026-10-16",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    color: "#111827",
    badgeClass: "bg-slate-100 text-slate-900 border-slate-300",
    captionMax: 4000,
    hashtagMax: null,
    hashtagAdvice: "Use 3–5 searchable topic & trend tags",
    linksClickable: false,
    truncatesAt: 100,
    formats: [
      { id: "video", label: "Vertical Video / Photo Mode", aspects: ["9:16", "1:1"], recommendedSize: "1080×1920" },
    ],
    checkedAt: "2026-10-16",
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    color: "#FF0000",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    captionMax: 5000,
    hashtagMax: 15,
    hashtagAdvice: "Up to 3 Shorts hashtags (#shorts + 2 topic tags)",
    linksClickable: true,
    truncatesAt: 100,
    formats: [
      { id: "short", label: "YouTube Short", aspects: ["9:16"], recommendedSize: "1080×1920" },
      { id: "video", label: "Standard Video / Community", aspects: ["16:9", "1:1"], recommendedSize: "1920×1080" },
    ],
    checkedAt: "2026-10-16",
  },
  x: {
    id: "x",
    name: "X (Twitter)",
    color: "#0F172A",
    badgeClass: "bg-zinc-100 text-zinc-900 border-zinc-300",
    captionMax: 280,
    hashtagMax: 2,
    hashtagAdvice: "0–2 crisp hashtags integrated naturally",
    linksClickable: true,
    truncatesAt: 280,
    formats: [
      { id: "post", label: "Post / Thread", aspects: ["16:9", "1:1"], recommendedSize: "1600×900" },
    ],
    checkedAt: "2026-10-16",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    color: "#0A66C2",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    captionMax: 3000,
    hashtagMax: 5,
    hashtagAdvice: "3–5 industry hashtags at the end of the post",
    linksClickable: true,
    truncatesAt: 210,
    formats: [
      { id: "feed", label: "Feed Post", aspects: ["1:1", "4:5", "16:9"], recommendedSize: "1080×1080" },
    ],
    checkedAt: "2026-10-16",
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    color: "#1877F2",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    captionMax: 63206,
    hashtagMax: 5,
    hashtagAdvice: "1–3 broad community & Reels discovery hashtags",
    linksClickable: true,
    truncatesAt: 140,
    formats: [
      { id: "feed", label: "Page Feed Post", aspects: ["1:1", "4:5", "16:9"], recommendedSize: "1080×1350" },
      { id: "reel", label: "Facebook Reel (Video)", aspects: ["9:16"], recommendedSize: "1080×1920" },
    ],
    checkedAt: "2026-10-27",
  },
  threads: {
    id: "threads",
    name: "Threads",
    color: "#18181B",
    badgeClass: "bg-neutral-100 text-neutral-800 border-neutral-300",
    captionMax: 500,
    hashtagMax: 1,
    hashtagAdvice: "1 topic tag maximum on Threads",
    linksClickable: true,
    truncatesAt: 500,
    formats: [
      { id: "post", label: "Thread Post", aspects: ["4:5", "1:1"], recommendedSize: "1080×1350" },
    ],
    checkedAt: "2026-10-16",
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    color: "#E60023",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    captionMax: 500,
    hashtagMax: 20,
    hashtagAdvice: "Focus on SEO keywords in title and description",
    linksClickable: true,
    truncatesAt: 100,
    formats: [
      { id: "pin", label: "Standard Pin", aspects: ["4:5", "9:16"], recommendedSize: "1000×1500" },
    ],
    checkedAt: "2026-10-16",
  },
};

export const PRIMARY_PLATFORM_IDS: PlatformId[] = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "x",
  "linkedin",
];

export function platformRules(ids: string[]): string {
  const valid = ids
    .map((id) => PLATFORMS[id as PlatformId])
    .filter((p): p is PlatformSpec => Boolean(p));
  if (valid.length === 0) return "";
  return valid
    .map(
      (p) =>
        `- ${p.name}: max ${p.captionMax} chars${
          p.truncatesAt ? ` (hook in first ${p.truncatesAt} chars)` : ""
        }, ${p.hashtagAdvice}, formats: ${p.formats.map((f) => `${f.label} (${f.recommendedSize})`).join(", ")}`
    )
    .join("\n");
}
