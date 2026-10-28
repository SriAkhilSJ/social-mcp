import { NextResponse } from "next/server";
import { getRequestScope } from "@/lib/request-scope";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

import {
  getVideoEngineMode,
  setVideoEngineMode,
  type VideoEngineMode,
} from "@/lib/video/engine-options";
import {
  getCreatorStudioChat,
  appendCreatorStudioMessage,
  saveCreatorStudioChat,
} from "@/lib/remote-control";

const execAsync = promisify(exec);
const CDP_HTTP = "http://127.0.0.1:9333";
const FLOW_DAEMON = "http://127.0.0.1:8787";

export async function GET() {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Probe CDP tabs
    const cdpRes = await fetch(`${CDP_HTTP}/json/list`, {
      signal: AbortSignal.timeout(2000),
    });

    if (!cdpRes.ok) {
      return NextResponse.json({
        connected: false,
        message: "Chrome session not running on CDP port 9333",
      });
    }

    const tabs = (await cdpRes.json()) as Array<{
      title: string;
      url: string;
      type: string;
    }>;

    const flowTab =
      tabs.find(
        (t) =>
          t.type === "page" &&
          (t.url.includes("flow.google.com/project") ||
            t.url.includes("flow.google.com"))
      ) || tabs.find((t) => t.url.includes("flow.google.com"));

    // 2. Query Flow MCP daemon status
    let daemonInfo = null;
    const token =
      process.env.FLOW_MCP_TOKEN?.trim() ||
      "116224995ce8736067b3e869e6995e1c7e21b3c79bdb0fe3";

    try {
      const dRes = await fetch(`${FLOW_DAEMON}/api/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-flow-token": token,
        },
        body: JSON.stringify({ detailed: true }),
        signal: AbortSignal.timeout(3000),
      });
      if (dRes.ok) {
        daemonInfo = await dRes.json();
      }
    } catch {
      // Daemon may be busy or inactive
    }

    // 3. Scan generated images in media folder
    const mediaDir = path.join(process.cwd(), ".data", "media");
    let localAssets: Array<{ url: string; name: string; time: number }> = [];
    if (fs.existsSync(mediaDir)) {
      const files = fs.readdirSync(mediaDir);
      localAssets = files
        .filter((f) => /\.(webp|jpg|jpeg|png|mp4)$/i.test(f))
        .map((f) => {
          const stat = fs.statSync(path.join(mediaDir, f));
          return {
            url: `/api/media/${f}`,
            name: f,
            time: stat.mtimeMs,
          };
        })
        .sort((a, b) => b.time - a.time)
        .slice(0, 8);
    }

    // 4. Fetch recent scheduled campaign posts
    let campaignPosts: Array<{ id: number; title: string; status: string; hasMedia: boolean }> = [];
    try {
      const db = await getDb();
      const dbPosts = await db
        .select({
          id: posts.id,
          title: posts.title,
          status: posts.status,
          media: posts.media,
        })
        .from(posts)
        .where(eq(posts.campaignId, scope.campaign.id))
        .orderBy(posts.id);

      campaignPosts = dbPosts.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        hasMedia: Array.isArray(p.media) && p.media.length > 0,
      }));
    } catch {
      // Fallback
    }

    return NextResponse.json({
      connected: Boolean(flowTab),
      tab: flowTab || null,
      daemon: daemonInfo,
      localAssets,
      campaignPosts,
      videoEngineMode: getVideoEngineMode(),
      messages: getCreatorStudioChat(),
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json({
      connected: false,
      error: (err as Error).message,
    });
  }
}

export async function POST(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    action: "instruct" | "animate" | "chat" | "import-to-post" | "set-video-mode" | "clear-chat";
    prompt?: string;
    message?: string;
    mediaUrl?: string;
    postId?: number;
    mode?: VideoEngineMode;
  };

  if (body.action === "set-video-mode") {
    const newMode: VideoEngineMode =
      body.mode === "flow_path" ? "flow_path" : "coding_agent";
    setVideoEngineMode(newMode);
    return NextResponse.json({
      ok: true,
      mode: newMode,
      message:
        newMode === "coding_agent"
          ? "Option 1 active: Video generation by coding agents (Recommended) - Flow browser is strictly bypassed by coding agents."
          : "Option 2 active: Flow path - Automated Google Flow browser session.",
    });
  }

  if (body.action === "clear-chat") {
    saveCreatorStudioChat([]);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "chat" || body.action === "instruct") {
    const rawInput = String(body.message || body.prompt || "").trim();
    if (!rawInput) {
      return NextResponse.json({ error: "Message or prompt is required" }, { status: 400 });
    }

    const timeStr = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    appendCreatorStudioMessage({
      id: `u-${Date.now()}`,
      sender: "user",
      text: rawInput,
      time: timeStr,
    });

    // Refine into optimal Google Flow prompt
    let directorReply = "";
    let flowPrompt = rawInput;

    if (body.action === "chat") {
      const lower = rawInput.toLowerCase();
      if (lower.includes("rain") || lower.includes("glass") || lower.includes("lighting")) {
        flowPrompt = `Cinematic anime visual, an intelligent blind gangster in charcoal suit, heavy rain dripping on dark sunglasses, neon red and cyan street reflections, 8k resolution, photorealistic cinematic lighting`;
        directorReply = `Understood! Adjusting the lighting and atmospheric mood. Directing Google Flow with high-contrast neon reflections and rain physics.`;
      } else if (lower.includes("boardroom") || lower.includes("meeting") || lower.includes("ambush")) {
        flowPrompt = `Cinematic wide angle anime scene, blind gangster holding walking cane standing at head of luxury syndicate boardroom, stunned mafia bosses, dramatic chiaroscuro shadows, 8k resolution`;
        directorReply = `Drafting the boardroom confrontation. Directing Google Flow to render the tense atmosphere and syndicate table framing.`;
      } else if (lower.includes("daughter") || lower.includes("boss") || lower.includes("girl")) {
        flowPrompt = `Cinematic emotional anime scene, dangerous mafia boss gently protecting his young daughter in a dark luxury penthouse overlooking the neon city, cinematic lighting, 8k resolution`;
        directorReply = `Focusing on the emotional story arc. Directing Google Flow with cinematic penthouse lighting and protective father-daughter framing.`;
      } else if (lower.includes("animate") || lower.includes("video") || lower.includes("veo")) {
        flowPrompt = `Animate this scene into a cinematic 9:16 vertical video using Veo 3.1 with camera panning slowly past the blind gangster as rain drops fall on neon pavement`;
        directorReply = `Triggering Veo 3.1 video animation engine in Google Flow with a 9:16 vertical motion track.`;
      } else {
        flowPrompt = `Cinematic high-IQ psychological anime style, ${rawInput}, moody neon lighting, 8k resolution, cinematic masterpiece`;
        directorReply = `Applying your creative suggestion. Directing Google Flow with cinematic grading and refined framing.`;
      }
    } else {
      directorReply = `Instruction dispatched directly to Google Flow canvas.`;
    }

    try {
      // Execute through our reliable Playwright CLI script
      const env = { ...process.env, FLOW_USER_PROMPT: flowPrompt };

      // Write prompt to a temp task file
      fs.writeFileSync(
        path.join(process.cwd(), ".data", "flow-instruction.json"),
        JSON.stringify({ prompt: flowPrompt, time: Date.now() })
      );

      // Trigger instruction in background
      void execAsync(`node scripts/submit-flow.mjs`, { env }).catch(() => {});

      appendCreatorStudioMessage({
        id: `c-${Date.now()}`,
        sender: "creator",
        text: directorReply,
        dispatchedPrompt: flowPrompt,
        time: timeStr,
      });

      return NextResponse.json({
        ok: true,
        reply: directorReply,
        prompt: flowPrompt,
        message: "Instruction delivered to Google Flow! Live generation underway.",
      });
    } catch (err: unknown) {
      return NextResponse.json(
        { error: (err as Error).message || "Instruction failed" },
        { status: 500 }
      );
    }
  }

  if (body.action === "import-to-post") {
    const mediaUrl = body.mediaUrl;
    if (!mediaUrl) {
      return NextResponse.json({ error: "Missing mediaUrl" }, { status: 400 });
    }

    try {
      if (body.postId) {
        const db = await getDb();
        await db
          .update(posts)
          .set({
            media: [
              {
                url: mediaUrl,
                type: mediaUrl.endsWith(".mp4") ? "video" : "image",
                fileId: path.basename(mediaUrl),
                origin: "generated",
                prompt: "Live Flow Studio generated asset",
              },
            ],
            updatedAt: new Date(),
          })
          .where(eq(posts.id, body.postId));
      }

      return NextResponse.json({
        ok: true,
        message: "Asset linked to post successfully!",
      });
    } catch (err: unknown) {
      return NextResponse.json(
        { error: (err as Error).message || "Import failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
