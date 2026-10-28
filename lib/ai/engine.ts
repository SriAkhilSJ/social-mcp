import "server-only";
import OpenAI from "openai";
import { Agent, run, setDefaultOpenAIClient } from "@openai/agents";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  agentPlans,
  agentSettings,
  contentDrafts,
  postAnalytics,
  posts,
  researchFindings,
  userIntegrations,
} from "@/db/schema";
import { AGENT_ROLES, type AgentRoleId } from "@/lib/agent-roles";
import { decryptSecret } from "@/lib/crypto/secrets";
import { buildBriefPromptBlock } from "@/lib/campaign-brief";

export interface ResolvedAiClient {
  client: OpenAI;
  model: string;
  provider: "openai" | "gemini" | "openai-compatible";
  geminiKey?: string;
  baseUrl?: string;
}

export async function resolveAiClientForUser(
  userId: string
): Promise<ResolvedAiClient | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(userIntegrations)
    .where(eq(userIntegrations.userId, userId));

  let userOpenAiKey: string | undefined;
  let userGeminiKey: string | undefined;
  let userCompatibleKey: string | undefined;
  let userCompatibleUrl: string | undefined;
  let userCompatibleModel: string | undefined;

  for (const r of rows) {
    try {
      if (r.provider === "openai") {
        userOpenAiKey = decryptSecret(r.apiKeyEncrypted);
        if (r.endpointUrl) userCompatibleUrl = r.endpointUrl;
      }
      if (
        r.provider === "openai_compatible" ||
        r.provider === "ollama" ||
        r.provider === "deepseek" ||
        r.provider === "openrouter" ||
        r.provider === "lmstudio"
      ) {
        userCompatibleKey = decryptSecret(r.apiKeyEncrypted);
        userCompatibleUrl = r.endpointUrl || undefined;
        userCompatibleModel = r.accounts?.find((a) => a.id === "model")?.name || undefined;
      }
      if (r.provider === "gemini") userGeminiKey = decryptSecret(r.apiKeyEncrypted);
    } catch {
      continue;
    }
  }

  // 1. OpenAI-Compatible Custom Provider (Ollama, LM Studio, DeepSeek, OpenRouter, vLLM, Groq, etc.)
  const compatibleUrl =
    userCompatibleUrl ||
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.OPENAI_COMPATIBLE_BASE_URL?.trim();

  const compatibleKey =
    userCompatibleKey ||
    userOpenAiKey ||
    process.env.OPENAI_COMPATIBLE_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "not-needed";

  if (compatibleUrl) {
    const defaultModel =
      userCompatibleModel ||
      process.env.OPENAI_COMPATIBLE_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      (compatibleUrl.includes("deepseek")
        ? "deepseek-chat"
        : compatibleUrl.includes("11434")
        ? "llama3"
        : "gpt-4o-mini");

    const client = new OpenAI({
      apiKey: compatibleKey,
      baseURL: compatibleUrl,
      timeout: 20_000,
      maxRetries: 1,
    });

    return {
      client,
      model: defaultModel,
      provider: "openai-compatible",
      baseUrl: compatibleUrl,
      geminiKey: userGeminiKey || process.env.GEMINI_API_KEY?.trim(),
    };
  }

  // 2. Official OpenAI
  const openAiKey = userOpenAiKey || process.env.OPENAI_API_KEY?.trim();
  const geminiKey = userGeminiKey || process.env.GEMINI_API_KEY?.trim();

  if (openAiKey) {
    const client = new OpenAI({
      apiKey: openAiKey,
      timeout: 90_000,
      maxRetries: 2,
    });
    return {
      client,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      provider: "openai",
      geminiKey,
    };
  }

  // 3. Google Gemini (via OpenAI compatibility endpoint)
  if (geminiKey) {
    const client = new OpenAI({
      apiKey: geminiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      timeout: 20_000,
      maxRetries: 1,
    });
    return {
      client,
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
      provider: "gemini",
      geminiKey,
    };
  }

  return null;
}

