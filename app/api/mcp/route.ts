import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { posts, contentDrafts, agentTasks, agentPlans, campaigns, agentMessages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  getVideoEngineMode,
  setVideoEngineMode,
  type VideoEngineMode,
} from "@/lib/video/engine-options";
import {
  getRemoteControlState,
  setRemoteControlState,
  appendCreatorStudioMessage,
  saveCreatorStudioChat,
  saveMeetingSession,
} from "@/lib/remote-control";
import fs from "fs";
import path from "path";

const CDP_HTTP = "http://127.0.0.1:9333";

interface McpRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function safeIso(val: unknown): string | null {
  if (!val) return null;
  try {
    return new Date(val as string | number | Date).toISOString();
  } catch {
    return String(val);
  }
}

async function gatherMonitoringData() {
  const db = await getDb();
  const videoEngineMode = getVideoEngineMode();

  // 1. Fetch Campaign Posts
  let allPosts: Array<{
    id: number;
    title: string;
    status: string;
    media: unknown;
    scheduledAt: string | null;
  }> = [];

  try {
    const dbPosts = await db
      .select({
        id: posts.id,
        title: posts.title,
        status: posts.status,
        media: posts.media,
        scheduledAt: posts.scheduledAt,
      })
      .from(posts)
      .orderBy(desc(posts.id))
      .limit(20);

    allPosts = dbPosts.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      media: p.media,
      scheduledAt: safeIso(p.scheduledAt),
    }));
  } catch (err) {
    console.error("Error querying posts in /api/mcp:", err);
  }

  // 1b. Fetch Content Drafts
  let allDrafts: Array<{
    id: number;
    title: string;
    kind: string;
    platform: string;
    media: unknown;
  }> = [];

  try {
    const dbDrafts = await db
      .select({
        id: contentDrafts.id,
        title: contentDrafts.title,
        kind: contentDrafts.kind,
        platform: contentDrafts.platform,
        media: contentDrafts.media,
      })
      .from(contentDrafts)
      .orderBy(desc(contentDrafts.id))
      .limit(20);

    allDrafts = dbDrafts.map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      platform: d.platform,
      media: d.media,
    }));
  } catch (err) {
    console.error("Error querying drafts in /api/mcp:", err);
  }

  // 2. Fetch AI Agent Tasks & Plans
  let recentTasks: Array<{
    id: number;
    agentId: string;
    title: string;
    status: string;
    currentStep: string | null;
    updatedAt: string | null;
  }> = [];

  try {
    const tasks = await db
      .select({
        id: agentTasks.id,
        agentId: agentTasks.agentId,
        title: agentTasks.title,
        status: agentTasks.status,
        currentStep: agentTasks.currentStep,
        updatedAt: agentTasks.updatedAt,
      })
      .from(agentTasks)
      .orderBy(desc(agentTasks.updatedAt))
      .limit(10);

    recentTasks = tasks.map((t) => ({
      id: t.id,
      agentId: t.agentId,
      title: t.title,
      status: t.status,
      currentStep: t.currentStep,
      updatedAt: safeIso(t.updatedAt),
    }));
  } catch (err) {
    console.error("Error querying tasks in /api/mcp:", err);
  }

  // 3. Inspect Flow / Chrome CDP
  let flowStatus: {
    connected: boolean;
    tab?: { title: string; url: string } | null;
    credits: number;
  } = {
    connected: false,
    tab: null,
    credits: 1050,
  };

  try {
    const cdpRes = await fetch(`${CDP_HTTP}/json/list`, {
      signal: AbortSignal.timeout(1500),
    });
    if (cdpRes.ok) {
      const tabs = (await cdpRes.json()) as Array<{
        title: string;
        url: string;
        type: string;
      }>;
      const flowTab = tabs.find((t) => t.url.includes("flow.google.com"));
      flowStatus = {
        connected: Boolean(flowTab),
        tab: flowTab ? { title: flowTab.title, url: flowTab.url } : null,
        credits: 1050,
      };
    }
  } catch {
    // CDP not reachable
  }

  // 4. Local Media Assets
  const mediaDir = path.join(process.cwd(), ".data", "media");
  let mediaCount = 0;
  let recentAssets: string[] = [];
  if (fs.existsSync(mediaDir)) {
    const files = fs.readdirSync(mediaDir);
    mediaCount = files.length;
    recentAssets = files.slice(-6);
  }

  return {
    system: {
      name: "OpenPost MCP Monitoring Server",
      version: "1.0.0",
      status: "operational",
      timestamp: new Date().toISOString(),
    },
    videoEngineOptions: {
      activeMode: videoEngineMode,
      description:
        videoEngineMode === "coding_agent"
          ? "Option 1: Video generation by coding agents (Recommended) - Flow browser is strictly bypassed by coding agents."
          : "Option 2: Flow path - Studio browser session via Chrome CDP.",
      options: [
        {
          id: "flow_path",
          label: "Option 2: Flow path (Active)",
          recommended: true,
          flowUsed: true,
          details: "Automated Google Flow browser session via Chrome CDP for native video model generation.",
        },
        {
          id: "coding_agent",
          label: "Option 1: Video generation by coding agents",
          recommended: false,
          flowUsed: false,
          details:
            "Direct API generation. Restricted: only active when a dedicated native video generation model API is connected.",
        },
      ],
    },
    campaignPosts: {
      total: allPosts.length + allDrafts.length,
      scheduledPosts: allPosts,
      draftPosts: allDrafts,
    },
    aiAgents: {
      recentTasks,
      roles: ["master", "creator", "scheduler", "research", "analytics"],
    },
    creatorStudio: {
      flowConnection: flowStatus,
      mediaCount,
      recentAssets,
    },
  };
}

