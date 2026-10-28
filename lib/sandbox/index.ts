import "server-only";
import crypto from "crypto";
import sharp from "sharp";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { agentSandboxes, campaigns, sandboxPreviews } from "@/db/schema";
import { AGENT_ROLES, hasComputer } from "@/lib/agent-roles";

export interface SandboxView {
  agentId: "research" | "creator";
  status: "none" | "starting" | "running" | "paused" | "killed";
  control: "agent" | "user";
  activeTaskId: number | null;
  activeAt: string | null;
  hasPreview: boolean;
  ended: boolean;
  e2bConnected: boolean;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function generateDesktopPreviewBase64(params: {
  agentId: "research" | "creator";
  stepText: string;
  url?: string;
  status?: string;
}): Promise<string> {
  const role = AGENT_ROLES[params.agentId];
  const browserUrl =
    params.url ||
    (params.agentId === "research"
      ? "https://trends.socialix.studio/explore?q=viral+hooks"
      : "https://studio.imagekit.io/campaigns/assets");

  const svg = `<svg width="960" height="600" viewBox="0 0 960 600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wall" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0F172A"/>
        <stop offset="100%" stop-color="#1E293B"/>
      </linearGradient>
    </defs>
    <rect width="960" height="600" fill="url(#wall)"/>
    <!-- Linux Ubuntu/XFCE Top Bar -->
    <rect width="960" height="32" fill="#090D16"/>
    <circle cx="18" cy="16" r="5" fill="#22C55E"/>
    <text x="32" y="21" font-family="monospace" font-size="13" fill="#E2E8F0">E2B Cloud Desktop • ${escapeXml(role.name)} • /campaign/${params.agentId === "research" ? "research" : "assets"}</text>
    <text x="820" y="21" font-family="monospace" font-size="12" fill="#94A3B8">1280×800 • Ubuntu 24.04</text>

    <!-- Browser Window -->
    <rect x="36" y="54" width="620" height="492" rx="12" fill="#FFFFFF" stroke="#334155" stroke-width="2"/>
    <rect x="36" y="54" width="620" height="42" rx="12" fill="#F1F5F9"/>
    <circle cx="58" cy="75" r="6" fill="#EF4444"/>
    <circle cx="78" cy="75" r="6" fill="#F59E0B"/>
    <circle cx="98" cy="75" r="6" fill="#10B981"/>
    <rect x="122" y="62" width="514" height="26" rx="13" fill="#FFFFFF" stroke="#CBD5E1"/>
    <text x="138" y="79" font-family="monospace" font-size="12" fill="#475569">${escapeXml(browserUrl.slice(0, 62))}</text>

    <!-- Browser Content -->
    <rect x="60" y="118" width="572" height="78" rx="10" fill="#EFF6FF"/>
    <text x="80" y="150" font-family="sans-serif" font-size="16" font-weight="700" fill="#1E40AF">${escapeXml(role.name)} Active Session</text>
    <text x="80" y="176" font-family="sans-serif" font-size="13" fill="#3B82F6">${escapeXml(params.stepText.slice(0, 68))}</text>

    <rect x="60" y="214" width="276" height="142" rx="10" fill="#F8FAFC" stroke="#E2E8F0"/>
    <rect x="76" y="232" width="120" height="12" rx="6" fill="#CBD5E1"/>
    <rect x="76" y="256" width="230" height="10" rx="5" fill="#E2E8F0"/>
    <rect x="76" y="276" width="210" height="10" rx="5" fill="#E2E8F0"/>
    <rect x="76" y="310" width="94" height="26" rx="8" fill="#2563EB"/>

    <rect x="356" y="214" width="276" height="142" rx="10" fill="#F8FAFC" stroke="#E2E8F0"/>
    <rect x="372" y="232" width="150" height="12" rx="6" fill="#CBD5E1"/>
    <rect x="372" y="256" width="230" height="10" rx="5" fill="#E2E8F0"/>
    <rect x="372" y="276" width="190" height="10" rx="5" fill="#E2E8F0"/>
    <rect x="372" y="310" width="94" height="26" rx="8" fill="#7C3AED"/>

    <rect x="60" y="374" width="572" height="148" rx="10" fill="#0F172A"/>
    <text x="80" y="404" font-family="monospace" font-size="12" fill="#38BDF8">$ ls -la /campaign/research /campaign/assets /campaign/output</text>
    <text x="80" y="428" font-family="monospace" font-size="12" fill="#A7F3D0">drwxr-xr-x  research-brief.md   competitor-hooks.json</text>
    <text x="80" y="450" font-family="monospace" font-size="12" fill="#FDE68A">-rw-r--r--  post-visual-01.webp  post-visual-02.webp</text>
    <text x="80" y="478" font-family="monospace" font-size="12" fill="#94A3B8">Status: ${escapeXml(params.status || "running")} • Stream ready</text>

    <!-- Right Desktop File Explorer Panel -->
    <rect x="676" y="54" width="252" height="492" rx="12" fill="#1E293B" stroke="#334155" stroke-width="2"/>
    <text x="696" y="86" font-family="sans-serif" font-size="14" font-weight="700" fill="#F8FAFC">Workspace Folders</text>
    <rect x="696" y="106" width="212" height="58" rx="8" fill="#0F172A"/>
    <text x="712" y="130" font-family="monospace" font-size="12" fill="#60A5FA">/campaign/research</text>
    <text x="712" y="150" font-family="sans-serif" font-size="11" fill="#94A3B8">Trend notes &amp; live sources</text>

    <rect x="696" y="178" width="212" height="58" rx="8" fill="#0F172A"/>
    <text x="712" y="202" font-family="monospace" font-size="12" fill="#F472B6">/campaign/assets</text>
    <text x="712" y="222" font-family="sans-serif" font-size="11" fill="#94A3B8">Generated &amp; edited images</text>

    <rect x="696" y="250" width="212" height="58" rx="8" fill="#0F172A"/>
    <text x="712" y="274" font-family="monospace" font-size="12" fill="#34D399">/campaign/output</text>
    <text x="712" y="294" font-family="sans-serif" font-size="11" fill="#94A3B8">Final post deliverables</text>
  </svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return png.toString("base64");
}

export async function openOrUpdateAgentSandbox(params: {
  userId: string;
  campaignId: number;
  agentId: "research" | "creator";
  taskId?: number | null;
  stepText?: string;
  url?: string;
}): Promise<{ sandboxId: string; e2bStreamUrl: string | null }> {
  const db = await getDb();
  const [camp] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, params.campaignId))
    .limit(1);
  if (camp?.endedAt) {
    throw new Error("Campaign has ended");
  }

  let e2bId: string | null = null;
  let e2bStreamUrl: string | null = null;
  const e2bApiKey = process.env.E2B_API_KEY?.trim();

  if (e2bApiKey) {
    try {
      const { Sandbox } = await import("@e2b/desktop");
      const [existing] = await db
        .select()
        .from(agentSandboxes)
        .where(
          and(
            eq(agentSandboxes.campaignId, params.campaignId),
            eq(agentSandboxes.agentId, params.agentId)
          )
        )
        .limit(1);

      const desktop = existing?.sandboxId
        ? await Sandbox.connect(existing.sandboxId, { apiKey: e2bApiKey }).catch(() =>
            Sandbox.create({
              apiKey: e2bApiKey,
              resolution: [1280, 800],
              timeoutMs: 300_000,
            })
          )
        : await Sandbox.create({
            apiKey: e2bApiKey,
            resolution: [1280, 800],
            timeoutMs: 300_000,
          });

      e2bId = desktop.sandboxId;
      await desktop.commands
        .run("mkdir -p /campaign/research /campaign/assets /campaign/output")
        .catch(() => null);
      await desktop.stream.start().catch(() => null);
      e2bStreamUrl = desktop.stream.getUrl();
    } catch {
      e2bId = null;
    }
  }

  const sandboxId = e2bId || `sbx_${params.campaignId}_${params.agentId}`;
  const streamKey = crypto.randomBytes(8).toString("hex");
  const viewKey = crypto.randomBytes(8).toString("hex");

  await db
    .insert(agentSandboxes)
    .values({
      campaignId: params.campaignId,
      agentId: params.agentId,
      userId: params.userId,
      sandboxId,
      status: "running",
      activeAt: new Date(),
      taskId: params.taskId ?? null,
      leaseUntil: new Date(Date.now() + 10 * 60_000),
      control: "agent",
      streamKey: e2bStreamUrl || streamKey,
      viewKey: e2bStreamUrl ? `${e2bStreamUrl}&viewOnly=true` : viewKey,
    })
    .onConflictDoUpdate({
      target: [agentSandboxes.campaignId, agentSandboxes.agentId],
      set: {
        sandboxId,
        status: "running",
        activeAt: new Date(),
        taskId: params.taskId ?? undefined,
        leaseUntil: new Date(Date.now() + 10 * 60_000),
      },
    });

  const previewBase64 = await generateDesktopPreviewBase64({
    agentId: params.agentId,
    stepText: params.stepText || "Desktop active and ready for agent tasks",
    url: params.url,
    status: "running",
  });

  await db
    .insert(sandboxPreviews)
    .values({
      campaignId: params.campaignId,
      agentId: params.agentId,
      userId: params.userId,
      image: previewBase64,
      takenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [sandboxPreviews.campaignId, sandboxPreviews.agentId],
      set: {
        image: previewBase64,
        takenAt: new Date(),
      },
    });

  return { sandboxId, e2bStreamUrl };
}

export async function getSandboxViews(campaignId: number): Promise<SandboxView[]> {
  const db = await getDb();
  const [camp] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  const rows = await db
    .select()
    .from(agentSandboxes)
    .where(eq(agentSandboxes.campaignId, campaignId));
  const previews = await db
    .select({ agentId: sandboxPreviews.agentId })
    .from(sandboxPreviews)
    .where(eq(sandboxPreviews.campaignId, campaignId));

  const previewSet = new Set(previews.map((p) => p.agentId));
  const computerAgents: Array<"research" | "creator"> = ["research", "creator"];

  return computerAgents.map((agentId) => {
    const row = rows.find((r) => r.agentId === agentId);
    return {
      agentId,
      status: (row?.status as SandboxView["status"]) || "none",
      control: (row?.control as SandboxView["control"]) || "agent",
      activeTaskId: row?.taskId ?? null,
      activeAt: row?.activeAt ? row.activeAt.toISOString() : null,
      hasPreview: previewSet.has(agentId),
      ended: Boolean(camp?.endedAt),
      e2bConnected: Boolean(
        process.env.E2B_API_KEY?.trim() && row?.streamKey?.startsWith("http")
      ),
    };
  });
}

export async function setSandboxAction(params: {
  userId: string;
  campaignId: number;
  agentId: string;
  action: "start" | "pause" | "take-over" | "hand-back" | "heartbeat";
}) {
  if (!hasComputer(params.agentId)) {
    throw new Error("This agent does not use a cloud desktop");
  }
  const db = await getDb();

  if (params.action === "start") {
    await openOrUpdateAgentSandbox({
      userId: params.userId,
      campaignId: params.campaignId,
      agentId: params.agentId,
      stepText: "Cloud desktop started by user",
    });
    return;
  }

  const updates: Partial<typeof agentSandboxes.$inferInsert> = {
    activeAt: new Date(),
  };

  if (params.action === "pause") {
    updates.status = "paused";
    updates.control = "agent";
  } else if (params.action === "take-over") {
    await openOrUpdateAgentSandbox({
      userId: params.userId,
      campaignId: params.campaignId,
      agentId: params.agentId,
      stepText: "User took interactive mouse & keyboard control",
    });
    updates.status = "running";
    updates.control = "user";
  } else if (params.action === "hand-back") {
    updates.status = "running";
    updates.control = "agent";
  }

  await db
    .update(agentSandboxes)
    .set(updates)
    .where(
      and(
        eq(agentSandboxes.campaignId, params.campaignId),
        eq(agentSandboxes.agentId, params.agentId)
      )
    );
}

export async function pauseIdleSandboxes(): Promise<number> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - 3 * 60_000);
  const idle = await db
    .select()
    .from(agentSandboxes)
    .where(
      and(eq(agentSandboxes.status, "running"), lt(agentSandboxes.activeAt, cutoff))
    );

  for (const row of idle) {
    await db
      .update(agentSandboxes)
      .set({ status: "paused", control: "agent" })
      .where(
        and(
          eq(agentSandboxes.campaignId, row.campaignId),
          eq(agentSandboxes.agentId, row.agentId)
        )
      );
  }
  return idle.length;
}
