import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  agentPlans,
  agentSandboxes,
  agentTasks,
  campaignMemories,
  campaignProfiles,
  campaigns,
  users,
} from "@/db/schema";
import {
  createSessionCookie,
  getCurrentUser,
  getOrBootstrapWorkspaceUser,
} from "@/lib/auth";
import { getRequestScope } from "@/lib/request-scope";

export async function GET() {
  const scope = await getRequestScope();
  if (!scope) {
    const user = await getCurrentUser();
    return NextResponse.json({
      authenticated: Boolean(user),
      campaigns: [],
      activeCampaign: null,
      profile: null,
      memories: [],
    });
  }

  const db = await getDb();
  const [profile] = await db
    .select()
    .from(campaignProfiles)
    .where(eq(campaignProfiles.campaignId, scope.campaignId))
    .limit(1);

  const memories = await db
    .select()
    .from(campaignMemories)
    .where(eq(campaignMemories.campaignId, scope.campaignId))
    .orderBy(desc(campaignMemories.pinned), desc(campaignMemories.id));

  return NextResponse.json({
    authenticated: true,
    campaigns: scope.campaigns,
    activeCampaign: scope.campaign,
    profile: profile || null,
    memories,
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "create");

  const user =
    action === "create"
      ? await getOrBootstrapWorkspaceUser()
      : await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();

  if (action === "create") {
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    }
    const icon = body.icon ? String(body.icon) : "rocket";
    const iconUrl = body.iconUrl ? String(body.iconUrl) : null;
    const officeImage =
      body.officeImage === "modern-office" ? "modern-office" : "wooden-office";

    const [created] = await db
      .insert(campaigns)
      .values({
        userId: user.id,
        name,
        icon,
        iconUrl,
        officeImage,
      })
      .returning();

    await db.insert(campaignProfiles).values({
      campaignId: created.id,
      userId: user.id,
      brandName: name,
      timeZone: String(body.timeZone || "UTC"),
    });

    await db
      .update(users)
      .set({ activeCampaignId: created.id, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    const token = await createSessionCookie(user.id);
    return NextResponse.json({ ok: true, token, campaign: created });
  }

  if (action === "switch") {
    const campaignId = Number(body.campaignId);
    const [target] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)))
      .limit(1);
    if (!target) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    await db
      .update(users)
      .set({ activeCampaignId: target.id, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return NextResponse.json({ ok: true, campaign: target });
  }

  if (action === "end") {
    const campaignId = Number(body.campaignId);
    await db
      .update(campaigns)
      .set({ endedAt: new Date() })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)));
    await db
      .update(agentPlans)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(eq(agentPlans.campaignId, campaignId), eq(agentPlans.status, "in_progress"))
      );
    await db
      .update(agentTasks)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(eq(agentTasks.campaignId, campaignId), eq(agentTasks.status, "in_progress"))
      );
    await db
      .update(agentSandboxes)
      .set({ status: "killed", control: "agent" })
      .where(eq(agentSandboxes.campaignId, campaignId));

    return NextResponse.json({ ok: true });
  }

  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "No active campaign" }, { status: 400 });
  }

  if (action === "update-campaign") {
    const name = String(body.name || scope.campaign.name).trim();
    const officeImage =
      body.officeImage === "modern-office" ? "modern-office" : "wooden-office";
    const [updated] = await db
      .update(campaigns)
      .set({
        name,
        officeImage,
        icon: body.icon ? String(body.icon) : scope.campaign.icon,
      })
      .where(eq(campaigns.id, scope.campaignId))
      .returning();
    return NextResponse.json({ ok: true, campaign: updated });
  }

  if (action === "update-brief") {
    const values = {
      campaignId: scope.campaignId,
      userId: user.id,
      brandName: String(body.brandName ?? scope.campaign.name),
      description: String(body.description ?? ""),
      voice: String(body.voice ?? "Friendly, authentic, and engaging"),
      audience: String(body.audience ?? ""),
      goals: String(body.goals ?? ""),
      platforms: Array.isArray(body.platforms)
        ? body.platforms.map(String)
        : ["instagram", "tiktok", "youtube"],
      timeZone: String(body.timeZone || "UTC"),
      publishMethod: String(body.publishMethod || "blotato"),
      requiresApproval: Boolean(body.requiresApproval),
      dos: Array.isArray(body.dos) ? body.dos.map(String) : [],
      donts: Array.isArray(body.donts) ? body.donts.map(String) : [],
      updatedAt: new Date(),
    };

    await db
      .insert(campaignProfiles)
      .values(values)
      .onConflictDoUpdate({
        target: campaignProfiles.campaignId,
        set: values,
      });

    return NextResponse.json({ ok: true });
  }

  if (action === "add-memory") {
    const content = String(body.content || "").trim().slice(0, 480);
    if (!content) {
      return NextResponse.json({ error: "Memory text is required" }, { status: 400 });
    }
    const kind = ["fact", "decision", "preference", "learning"].includes(String(body.kind))
      ? String(body.kind)
      : "preference";
    const [mem] = await db
      .insert(campaignMemories)
      .values({
        userId: user.id,
        campaignId: scope.campaignId,
        agentId: "user",
        kind,
        content,
        pinned: Boolean(body.pinned),
      })
      .returning();
    return NextResponse.json({ ok: true, memory: mem });
  }

  if (action === "toggle-pin-memory") {
    const id = Number(body.id);
    const [existing] = await db
      .select()
      .from(campaignMemories)
      .where(and(eq(campaignMemories.id, id), eq(campaignMemories.userId, user.id)))
      .limit(1);
    if (existing) {
      await db
        .update(campaignMemories)
        .set({ pinned: !existing.pinned })
        .where(eq(campaignMemories.id, id));
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "delete-memory") {
    const id = Number(body.id);
    await db
      .delete(campaignMemories)
      .where(and(eq(campaignMemories.id, id), eq(campaignMemories.userId, user.id)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported campaign action" }, { status: 400 });
}
