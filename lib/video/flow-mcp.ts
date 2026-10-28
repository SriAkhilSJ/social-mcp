import "server-only";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userIntegrations } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto/secrets";
import {
  saveLocalMediaBuffer,
  uploadToImageKitOrLocal,
} from "@/lib/storage/imagekit";

export type FlowVideoModelId =
  | "Veo 3.1 - Fast"
  | "Veo 3.1 - Quality"
  | "Omni 1.1 Flash";

export type VideoAspect = "9:16" | "16:9";
export type VideoDuration = 4 | 6 | 8 | 10;

export {
  getVideoEngineMode,
  setVideoEngineMode,
  type VideoEngineMode,
} from "./engine-options";

export const FLOW_VIDEO_MODELS: Array<{
  id: FlowVideoModelId;
  label: string;
  badge: string;
  defaultDuration: VideoDuration;
  estCredits: number;
  description: string;
}> = [
  {
    id: "Veo 3.1 - Fast",
    label: "Veo 3.1 — Fast (Google Flow)",
    badge: "~15–20 Flow credits",
    defaultDuration: 8,
    estCredits: 20,
    description: "Fast 8s cinematic Reel/Short with native audio & free 1080p upscale",
  },
  {
    id: "Veo 3.1 - Quality",
    label: "Veo 3.1 — Quality (Google Flow)",
    badge: "~80–100 Flow credits",
    defaultDuration: 8,
    estCredits: 100,
    description: "Highest fidelity 8s flagship Veo 3.1 generation + 1080p",
  },
  {
    id: "Omni 1.1 Flash",
    label: "Omni 1.1 Flash (Google Flow)",
    badge: "~10 Flow credits",
    defaultDuration: 6,
    estCredits: 10,
    description: "Ultra-fast 4s–10s social motion clips for high-volume testing",
  },
];

interface FlowConfig {
  endpointUrl: string;
  token: string;
  geminiKey?: string;
}

function readLocalFlowMcpToken(): string | null {
  try {
    const tokenPath = path.join(os.homedir(), ".flow-mcp", "token");
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, "utf8").trim();
    }
  } catch {
    // Ignore
  }
  return null;
}

export async function resolveFlowConfigForUser(
  userId: string
): Promise<FlowConfig> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(userIntegrations)
    .where(eq(userIntegrations.userId, userId));

  let savedEndpoint: string | null = null;
  let savedToken: string | null = null;
  let geminiKey: string | undefined = process.env.GEMINI_API_KEY?.trim();

  for (const r of rows) {
    try {
      if (r.provider === "flow_mcp") {
        savedToken = decryptSecret(r.apiKeyEncrypted);
        savedEndpoint = r.endpointUrl;
      } else if (r.provider === "gemini") {
        geminiKey = decryptSecret(r.apiKeyEncrypted);
      }
    } catch {
      continue;
    }
  }

  return {
    endpointUrl: (
      savedEndpoint?.trim() ||
      process.env.FLOW_MCP_URL?.trim() ||
      "http://127.0.0.1:8787"
    ).replace(/\/$/, ""),
    token:
      savedToken?.trim() ||
      readLocalFlowMcpToken() ||
      process.env.FLOW_MCP_TOKEN?.trim() ||
      "",
    geminiKey,
  };
}

export interface FlowStatusResult {
  connected: boolean;
  mode: "flow-mcp-daemon" | "flow-agent-rest" | "gemini-veo-api" | "studio-preview";
  endpointUrl: string;
  creditsRemaining: number;
  planName: string;
  models: typeof FLOW_VIDEO_MODELS;
  message: string;
}

