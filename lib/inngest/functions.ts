import "server-only";
import { and, eq, lte } from "drizzle-orm";
import { inngest } from "./client";
import { getDb } from "@/db";
import { agentSandboxes, agentTasks, posts } from "@/db/schema";
import { executePlanInBackground } from "@/lib/orchestration";
import { pauseIdleSandboxes } from "@/lib/sandbox";
import { dispatchPostViaMcp } from "@/lib/mcp/client";

// Chapter 9: Every 15 minutes find pending tasks due soon, atomically queue them & execute
export const scheduleDueTasksFn = inngest.createFunction(
  { id: "schedule-due-tasks", triggers: [{ cron: "*/15 * * * *" }] },
  async ({ step }) => {
    const duePlans = await step.run("queue-due-tasks", async () => {
      const db = await getDb();
      const horizon = new Date(Date.now() + 15 * 60_000);
      const due = await db
        .select()
        .from(agentTasks)
        .where(and(eq(agentTasks.status, "pending"), lte(agentTasks.scheduledAt, horizon)));

      const planIds = new Set<number>();
      for (const t of due) {
        await db
          .update(agentTasks)
          .set({
            status: "queued",
            queueSeq: (t.queueSeq || 0) + 1,
            updatedAt: new Date(),
          })
          .where(and(eq(agentTasks.id, t.id), eq(agentTasks.status, "pending")));
        planIds.add(t.planId);
      }
      return Array.from(planIds);
    });

    for (const planId of duePlans) {
      await step.sendEvent(`dispatch-plan-${planId}`, {
        name: "task/execute",
        data: { planId },
      });
    }

    return { queuedPlans: duePlans.length };
  }
);

// Chapter 9 & 10: Execute queued agent plan tasks with concurrency limit 50
export const executeAgentTaskFn = inngest.createFunction(
  {
    id: "execute-agent-task",
    concurrency: [{ limit: 50 }],
    retries: 2,
    triggers: [{ event: "task/execute" }],
  },
  async ({ event, step }) => {
    const planId = Number(event.data?.planId);
    if (!planId) return { skipped: true };

    await step.run("run-agent-pipeline", async () => {
      await executePlanInBackground(planId);
    });

    return { ok: true, planId };
  }
);

// Chapter 13: Publish due scheduled posts via Blotato / OpenPost MCP
export const publishDuePostsFn = inngest.createFunction(
  { id: "publish-scheduled-posts", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    return step.run("publish-due", async () => {
      const db = await getDb();
      const duePosts = await db
        .select()
        .from(posts)
        .where(and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, new Date())));

      let count = 0;
      for (const p of duePosts) {
        await dispatchPostViaMcp({
          userId: p.userId,
          postId: p.id,
          publishNow: true,
        });
        count++;
      }
      return { publishedCount: count };
    });
  }
);

// Chapter 10: Pause idle E2B cloud desktops (> 3 min idle)
export const pauseIdleSandboxesFn = inngest.createFunction(
  { id: "pause-idle-sandboxes", triggers: [{ cron: "* * * * *" }] },
  async ({ step }) => {
    const paused = await step.run("pause-idle", async () => {
      return pauseIdleSandboxes();
    });
    return { paused };
  }
);

// Chapter 10: Clean up campaign sandboxes when campaign ends
export const endCampaignFn = inngest.createFunction(
  { id: "end-campaign", triggers: [{ event: "campaign/ended" }] },
  async ({ event, step }) => {
    const campaignId = Number(event.data?.campaignId);
    if (!campaignId) return { skipped: true };
    await step.run("kill-sandboxes", async () => {
      const db = await getDb();
      await db
        .update(agentSandboxes)
        .set({ status: "killed", control: "agent" })
        .where(eq(agentSandboxes.campaignId, campaignId));
    });
    return { endedCampaignId: campaignId };
  }
);

export const inngestFunctions = [
  scheduleDueTasksFn,
  executeAgentTaskFn,
  publishDuePostsFn,
  pauseIdleSandboxesFn,
  endCampaignFn,
];
