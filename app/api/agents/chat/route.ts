import { NextResponse } from "next/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { agentMessages, agentSettings } from "@/db/schema";
import { getRequestScope } from "@/lib/request-scope";
import { ALL_AGENT_IDS, type AgentRoleId } from "@/lib/agent-roles";
import { runAgentSdkChat } from "@/lib/ai/engine";
import { handleMasterChatAndPlan } from "@/lib/orchestration";

export async function GET(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const agentId = (url.searchParams.get("agent") || url.searchParams.get("agentId") || "master") as AgentRoleId;
  if (!ALL_AGENT_IDS.includes(agentId)) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
  }
  const beforeId = url.searchParams.get("beforeId");
  const limit = 10;

  const db = await getDb();
  const conditions = [
    eq(agentMessages.userId, scope.userId),
    eq(agentMessages.campaignId, scope.campaignId),
    eq(agentMessages.agentId, agentId),
  ];
  if (beforeId) {
    conditions.push(lt(agentMessages.id, Number(beforeId)));
  }

  const rows = await db
    .select()
    .from(agentMessages)
    .where(and(...conditions))
    .orderBy(desc(agentMessages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse();

  const [settingsRow] = await db
    .select()
    .from(agentSettings)
    .where(
      and(
        eq(agentSettings.campaignId, scope.campaignId),
        eq(agentSettings.agentId, agentId)
      )
    )
    .limit(1);

  return NextResponse.json({
    messages,
    hasMore,
    customInstructions: settingsRow?.customInstructions || "",
    enabled: settingsRow?.enabled ?? true,
  });
}

export async function POST(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    action?: "chat" | "save-settings" | "clear" | "delete-message" | "post-agent-message";
    agentId?: string;
    message?: string;
    messageId?: number;
    customInstructions?: string;
    enabled?: boolean;
  };

  const agentId = (body.agentId || "master") as AgentRoleId;
  if (!ALL_AGENT_IDS.includes(agentId)) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
  }

  const db = await getDb();

  if (body.action === "save-settings") {
    await db
      .insert(agentSettings)
      .values({
        campaignId: scope.campaignId,
        agentId,
        userId: scope.userId,
        customInstructions: String(body.customInstructions || ""),
        enabled: body.enabled ?? true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [agentSettings.campaignId, agentSettings.agentId],
        set: {
          customInstructions: String(body.customInstructions || ""),
          enabled: body.enabled ?? true,
          updatedAt: new Date(),
        },
      });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete-message") {
    const msgId = Number(body.messageId);
    if (!msgId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }
    await db
      .delete(agentMessages)
      .where(
        and(
          eq(agentMessages.id, msgId),
          eq(agentMessages.userId, scope.userId)
        )
      );
    return NextResponse.json({ ok: true, deletedId: msgId });
  }

  if (body.action === "clear") {
    await db
      .delete(agentMessages)
      .where(
        and(
          eq(agentMessages.userId, scope.userId),
          eq(agentMessages.campaignId, scope.campaignId),
          eq(agentMessages.agentId, agentId)
        )
      );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "post-agent-message") {
    const text = String(body.message || "").trim();
    if (!text) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }
    const [msg] = await db
      .insert(agentMessages)
      .values({
        userId: scope.userId,
        campaignId: scope.campaignId,
        agentId,
        sender: "agent",
        text,
      })
      .returning();
    return NextResponse.json({ ok: true, message: msg });
  }

  const userText = String(body.message || "").trim();
  if (!userText) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }

  const [savedUserMsg] = await db
    .insert(agentMessages)
    .values({
      userId: scope.userId,
      campaignId: scope.campaignId,
      agentId,
      sender: "user",
      text: userText,
    })
    .returning();

  if (agentId === "master") {
    const result = await handleMasterChatAndPlan({
      userId: scope.userId,
      campaignId: scope.campaignId,
      campaignName: scope.campaign.name,
      userMessage: userText,
    });
    return NextResponse.json({
      ok: true,
      userMessage: savedUserMsg,
      reply: result.replyText,
      planId: result.planId,
    });
  }

  const recentRows = await db
    .select()
    .from(agentMessages)
    .where(
      and(
        eq(agentMessages.userId, scope.userId),
        eq(agentMessages.campaignId, scope.campaignId),
        eq(agentMessages.agentId, agentId)
      )
    )
    .orderBy(desc(agentMessages.id))
    .limit(10);

  const replyText = await runAgentSdkChat({
    userId: scope.userId,
    campaignId: scope.campaignId,
    agentId,
    history: recentRows.reverse().map((m) => ({ sender: m.sender, text: m.text })),
    userMessage: userText,
  });

  await db.insert(agentMessages).values({
    userId: scope.userId,
    campaignId: scope.campaignId,
    agentId,
    sender: "agent",
    text: replyText,
  });

  return NextResponse.json({
    ok: true,
    userMessage: savedUserMsg,
    reply: replyText,
  });
}