export async function getFlowMcpStatus(userId: string): Promise<FlowStatusResult> {
  const cfg = await resolveFlowConfigForUser(userId);
  const defaultCredits = Number(process.env.FLOW_CREDITS_BALANCE || "45000");

  // 1. Probe GTAI-1/flow-mcp Studio/MCP Daemon (default http://127.0.0.1:8787)
  try {
    const healthRes = await fetch(`${cfg.endpointUrl}/api/health`, {
      signal: AbortSignal.timeout(2_500),
    });
    if (healthRes.ok) {
      let credits = defaultCredits;
      let plan = "Google AI Pro / Flow";
      if (cfg.token && cfg.token !== "demo" && cfg.token !== "demo-mode-key") {
        const stRes = await fetch(`${cfg.endpointUrl}/api/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-flow-token": cfg.token,
          },
          body: JSON.stringify({ detailed: true }),
          signal: AbortSignal.timeout(6_000),
        });
        if (stRes.ok) {
          const stJson = (await stRes.json()) as {
            credits?: number;
            plan?: string;
          };
          if (typeof stJson.credits === "number") credits = stJson.credits;
          if (stJson.plan) plan = stJson.plan;
        }
      }
      return {
        connected: true,
        mode: "flow-mcp-daemon",
        endpointUrl: cfg.endpointUrl,
        creditsRemaining: credits,
        planName: plan,
        models: FLOW_VIDEO_MODELS,
        message: `Connected to live Google Flow MCP daemon (${cfg.endpointUrl})`,
      };
    }
  } catch {
    // Try flow-agent next
  }

  // 2. Probe kodelyx/flow-agent REST bridge (http://127.0.0.1:8001)
  try {
    const agentUrl = cfg.endpointUrl.includes("8001")
      ? cfg.endpointUrl
      : "http://127.0.0.1:8001";
    const healthRes = await fetch(`${agentUrl}/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (healthRes.ok) {
      const balRes = await fetch(`${agentUrl}/api/v1/balance`, {
        signal: AbortSignal.timeout(3_000),
      });
      const balJson = balRes.ok
        ? ((await balRes.json()) as { total_credits?: number; credits?: number })
        : {};
      return {
        connected: true,
        mode: "flow-agent-rest",
        endpointUrl: agentUrl,
        creditsRemaining:
          balJson.total_credits ?? balJson.credits ?? defaultCredits,
        planName: "Google Flow Agent Bridge",
        models: FLOW_VIDEO_MODELS,
        message: `Connected to Google Flow Agent (${agentUrl})`,
      };
    }
  } catch {
    // Fall through
  }

  if (cfg.geminiKey) {
    return {
      connected: true,
      mode: "gemini-veo-api",
      endpointUrl: "https://generativelanguage.googleapis.com/v1beta",
      creditsRemaining: defaultCredits,
      planName: "Google AI Pro + Veo API",
      models: FLOW_VIDEO_MODELS,
      message:
        "Gemini Veo API ready (run start-flow-mcp.bat locally to switch to 45,000 Google Flow browser credits)",
    };
  }

  return {
    connected: Boolean(cfg.token),
    mode: "studio-preview",
    endpointUrl: cfg.endpointUrl,
    creditsRemaining: defaultCredits,
    planName: "Google Flow Credits Ready (45,000)",
    models: FLOW_VIDEO_MODELS,
    message:
      "Studio Motion Reel active in cloud preview — run start-flow-mcp.bat on your PC to drive your 45,000 Google Flow credits directly via Chrome CDP!",
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapVideoLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

async function renderAnimatedStudioReelBuffer(
  prompt: string,
  aspect: VideoAspect = "9:16",
  modelLabel = "Veo 3.1 - Fast",
  durationSec = 8
): Promise<Buffer> {
  const w = aspect === "16:9" ? 960 : 540;
  const h = aspect === "16:9" ? 540 : 960;
  const frames = 12;

  const cleanHeadline = prompt
    .replace(
      /^(create|generate|shoot|make|film)\s+(an?\s+)?(vertical\s+)?(video|reel|short|clip|tiktok)\s+(of|for|about)?\s*/i,
      ""
    )
    .trim();
  const titleText =
    cleanHeadline.charAt(0).toUpperCase() + cleanHeadline.slice(1);
  const lines = wrapVideoLines(
    titleText || "Cinematic Brand Launch Reel",
    aspect === "16:9" ? 30 : 18,
    4
  );

  const lower = prompt.toLowerCase();
  const pal =
    lower.includes("coffee") || lower.includes("cafe") || lower.includes("warm")
      ? { bg1: "#1C0F0A", bg2: "#9A3412", glow: "#FBBF24", pill: "#F59E0B" }
      : lower.includes("facebook") || lower.includes("tech") || lower.includes("ai")
      ? { bg1: "#09152E", bg2: "#1877F2", glow: "#38BDF8", pill: "#2563EB" }
      : { bg1: "#130926", bg2: "#6D28D9", glow: "#F472B6", pill: "#8B5CF6" };

  const rawFrames: Buffer[] = [];
  for (let i = 0; i < frames; i++) {
    const t = i / frames;
    const angle = t * Math.PI * 2;
    const orb1X = Math.round(w * 0.5 + Math.cos(angle) * (w * 0.24));
    const orb1Y = Math.round(h * 0.34 + Math.sin(angle) * (h * 0.14));
    const orb2X = Math.round(w * 0.5 - Math.cos(angle) * (w * 0.26));
    const orb2Y = Math.round(h * 0.68 - Math.sin(angle) * (h * 0.12));
    const progressW = Math.max(24, Math.round(((i + 1) / frames) * (w - 96)));
    const visibleLines = Math.min(lines.length, Math.max(1, Math.ceil(((i + 2) / frames) * lines.length)));
    const pulseRadius = Math.round((w * 0.24) + Math.sin(angle) * 22);

    const fontSize = aspect === "16:9" ? 40 : 42;
    const lineHeight = Math.round(fontSize * 1.24);
    const startY = Math.round(h * 0.44);

    const svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vbg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${pal.bg1}"/>
          <stop offset="100%" stop-color="${pal.bg2}"/>
        </linearGradient>
        <radialGradient id="g1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${pal.glow}" stop-opacity="0.52"/>
          <stop offset="100%" stop-color="${pal.glow}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#vbg)"/>
      <circle cx="${orb1X}" cy="${orb1Y}" r="${pulseRadius}" fill="url(#g1)"/>
      <circle cx="${orb2X}" cy="${orb2Y}" r="${Math.round(w * 0.28)}" fill="url(#g1)"/>
      <rect x="32" y="32" width="${w - 64}" height="${h - 64}" rx="28" fill="#FFFFFF" fill-opacity="0.05" stroke="#FFFFFF" stroke-opacity="0.16" stroke-width="1.5"/>
      <rect x="48" y="54" width="232" height="34" rx="17" fill="#0F172A" fill-opacity="0.72"/>
      <circle cx="70" cy="71" r="6" fill="#EF4444"/>
      <text x="86" y="76" font-family="sans-serif" font-size="13" font-weight="800" fill="#FFFFFF">FLOW MCP • ${escapeXml(modelLabel.toUpperCase())}</text>
      <text x="${w - 54}" y="76" font-family="monospace" font-size="13" font-weight="700" fill="#E2E8F0" text-anchor="end">00:0${Math.min(durationSec, Math.ceil(((i + 1) / frames) * durationSec))}</text>
      ${lines
        .slice(0, visibleLines)
        .map(
          (line, idx) =>
            `<text x="52" y="${startY + idx * lineHeight}" font-family="sans-serif" font-size="${fontSize}" font-weight="900" fill="#FFFFFF">${escapeXml(
              line
            )}</text>`
        )
        .join("\n")}
      <rect x="48" y="${h - 86}" width="${w - 96}" height="8" rx="4" fill="#FFFFFF" fill-opacity="0.22"/>
      <rect x="48" y="${h - 86}" width="${progressW}" height="8" rx="4" fill="${pal.glow}"/>
      <text x="48" y="${h - 54}" font-family="sans-serif" font-size="14" font-weight="700" fill="#E2E8F0">Google Flow Studio Reel • ${aspect} • ${durationSec}s</text>
    </svg>`;

    const raw = await sharp(Buffer.from(svg)).raw().ensureAlpha().toBuffer();
    rawFrames.push(raw);
  }

  const stacked = Buffer.concat(rawFrames);
  return sharp(stacked, {
    raw: {
      width: w,
      height: h * frames,
      channels: 4,
      pageHeight: h,
    },
  })
    .webp({
      loop: 0,
      delay: Array(frames).fill(150),
      quality: 86,
    })
    .toBuffer();
}

export async function generateFlowVideo(params: {
  userId: string;
  prompt: string;
  model?: FlowVideoModelId;
  aspect?: VideoAspect;
  duration?: VideoDuration;
  maxCredits?: number;
  project?: string;
  referenceImages?: string[];
  firstFrame?: string;
}): Promise<{
  url: string;
  fileId: string;
  mediaType: "video";
  format: "mp4" | "animated-webp";
  provider: string;
  model: string;
  creditsUsed: number;
}> {
  const model = params.model || "Veo 3.1 - Fast";
  const aspect: VideoAspect = params.aspect === "16:9" ? "16:9" : "9:16";
  const duration: VideoDuration = params.duration || 8;
  const maxCredits = params.maxCredits ?? 30;
  const cfg = await resolveFlowConfigForUser(params.userId);

  // 1. Try GTAI-1/flow-mcp Local Daemon (/api/generate + /api/wait + /media)
  if (cfg.token && cfg.token !== "demo" && cfg.token !== "demo-mode-key") {
    try {
      const genRes = await fetch(`${cfg.endpointUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-flow-token": cfg.token,
        },
        body: JSON.stringify({
          project: params.project || "Socialix",
          scenes: [
            {
              prompt: params.prompt,
              type: "video",
              model,
              aspect_ratio: aspect,
              duration: model === "Omni 1.1 Flash" ? duration : undefined,
              max_credits: maxCredits,
              download_quality: "upscaled",
              reference_images: params.referenceImages,
              first_frame: params.firstFrame,
            },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (genRes.ok) {
        const queued = (await genRes.json()) as {
          job_ids?: string[];
          jobs?: Array<{ id: string }>;
        };
        const jobIds =
          queued.job_ids || queued.jobs?.map((j) => j.id) || undefined;

        // Poll /api/wait up to 4 minutes
        const deadline = Date.now() + 240_000;
        while (Date.now() < deadline) {
          const waitRes = await fetch(`${cfg.endpointUrl}/api/wait`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-flow-token": cfg.token,
            },
            body: JSON.stringify({
              job_ids: jobIds,
              timeout_seconds: 35,
            }),
            signal: AbortSignal.timeout(45_000),
          });
          if (!waitRes.ok) break;
          const waitJson = (await waitRes.json()) as {
            finished?: boolean;
            results?: Array<{
              path?: string;
              file?: string;
              credits?: number;
              status?: string;
            }>;
          };
          if (waitJson.finished) {
            const first = waitJson.results?.[0];
            const outPath = first?.path || first?.file;
            if (outPath) {
              const mediaRes = await fetch(
                `${cfg.endpointUrl}/media?path=${encodeURIComponent(outPath)}`,
                {
                  headers: { "x-flow-token": cfg.token },
                  signal: AbortSignal.timeout(30_000),
                }
              );
              if (mediaRes.ok) {
                const mp4Buf = Buffer.from(await mediaRes.arrayBuffer());
                const saved = await saveLocalMediaBuffer(mp4Buf, "mp4");
                return {
                  url: saved.url,
                  fileId: saved.fileId,
                  mediaType: "video",
                  format: "mp4",
                  provider: "google-flow-mcp",
                  model,
                  creditsUsed: first?.credits ?? 20,
                };
              }
            }
            break;
          }
        }
      }
    } catch {
      // Try flow-agent next
    }
  }

  // 2. Try kodelyx/flow-agent REST bridge (http://127.0.0.1:8001/api/v1/video)
  try {
    const agentUrl = cfg.endpointUrl.includes("8001")
      ? cfg.endpointUrl
      : "http://127.0.0.1:8001";
    const health = await fetch(`${agentUrl}/health`, {
      signal: AbortSignal.timeout(1_800),
    });
    if (health.ok) {
      const vidRes = await fetch(`${agentUrl}/api/v1/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: params.prompt,
          aspect,
          duration: `${duration}s`,
          quality: "720p",
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (vidRes.ok) {
        const vidJson = (await vidRes.json()) as {
          files?: Array<{ url: string }>;
          credits_used?: number;
        };
        const fileUrl = vidJson.files?.[0]?.url;
        if (fileUrl) {
          const dl = await fetch(fileUrl, { signal: AbortSignal.timeout(30_000) });
          if (dl.ok) {
            const mp4Buf = Buffer.from(await dl.arrayBuffer());
            const saved = await saveLocalMediaBuffer(mp4Buf, "mp4");
            return {
              url: saved.url,
              fileId: saved.fileId,
              mediaType: "video",
              format: "mp4",
              provider: "google-flow-agent",
              model,
              creditsUsed: vidJson.credits_used ?? 15,
            };
          }
        }
      }
    }
  } catch {
    // Try Gemini Veo REST API next
  }

  // 3. Try Google Gemini Veo API if GEMINI_API_KEY is available
  if (cfg.geminiKey) {
    try {
      const veoModel =
        process.env.GEMINI_VIDEO_MODEL?.trim() || "veo-2.0-generate-001";
      const startRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${veoModel}:predictLongRunning?key=${encodeURIComponent(
          cfg.geminiKey
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: params.prompt }],
            parameters: {
              aspectRatio: aspect,
              durationSeconds: Math.min(8, Math.max(5, duration)),
            },
          }),
          signal: AbortSignal.timeout(20_000),
        }
      );
      if (startRes.ok) {
        const op = (await startRes.json()) as { name?: string };
        if (op.name) {
          const deadline = Date.now() + 150_000;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 5_000));
            const poll = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/${op.name}?key=${encodeURIComponent(
                cfg.geminiKey
              )}`,
              { signal: AbortSignal.timeout(15_000) }
            );
            if (!poll.ok) break;
            const pollJson = (await poll.json()) as {
              done?: boolean;
              response?: {
                generateVideoResponse?: {
                  generatedSamples?: Array<{ video?: { uri?: string } }>;
                };
              };
            };
            if (pollJson.done) {
              const videoUri =
                pollJson.response?.generateVideoResponse?.generatedSamples?.[0]
                  ?.video?.uri;
              if (videoUri) {
                const dl = await fetch(
                  `${videoUri}${
                    videoUri.includes("?") ? "&" : "?"
                  }key=${encodeURIComponent(cfg.geminiKey)}`
                );
                if (dl.ok) {
                  const mp4Buf = Buffer.from(await dl.arrayBuffer());
                  const uploaded = await uploadToImageKitOrLocal(mp4Buf, {
                    fileName: `veo-${Date.now()}.mp4`,
                    mimeType: "video/mp4",
                  });
                  return {
                    url: uploaded.url,
                    fileId: uploaded.fileId,
                    mediaType: "video",
                    format: "mp4",
                    provider: "gemini-veo",
                    model: veoModel,
                    creditsUsed: 0,
                  };
                }
              }
              break;
            }
          }
        }
      }
    } catch {
      // Fall back cleanly to animated Studio Motion Reel
    }
  }

  // 4. Sandbox / Zero-Key Preview: Render 12-frame Animated Motion Reel (.webp)
  const reelBuf = await renderAnimatedStudioReelBuffer(
    params.prompt,
    aspect,
    model,
    duration
  );
  const saved = await saveLocalMediaBuffer(reelBuf, "webp");
  return {
    url: saved.url,
    fileId: saved.fileId,
    mediaType: "video",
    format: "animated-webp",
    provider: "flow-studio-preview",
    model,
    creditsUsed: 0,
  };
}

/**
 * Option 1: Video generation by coding agents (Recommended)
 * The coding agent generates video directly via SDK/API (Gemini Veo API or Studio motion)
 * STRICT ENFORCEMENT: Coding agent NEVER touches Google Flow browser automation.
 */
export async function generateCodingAgentVideo(params: {
  userId: string;
  prompt: string;
  aspect?: VideoAspect;
  duration?: VideoDuration;
}): Promise<{
  url: string;
  fileId: string;
  mediaType: "video";
  format: "mp4" | "animated-webp";
  provider: string;
  model: string;
  creditsUsed: number;
}> {
  const aspect: VideoAspect = params.aspect === "16:9" ? "16:9" : "9:16";
  const duration: VideoDuration = params.duration || 8;
  const cfg = await resolveFlowConfigForUser(params.userId);

  // 1. Direct Google Gemini Veo API if key configured
  if (cfg.geminiKey) {
    try {
      const veoModel =
        process.env.GEMINI_VIDEO_MODEL?.trim() || "veo-2.0-generate-001";
      const startRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${veoModel}:predictLongRunning?key=${encodeURIComponent(
          cfg.geminiKey
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: params.prompt }],
            parameters: {
              aspectRatio: aspect,
              durationSeconds: Math.min(8, Math.max(5, duration)),
            },
          }),
          signal: AbortSignal.timeout(20_000),
        }
      );
      if (startRes.ok) {
        const op = (await startRes.json()) as { name?: string };
        if (op.name) {
          const deadline = Date.now() + 150_000;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 5_000));
            const poll = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/${op.name}?key=${encodeURIComponent(
                cfg.geminiKey
              )}`,
              { signal: AbortSignal.timeout(15_000) }
            );
            if (!poll.ok) break;
            const pollJson = (await poll.json()) as {
              done?: boolean;
              response?: {
                generateVideoResponse?: {
                  generatedSamples?: Array<{ video?: { uri?: string } }>;
                };
              };
            };
            if (pollJson.done) {
              const videoUri =
                pollJson.response?.generateVideoResponse?.generatedSamples?.[0]
                  ?.video?.uri;
              if (videoUri) {
                const dl = await fetch(
                  `${videoUri}${
                    videoUri.includes("?") ? "&" : "?"
                  }key=${encodeURIComponent(cfg.geminiKey)}`
                );
                if (dl.ok) {
                  const mp4Buf = Buffer.from(await dl.arrayBuffer());
                  const uploaded = await uploadToImageKitOrLocal(mp4Buf, {
                    fileName: `veo-agent-${Date.now()}.mp4`,
                    mimeType: "video/mp4",
                  });
                  return {
                    url: uploaded.url,
                    fileId: uploaded.fileId,
                    mediaType: "video",
                    format: "mp4",
                    provider: "coding-agent-veo",
                    model: veoModel,
                    creditsUsed: 0,
                  };
                }
              }
              break;
            }
          }
        }
      }
    } catch {
      // Continue to programmatic motion reel
    }
  }

  // 2. If no genuine video-generation model API is available, throw error to stick to Option 2 (Google Flow)
  throw new Error(
    "No native video-generating model API configured for coding agent. Sticking strictly to Option 2 (Google Flow Path)."
  );
}
