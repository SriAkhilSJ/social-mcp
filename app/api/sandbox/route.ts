import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentSandboxes } from "@/db/schema";
import { getRequestScope } from "@/lib/request-scope";
import { hasComputer } from "@/lib/agent-roles";
import { getSandboxViews, setSandboxAction } from "@/lib/sandbox";

export const maxDuration = 120;

export async function GET(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const agent = url.searchParams.get("agent") || "research";
  if (!hasComputer(agent)) {
    return NextResponse.json({ error: "Agent does not use a computer" }, { status: 400 });
  }

  const db = await getDb();
  const [row] = await db
    .select()
    .from(agentSandboxes)
    .where(
      and(
        eq(agentSandboxes.campaignId, scope.campaignId),
        eq(agentSandboxes.agentId, agent)
      )
    )
    .limit(1);

  const views = await getSandboxViews(scope.campaignId);
  const view = views.find((v) => v.agentId === agent);

  return NextResponse.json({
    sandbox: view,
    streamUrl: row?.streamKey?.startsWith("http") ? row.streamKey : null,
  });
}

export async function POST(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (scope.campaign.endedAt) {
    return NextResponse.json({ error: "Campaign has ended" }, { status: 409 });
  }

  const body = (await req.json()) as {
    action: "start" | "pause" | "take-over" | "hand-back" | "heartbeat";
    agentId: string;
  };

  if (!hasComputer(body.agentId)) {
    return NextResponse.json({ error: "Agent has no computer" }, { status: 400 });
  }

  await setSandboxAction({
    userId: scope.userId,
    campaignId: scope.campaignId,
    agentId: body.agentId,
    action: body.action,
  });

  const views = await getSandboxViews(scope.campaignId);
  return NextResponse.json({ ok: true, sandboxes: views });
}