export async function getLiveAnalyticsContext(userId: string): Promise<string> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(postAnalytics)
      .where(eq(postAnalytics.userId, userId))
      .orderBy(desc(postAnalytics.likes), desc(postAnalytics.postedAt))
      .limit(12);

    if (rows.length === 0) return "";

    const totalLikes = rows.reduce((s, r) => s + (Number(r.likes) || 0), 0);
    const totalComments = rows.reduce((s, r) => s + (Number(r.comments) || 0), 0);
    const totalShares = rows.reduce((s, r) => s + (Number(r.shares) || 0), 0);

    const postSummaries = rows.map((r, i) => {
      const dateStr = new Date(r.postedAt).toISOString().slice(0, 10);
      const cleanText = (r.text || "").replace(/[\r\n]+/g, " ").slice(0, 140);
      return `${i + 1}. [${dateStr}] "${cleanText}" — Likes: ${r.likes || 0}, Comments: ${r.comments || 0}, Shares: ${r.shares || 0}`;
    });

    return [
      `### Live Connected Facebook Page Real Performance Data (${rows.length} real posts analyzed):`,
      `- Total Likes: ${totalLikes}`,
      `- Total Comments: ${totalComments}`,
      `- Total Shares: ${totalShares}`,
      `Top Synced Posts on Facebook Page:`,
      ...postSummaries,
    ].join("\n");
  } catch {
    return "";
  }
}

export async function getCrossAgentTeamAwareness(
  campaignId: number,
  currentAgentId: AgentRoleId
): Promise<string> {
  try {
    const db = await getDb();

    // 1. Latest Research Findings
    const [latestResearch] = await db
      .select()
      .from(researchFindings)
      .where(eq(researchFindings.campaignId, campaignId))
      .orderBy(desc(researchFindings.id))
      .limit(1);

    // 2. Latest Content Drafts
    const latestDrafts = await db
      .select()
      .from(contentDrafts)
      .where(eq(contentDrafts.campaignId, campaignId))
      .orderBy(desc(contentDrafts.id))
      .limit(3);

    // 3. Upcoming Scheduled Posts
    const upcomingPosts = await db
      .select()
      .from(posts)
      .where(and(eq(posts.campaignId, campaignId), eq(posts.status, "scheduled")))
      .orderBy(desc(posts.id))
      .limit(3);

    // 4. Current Master Agent Active Plan
    const [activePlan] = await db
      .select()
      .from(agentPlans)
      .where(and(eq(agentPlans.campaignId, campaignId), eq(agentPlans.status, "in_progress")))
      .orderBy(desc(agentPlans.id))
      .limit(1);

    const sections: string[] = [
      `### Real-Time AI Team Awareness (Live work from your teammates):`,
    ];

    if (activePlan) {
      sections.push(
        `- **Master Agent Active Plan:** "${activePlan.title}" (Request: "${activePlan.request.slice(0, 80)}")`
      );
    }

    if (latestResearch) {
      sections.push(
        `- **Research Agent's Latest Intel:** Topic "${latestResearch.topic}". Summary: ${(latestResearch.summary || "").slice(0, 140)}...`
      );
    }

    if (latestDrafts.length > 0) {
      sections.push(
        `- **Creator Agent's Latest Drafts:** ${latestDrafts
          .map((d) => `"${d.title}" (${d.platform})`)
          .join(", ")}`
      );
    }

    if (upcomingPosts.length > 0) {
      sections.push(
        `- **Scheduler Agent's Calendar Queue:** ${upcomingPosts.length} post(s) queued for publishing (${upcomingPosts
          .map((p) => p.title)
          .join(", ")}).`
      );
    }

    sections.push(
      `\nTEAM COLLABORATION RULE: You are part of an integrated 5-agent studio (Master, Research, Creator, Scheduler, Analytics). You ARE fully aware of your teammates' work, the active campaign, and the channel's series. Reference your teammates' discoveries and build upon them seamlessly!`
    );

    return sections.join("\n");
  } catch {
    return "";
  }
}

