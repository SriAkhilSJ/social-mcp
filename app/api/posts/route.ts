import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { posts, type PostMediaItem } from "@/db/schema";
import { getRequestScope } from "@/lib/request-scope";
import { dispatchPostViaMcp } from "@/lib/mcp/client";

export async function GET(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");
  const postIdParam = url.searchParams.get("id");

  const db = await getDb();

  if (postIdParam) {
    const [single] = await db
      .select()
      .from(posts)
      .where(
        and(eq(posts.id, Number(postIdParam)), eq(posts.userId, scope.userId))
      )
      .limit(1);
    return NextResponse.json({ post: single || null });
  }

  const rows = await db
    .select()
    .from(posts)
    .where(
      statusFilter && statusFilter !== "all"
        ? and(
            eq(posts.campaignId, scope.campaignId),
            eq(posts.status, statusFilter)
          )
        : eq(posts.campaignId, scope.campaignId)
    )
    .orderBy(desc(posts.scheduledAt), desc(posts.id));

  return NextResponse.json({ posts: rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "create");

  if (action === "create" || action === "update") {
    const title = String(body.title || "").trim() || "Untitled Social Post";
    const caption = String(body.caption || "");
    const hashtags = Array.isArray(body.hashtags)
      ? body.hashtags.map((h) => String(h).replace(/^#/, "").trim()).filter(Boolean)
      : [];
    const platforms =
      Array.isArray(body.platforms) && body.platforms.length > 0
        ? body.platforms.map(String)
        : ["instagram"];
    const media = (Array.isArray(body.media) ? body.media : []) as PostMediaItem[];
    const status = body.status === "draft" ? "draft" : "scheduled";
    const scheduledAt = body.scheduledAt
      ? new Date(String(body.scheduledAt))
      : status === "scheduled"
      ? new Date(Date.now() + 3600_000)
      : null;
    const timeZone = String(body.timeZone || "UTC");

    if (action === "update" && body.id) {
      const id = Number(body.id);
      const [updated] = await db
        .update(posts)
        .set({
          title,
          caption,
          hashtags,
          platforms,
          media,
          status,
          scheduledAt,
          timeZone,
          updatedAt: new Date(),
        })
        .where(and(eq(posts.id, id), eq(posts.userId, scope.userId)))
        .returning();

      if (updated && status === "scheduled") {
        await dispatchPostViaMcp({
          userId: scope.userId,
          postId: updated.id,
          publishNow: false,
        });
      }
      return NextResponse.json({ ok: true, post: updated });
    }

    const [created] = await db
      .insert(posts)
      .values({
        userId: scope.userId,
        campaignId: scope.campaignId,
        source: body.source === "ai" ? "ai" : "manual",
        title,
        caption,
        hashtags,
        platforms,
        media,
        status,
        scheduledAt,
        timeZone,
      })
      .returning();

    if (status === "scheduled") {
      await dispatchPostViaMcp({
        userId: scope.userId,
        postId: created.id,
        publishNow: Boolean(body.publishNow),
      });
    }

    return NextResponse.json({ ok: true, post: created });
  }

  if (action === "reschedule" && body.id && body.scheduledAt) {
    const id = Number(body.id);
    const nextDate = new Date(String(body.scheduledAt));
    const [updated] = await db
      .update(posts)
      .set({
        scheduledAt: nextDate,
        status: "scheduled",
        updatedAt: new Date(),
      })
      .where(and(eq(posts.id, id), eq(posts.userId, scope.userId)))
      .returning();

    if (updated) {
      await dispatchPostViaMcp({
        userId: scope.userId,
        postId: updated.id,
        publishNow: false,
      });
    }
    return NextResponse.json({ ok: true, post: updated });
  }

  if (action === "publish-now" && body.id) {
    const id = Number(body.id);
    await dispatchPostViaMcp({
      userId: scope.userId,
      postId: id,
      publishNow: true,
    });
    const [updated] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return NextResponse.json({ ok: true, post: updated });
  }

  if (action === "unschedule" && body.id) {
    const id = Number(body.id);
    const [updated] = await db
      .update(posts)
      .set({ status: "draft", updatedAt: new Date() })
      .where(and(eq(posts.id, id), eq(posts.userId, scope.userId)))
      .returning();
    return NextResponse.json({ ok: true, post: updated });
  }

  if (action === "duplicate" && body.id) {
    const id = Number(body.id);
    const [orig] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, id), eq(posts.userId, scope.userId)))
      .limit(1);
    if (!orig) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    const [copy] = await db
      .insert(posts)
      .values({
        userId: scope.userId,
        campaignId: orig.campaignId,
        source: orig.source,
        title: `${orig.title} (Copy)`,
        caption: orig.caption,
        hashtags: orig.hashtags,
        platforms: orig.platforms,
        media: orig.media,
        status: "draft",
        timeZone: orig.timeZone,
      })
      .returning();
    return NextResponse.json({ ok: true, post: copy });
  }

  if (action === "delete" && body.id) {
    const id = Number(body.id);
    await db
      .delete(posts)
      .where(and(eq(posts.id, id), eq(posts.userId, scope.userId)));
    return NextResponse.json({ ok: true });
  }

  if (action === "delete-all") {
    await db
      .delete(posts)
      .where(eq(posts.campaignId, scope.campaignId));
    return NextResponse.json({ ok: true, message: "All posts cleared from campaign" });
  }

  return NextResponse.json({ error: "Invalid post action" }, { status: 400 });
}