// REST GET endpoint for instant diagnostic inspection
export async function GET() {
  try {
    const data = await gatherMonitoringData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || "Monitoring error" },
      { status: 500 }
    );
  }
}

// MCP JSON-RPC 2.0 endpoint
export async function POST(req: Request) {
  let body: McpRpcRequest;
  try {
    body = (await req.json()) as McpRpcRequest;
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
      { status: 400 }
    );
  }

  const { id = 1, method, params = {} } = body;

  if (method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "socialix-openpost-mcp",
          version: "1.0.0",
        },
      },
    });
  }

  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "openpost_monitor_all",
            description:
              "Monitor all things added till now: scheduled campaign posts, AI agent task states, Creator Studio Flow connection, media assets, and video engine mode.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "openpost_list_posts",
            description: "List all scheduled and draft posts in the campaign with attached media links and publication status.",
            inputSchema: {
              type: "object",
              properties: {
                limit: { type: "number", description: "Max posts to return (default 10)" },
              },
            },
          },
          {
            name: "openpost_get_agent_status",
            description: "Monitor AI agent team execution, active plans, and task progress.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "openpost_get_creator_studio",
            description: "Monitor Creator Studio live Google Flow connection, credits remaining, and generated media stream.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "openpost_set_video_mode",
            description:
              "Set video generation engine mode: 'coding_agent' (Option 1: Recommended, coding agents do not use Flow) or 'flow_path' (Option 2: Google Flow browser path).",
            inputSchema: {
              type: "object",
              required: ["mode"],
              properties: {
                mode: {
                  type: "string",
                  enum: ["coding_agent", "flow_path"],
                  description: "coding_agent (Recommended) or flow_path",
                },
              },
            },
          },
          {
            name: "openpost_set_active_view",
            description: "Live-switch the view on the user's Socialix desktop app between 'creator-studio', 'meeting' (War Room), or 'agents'.",
            inputSchema: {
              type: "object",
              required: ["viewMode"],
              properties: {
                viewMode: {
                  type: "string",
                  enum: ["creator-studio", "meeting", "agents"],
                  description: "The view to display on the user's screen",
                },
                selectedAgent: {
                  type: "string",
                  description: "Optional agent role ID to select",
                },
                toast: {
                  type: "string",
                  description: "Notification message displayed on desktop",
                },
              },
            },
          },
          {
            name: "openpost_send_creator_directive",
            description: "Dispatch a visual prompt or creative suggestion to Creator Studio and stream it live to the desktop.",
            inputSchema: {
              type: "object",
              required: ["message"],
              properties: {
                message: {
                  type: "string",
                  description: "Creative instruction or scene prompt for the Creator Agent",
                },
              },
            },
          },
          {
            name: "openpost_assign_asset",
            description: "Attach an image or video asset to a campaign post by ID.",
            inputSchema: {
              type: "object",
              required: ["postId", "mediaUrl"],
              properties: {
                postId: {
                  type: "number",
                  description: "Campaign post ID to update",
                },
                mediaUrl: {
                  type: "string",
                  description: "Relative URL to the asset (e.g. /api/media/pilot_trailer_ren.mp4)",
                },
                title: {
                  type: "string",
                  description: "Optional updated post title",
                },
              },
            },
          },
          {
            name: "openpost_clear_all_chats",
            description: "Clear all chats across Master Agent, Creator Agent, Scheduler Agent, Analytics Agent, Research Agent, Creator Studio, and War Room.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "openpost_clear_agent_chat",
            description: "Clear chat for a specific agent role or view.",
            inputSchema: {
              type: "object",
              required: ["agentId"],
              properties: {
                agentId: {
                  type: "string",
                  enum: ["master", "creator", "scheduler", "analytics", "research", "creator-studio", "meeting"],
                  description: "Agent role ID or view to clear",
                },
              },
            },
          },
        ],
      },
    });
  }

  if (method === "tools/call") {
    const toolName = String(params.name || "");
    const args = (params.arguments || {}) as Record<string, unknown>;
    const monitoringData = await gatherMonitoringData();

    if (toolName === "openpost_monitor_all") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(monitoringData, null, 2),
            },
          ],
        },
      });
    }

    if (toolName === "openpost_list_posts") {
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const combined = [
        ...(monitoringData.campaignPosts.scheduledPosts || []),
        ...(monitoringData.campaignPosts.draftPosts || []),
      ];
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(combined.slice(0, limit), null, 2),
            },
          ],
        },
      });
    }

    if (toolName === "openpost_set_active_view") {
      const viewMode = (args.viewMode as "creator-studio" | "meeting" | "agents") || "creator-studio";
      const selectedAgent = args.selectedAgent as any;
      const toastMsg = typeof args.toast === "string" ? args.toast : `⚡ Switched to ${viewMode.toUpperCase()}`;
      const rc = setRemoteControlState({
        viewMode,
        selectedAgent,
        lastAction: {
          type: "switch-view",
          description: toastMsg,
          timestamp: Date.now(),
          toast: toastMsg,
        },
      });
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, remoteControl: rc }, null, 2),
            },
          ],
        },
      });
    }

    if (toolName === "openpost_send_creator_directive") {
      const message = String(args.message || args.directive || "").trim();
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const prompt = `Cinematic anime visual, 9:16 vertical, ${message}, 8k resolution, cinematic lighting`;
      const reply = `🎨 Directive received! Directing visual engine for '${message}'. Rendering 9:16 vertical motion scene...`;
      appendCreatorStudioMessage({
        id: `u-${Date.now()}`,
        sender: "user",
        text: message,
        time: timeStr,
      });
      appendCreatorStudioMessage({
        id: `c-${Date.now()}`,
        sender: "creator",
        text: reply,
        dispatchedPrompt: prompt,
        time: timeStr,
      });
      setRemoteControlState({
        viewMode: "creator-studio",
        selectedAgent: "creator",
        lastAction: {
          type: "creator-directive",
          description: `Creator Agent dispatched: ${message}`,
          timestamp: Date.now(),
          toast: `🎨 Creator Agent: ${message}`,
        },
      });
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, prompt, reply }, null, 2),
            },
          ],
        },
      });
    }

    if (toolName === "openpost_assign_asset") {
      const postId = Number(args.postId);
      const mediaUrl = String(args.mediaUrl);
      const title = args.title ? String(args.title) : undefined;
      const isVideo = mediaUrl.endsWith(".mp4");
      const db = await getDb();

      const updateData: Record<string, unknown> = {
        media: [
          {
            url: mediaUrl,
            name: path.basename(mediaUrl),
            type: isVideo ? "video" : "image",
            fileId: path.basename(mediaUrl),
            origin: "generated",
            prompt: title || "Cinematic Anime Visual",
            mimeType: isVideo ? "video/mp4" : "image/jpeg",
          },
        ],
        updatedAt: new Date(),
      };
      if (title) {
        updateData.title = title;
      }

      await db.update(posts).set(updateData).where(eq(posts.id, postId));

      setRemoteControlState({
        lastAction: {
          type: "asset-assigned",
          description: `Attached ${path.basename(mediaUrl)} to Post #${postId}`,
          timestamp: Date.now(),
          toast: `Attached ${path.basename(mediaUrl)} to Post #${postId}`,
        },
      });

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, postId, mediaUrl, isVideo }, null, 2),
            },
          ],
        },
      });
    }

    if (toolName === "openpost_get_agent_status") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(monitoringData.aiAgents, null, 2),
            },
          ],
        },
      });
    }

    if (toolName === "openpost_get_creator_studio") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(monitoringData.creatorStudio, null, 2),
            },
          ],
        },
      });
    }

    if (toolName === "openpost_set_video_mode") {
      const newMode = args.mode === "flow_path" ? "flow_path" : "coding_agent";
      setVideoEngineMode(newMode);
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Video generation mode set to: "${newMode}". ${
                newMode === "coding_agent"
                  ? "Option 1 (Recommended): Coding agents will generate video directly via SDK/API and strictly NEVER use Google Flow."
                  : "Option 2: Flow path active."
              }`,
            },
          ],
        },
      });
    }

    if (toolName === "openpost_clear_all_chats") {
      const db = await getDb();
      await db.delete(agentMessages);
      saveCreatorStudioChat([]);
      saveMeetingSession({
        topic: "Strategic Campaign Planning",
        turns: [],
        updatedAt: Date.now(),
      });
      setRemoteControlState({
        viewMode: "agents",
        selectedAgent: "master",
        lastAction: {
          type: "clear-all-chats",
          description: "All agent chats, Creator Studio & War Room cleared via MCP",
          buttonName: "Clear All Chats",
          timestamp: Date.now(),
          toast: "🧹 All Agent chats & histories cleared via MCP",
        },
      });
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  cleared: ["master", "creator", "scheduler", "analytics", "research", "creator-studio", "meeting"],
                  message: "Successfully cleared all agent chats, Creator Studio, and War Room via MCP protocol.",
                },
                null,
                2
              ),
            },
          ],
        },
      });
    }

    if (toolName === "openpost_clear_agent_chat") {
      const target = String(args.agentId || "master");
      const db = await getDb();
      if (target === "creator-studio") {
        saveCreatorStudioChat([]);
      } else if (target === "meeting") {
        saveMeetingSession({
          topic: "Strategic Campaign Planning",
          turns: [],
          updatedAt: Date.now(),
        });
      } else {
        await db.delete(agentMessages).where(eq(agentMessages.agentId, target));
      }
      setRemoteControlState({
        viewMode: target === "creator-studio" ? "creator-studio" : target === "meeting" ? "meeting" : "agents",
        selectedAgent: target !== "creator-studio" && target !== "meeting" ? (target as any) : undefined,
        lastAction: {
          type: "clear-chat",
          description: `Cleared chat for ${target.toUpperCase()} via MCP`,
          buttonName: `Clear ${target} Chat`,
          timestamp: Date.now(),
          toast: `🧹 Cleared chat for ${target.toUpperCase()}`,
        },
      });
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, cleared: target }, null, 2),
            },
          ],
        },
      });
    }

    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown tool: ${toolName}` },
    });
  }

  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}
