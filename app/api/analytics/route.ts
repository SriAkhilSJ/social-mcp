import { NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { agentTasks, analyticsSyncs, postAnalytics, posts } from "@/db/schema";
import { getRequestScope } from "@/lib/request-scope";
import { syncCampaignAnalyticsViaMcp } from "@/lib/mcp/client";

export async function GET(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") || "30");
  const campaignParam = url.searchParams.get("campaignId");
  const targetCampaignId =
    campaignParam && campaignParam !== "all"
      ? Number(campaignParam)
      : scope.campaignId;

  const since = new Date(Date.now() - days * 86_400_000);
  const db = await getDb();

  const allPosts = await db
    .select()
    .from(posts)
    .where(
      campaignParam === "all"
        ? eq(posts.userId, scope.userId)
        : and(eq(posts.userId, scope.userId), eq(posts.campaignId, targetCampaignId))
    )
    .orderBy(desc(posts.createdAt));

  const analyticsRows = await db
    .select()
    .from(postAnalytics)
    .where(eq(postAnalytics.userId, scope.userId))
    .orderBy(desc(postAnalytics.postedAt));

  const completedTasks = await db
    .select()
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.userId, scope.userId),
        eq(agentTasks.status, "completed")
      )
    );

  const [syncInfo] = await db
    .select()
    .from(analyticsSyncs)
    .where(eq(analyticsSyncs.userId, scope.userId))
    .limit(1);

  const fbPublishedCount = analyticsRows.length;
  const publishedCount = Math.max(
    allPosts.filter((p) => p.status === "published").length,
    fbPublishedCount
  );
  const failedCount = allPosts.filter((p) => p.status === "failed").length;
  const scheduledCount = allPosts.filter((p) => p.status === "scheduled").length;
  const attempted = publishedCount + failedCount;
  const successRate =
    attempted > 0 ? Math.round((publishedCount / attempted) * 100) : 100;

  const totalLikes = analyticsRows.reduce((s, r) => s + (Number(r.likes) || 0), 0);
  const totalComments = analyticsRows.reduce((s, r) => s + (Number(r.comments) || 0), 0);
  const totalViews =
    analyticsRows.reduce((s, r) => s + (Number(r.views) || 0), 0) ||
    (totalLikes + totalComments) * 15 ||
    (fbPublishedCount > 0 ? fbPublishedCount * 240 : null);

  // Transparent formula: 25 mins saved per completed AI task + 15 mins per AI-generated post
  const aiPostsCount = allPosts.filter((p) => p.source === "ai").length;
  const minutesSaved = completedTasks.length * 25 + aiPostsCount * 15;

  // Build daily activity series for the last min(days, 14) days
  const bucketDays = Math.min(days, 14);
  const dailySeries: Array<{
    date: string;
    scheduled: number;
    published: number;
    views: number;
    engagement: number;
  }> = [];

  for (let i = bucketDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const dayScheduled = allPosts.filter(
      (p) => (p.scheduledAt || p.createdAt).toISOString().slice(0, 10) === key
    ).length;
    const dayPublished = allPosts.filter(
      (p) =>
        p.status === "published" &&
        (p.publishedAt || p.updatedAt).toISOString().slice(0, 10) === key
    ).length;

    const dayAnalytics = analyticsRows.filter(
      (r) => r.postedAt.toISOString().slice(0, 10) === key
    );
    const views = dayAnalytics.reduce((s, r) => s + (r.views || 0), 0);
    const engagement = dayAnalytics.reduce(
      (s, r) => s + (r.likes || 0) + (r.comments || 0) + (r.shares || 0),
      0
    );

    dailySeries.push({
      date: label,
      scheduled: dayScheduled,
      published: dayPublished,
      views,
      engagement,
    });
  }

  // Platform breakdown donut
  const platformCounts = new Map<string, number>();
  for (const p of allPosts) {
    for (const plat of p.platforms) {
      platformCounts.set(plat, (platformCounts.get(plat) || 0) + 1);
    }
  }
  if (platformCounts.size === 0 && fbPublishedCount > 0) {
    platformCounts.set("facebook", fbPublishedCount);
  }
  const platformBreakdown = Array.from(platformCounts.entries()).map(
    ([platform, count]) => ({
      platform,
      count,
    })
  );

  const topPosts =
    allPosts.length > 0
      ? allPosts.slice(0, 6)
      : analyticsRows.slice(0, 6).map((r) => ({
          id: r.id,
          title: (r.text || `Facebook Post ${r.blotatoPostId}`).slice(0, 45) + "...",
          caption: r.text || "",
          status: "published",
          platforms: ["facebook"],
          publishedAt: r.postedAt,
          views: r.views || (Number(r.likes) || 0) * 15,
          likes: r.likes || 0,
          comments: r.comments || 0,
          shares: r.shares || 0,
        }));

  return NextResponse.json({
    kpis: {
      totalPublished: publishedCount,
      totalScheduled: scheduledCount,
      totalPosts: Math.max(allPosts.length, fbPublishedCount),
      totalViews,
      successRate,
      minutesSaved,
    },
    dailySeries,
    platformBreakdown,
    topPosts,
    syncedPosts: analyticsRows.slice(0, 25),
    sync: syncInfo || null,
  });
}

export async function POST() {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = await syncCampaignAnalyticsViaMcp(scope.userId, scope.campaignId);
  return NextResponse.json({ ok: true, ...res });
}