export async function getAgentSystemInstructions(
  campaignId: number,
  agentId: AgentRoleId,
  userId?: string
): Promise<string> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(agentSettings)
    .where(eq(agentSettings.campaignId, campaignId));
  const found = rows.find((r) => r.agentId === agentId);
  const role = AGENT_ROLES[agentId];
  const brief = await buildBriefPromptBlock(campaignId);
  const teamAwareness = await getCrossAgentTeamAwareness(campaignId, agentId);

  let analyticsContext = "";
  if (userId) {
    analyticsContext = await getLiveAnalyticsContext(userId);
  }

  let creatorVideoContext = "";
  if (agentId === "creator" || agentId === "master") {
    creatorVideoContext = `\n### VIDEO & VISUAL STUDIO CAPABILITIES (Google Flow MCP - Veo 3.1):
- You ARE equipped with 9:16 vertical video generation via Google Flow MCP (Veo 3.1 & Omni 1.1 Flash) on http://127.0.0.1:8787 with 45,000 Flow credits.
- REEL PRODUCTION BLUEPRINT: When the user asks for the blueprint, scene breakdown, actors, characters, or storyboard before creating a reel, ALWAYS provide a structured "🎬 REEL PRODUCTION BLUEPRINT" with:
  1. 👤 Cast & Characters (Actors, appearance, tailored suits, dark tinted glasses, expressions)
  2. 🏙️ Environment & Setting (Lighting, dark noir neon, rain, 9:16 vertical framing)
  3. ⚡ First 3-Second Viral Hook (Visual movement + voiceover + on-screen text)
  4. 🎞️ Shot-by-Shot Timeline (0:00-0:03 Hook, 0:03-0:06 Escalation / Sensory Parrying, 0:06-0:08 Cliffhanger)
  5. 🎵 Sound Design & Dialogue (Drift phonk beat-drop, rain Foley, cold calculating voiceover)
  6. 🤖 Exact Veo 3.1 Video Prompt (The exact prompt that will be sent to the video engine)
Always give the user complete creative control to review, edit, or approve the blueprint before rendering!`;
  }

  const workerBoundary =
    agentId !== "master"
      ? `\n\nIMPORTANT ROLE RULES:\n- You are the ${role.name} (${role.tagline}). Focus deeply on your specialty.\n- In direct chat with the user, provide thorough, actionable, data-backed insights directly using the live data provided. If the user wants full cross-agent automated campaigns (research -> draft -> schedule), inform them that the Master Agent can orchestrate the whole team.`
      : "";

  return [
    role.defaultInstructions,
    found?.customInstructions ? `\nCustom Campaign Instructions:\n${found.customInstructions}` : "",
    brief ? `\n${brief}` : "",
    teamAwareness ? `\n${teamAwareness}` : "",
    analyticsContext ? `\n${analyticsContext}` : "",
    creatorVideoContext ? `\n${creatorVideoContext}` : "",
    workerBoundary,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runAgentSdkChat(params: {
  userId: string;
  campaignId: number;
  agentId: AgentRoleId;
  history: Array<{ sender: string; text: string }>;
  userMessage: string;
}): Promise<string> {
  const instructions = await getAgentSystemInstructions(
    params.campaignId,
    params.agentId,
    params.userId
  );
  const ai = await resolveAiClientForUser(params.userId);

  if (ai) {
    try {
      if (ai.provider === "openai" && !ai.baseUrl) {
        setDefaultOpenAIClient(
          ai.client as unknown as Parameters<typeof setDefaultOpenAIClient>[0]
        );
        const sdkAgent = new Agent({
          name: AGENT_ROLES[params.agentId].name,
          instructions,
          model: ai.model,
        });
        const contextTranscript = params.history
          .slice(-8)
          .map((m) => `${m.sender === "user" ? "User" : "Agent"}: ${m.text}`)
          .join("\n");
        const fullInput = contextTranscript
          ? `Recent conversation:\n${contextTranscript}\n\nUser: ${params.userMessage}`
          : params.userMessage;
        const result = await run(sdkAgent, fullInput);
        if (result.finalOutput) return String(result.finalOutput);
      } else {
        const completion = await ai.client.chat.completions.create({
          model: ai.model,
          messages: [
            { role: "system", content: instructions },
            ...params.history.slice(-8).map((m) => ({
              role: (m.sender === "user" ? "user" : "assistant") as "user" | "assistant",
              content: m.text,
            })),
            { role: "user", content: params.userMessage },
          ],
        });
        const reply = completion.choices[0]?.message?.content;
        if (reply) return reply;
      }
    } catch (err: unknown) {
      console.error("[Agent Chat] LLM call error:", (err as Error)?.message || err);
      // Fall back cleanly to built-in specialist intelligence
    }
  }

  return buildSmartFallbackWorkerReply(params.agentId, params.userMessage);
}

function buildSmartFallbackWorkerReply(
  agentId: AgentRoleId,
  userMessage: string
): string {
  const lower = userMessage.toLowerCase();
  const role = AGENT_ROLES[agentId];

  if (
    agentId !== "master" &&
    /\b(create\s+\d+\s+post|schedule\s+them|full\s+campaign|plan\s+and\s+publish)\b/i.test(
      lower
    )
  ) {
    return `I'm the **${role.name}** (${role.tagline}). I only accept full campaign task assignments from our **Master Agent** so the whole team stays coordinated.\n\nSwitch to **Master Agent** on the left and send that exact request — the Master Agent will build the plan and assign my part automatically!`;
  }

  if (agentId === "research") {
    return `Here are high-performing content angles for **"${userMessage.slice(0, 80)}"**:\n\n1. **High-Retention Hook**: Open with a dramatic character reveal or cliffhanger in the first 2 seconds.\n2. **Narrative Arc**: Conflict escalation, unexpected twist, and community engagement question.\n3. **Recommended Tags**: \`#AnimeEdits\` \`#AnimeCommunity\` \`#ViralClips\` \`#Animation\` \`#Trending\`\n\nTo plan and run a complete multi-agent workflow, ask our **Master Agent**!`;
  }

  if (agentId === "creator") {
    return `As your **Creator Agent**, here is a draft angle for **"${userMessage.slice(0, 80)}"**:\n\n**Visual Hook:** Dramatic shadows cut across the frame as the hidden power awakens...\n**Caption:** They thought he was ordinary until the seals shattered. Who saw this moment coming?\n**Call-To-Action:** Drop a 🔥 if you want the next chapter immediately!\n\nTo have me generate AI studio images, videos, and schedule them, ask the **Master Agent** to kick off a plan!`;
  }

  if (agentId === "scheduler") {
    return `As your **Scheduler Agent**, I manage optimal posting slots, timezone alignment, and **Meta Graph / OpenPost MCP** delivery.\n\n- **Peak Morning Window:** 8:00 AM – 9:30 AM local time\n- **Peak Evening Window:** 6:00 PM – 7:30 PM local time\n\nAsk the **Master Agent** when you're ready to schedule new posts onto your **Posts** & **Calendar** pages!`;
  }

  if (agentId === "analytics") {
    return `As your **Analytics Agent**, I track **Total Posts Published**, **Views**, **Publishing Success Rate**, and **Platform Breakdown** synced from your connected **Facebook Page** and social channels.\n\nHead to the **Analytics** tab to click **Sync Now**, or ask the **Master Agent** for a campaign review!`;
  }

  return `I'm ready to coordinate your AI agent team! Tell me what content you'd like to research, create, and schedule — for example:\n\n> *"Create Episode 2 of The Blind Janitor anime series and schedule it for Facebook & Instagram."*`;
}
