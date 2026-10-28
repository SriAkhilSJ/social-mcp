import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  agentArtifacts,
  agentCommunications,
  agentOutputs,
  agentPlans,
  agentTasks,
} from "@/db/schema";
import { getRequestScope } from "@/lib/request-scope";
import { executePlanInBackground } from "@/lib/orchestration";

export async function GET(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const agentFilter = url.searchParams.get("agent");

  const db = await getDb();
  const plans = await db
    .select()
    .from(agentPlans)
    .where(eq(agentPlans.campaignId, scope.campaignId))
    .orderBy(desc(agentPlans.id))
    .limit(20);

  const tasks = await db
    .select()
    .from(agentTasks)
    .where(
      agentFilter && agentFilter !== "master"
        ? and(
            eq(agentTasks.campaignId, scope.campaignId),
            eq(agentTasks.agentId, agentFilter)
          )
        : eq(agentTasks.campaignId, scope.campaignId)
    )
    .orderBy(desc(agentTasks.planId), asc(agentTasks.position));

  const communications = await db
    .select()
    .from(agentCommunications)
    .where(eq(agentCommunications.campaignId, scope.campaignId))
    .orderBy(desc(agentCommunications.id))
    .limit(50);

  const artifacts = await db
    .select()
    .from(agentArtifacts)
    .where(eq(agentArtifacts.campaignId, scope.campaignId))
    .orderBy(desc(agentArtifacts.id))
    .limit(40);

  const outputs = await db
    .select()
    .from(agentOutputs)
    .where(eq(agentOutputs.campaignId, scope.campaignId))
    .orderBy(desc(agentOutputs.id))
    .limit(30);

  return NextResponse.json(
    { plans, tasks, communications, artifacts, outputs },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    action: "cancel-plan" | "retry-task" | "resume";
    planId?: number;
    taskId?: number;
  };
  const db = await getDb();

  if (body.action === "cancel-plan" && body.planId) {
    await db
      .update(agentPlans)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(agentPlans.id, body.planId),
          eq(agentPlans.campaignId, scope.campaignId)
        )
      );
    await db
      .update(agentTasks)
      .set({ status: "cancelled", currentStep: null, updatedAt: new Date() })
      .where(
        and(
          eq(agentTasks.planId, body.planId),
          eq(agentTasks.campaignId, scope.campaignId)
        )
      );
    return NextResponse.json({ ok: true });
  }

  if ((body.action === "retry-task" || body.action === "resume") && body.taskId) {
    const [task] = await db
      .select()
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.id, body.taskId),
          eq(agentTasks.campaignId, scope.campaignId)
        )
      )
      .limit(1);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    await db
      .update(agentTasks)
      .set({
        status: "queued",
        error: null,
        interruption: null,
        queueSeq: (task.queueSeq || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(agentTasks.id, task.id));
    await db
      .update(agentPlans)
      .set({ status: "in_progress", error: null, updatedAt: new Date() })
      .where(eq(agentPlans.id, task.planId));

    void executePlanInBackground(task.planId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid task action" }, { status: 400 });
}
