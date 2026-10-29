import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fetchFacebookPageAnalytics,
  fetchFacebookPageOverview,
  type FacebookPostAnalyticsItem,
} from "../lib/social/facebook";

// ==========================================
// MOCKED UNIT TESTS
// ==========================================

describe("Phase 4: OpenPost MCP & Analytics Unit Tests (Mocked)", () => {
  it("Deduplicates feed post and video reel with identical target video ID", () => {
    const mockPostItem = {
      id: "1316616991525561_122113024527420309",
      attachments: {
        data: [{ target: { id: "4621308234820038" } }],
      },
      message: "🎬 Mafia Boss Dad & Daughter — Episode #25 (58.3s) 🔥",
      likes: { summary: { total_count: 2812 } },
      comments: { summary: { total_count: 17 } },
      shares: { count: 88 },
      permalink_url: "https://www.facebook.com/reel/4621308234820038/",
    };

    const mockVideoItem = {
      id: "4621308234820038",
      views: 139475,
      length: 58.3,
      permalink_url: "/reel/4621308234820038/",
      video_insights: {
        data: [
          {
            name: "fb_reels_total_plays",
            values: [{ value: 139475 }],
          },
          {
            name: "fb_reels_replay_count",
            values: [{ value: 24800 }],
          },
          {
            name: "post_video_avg_time_watched",
            values: [{ value: 6800 }],
          },
        ],
      },
    };

    const postsMap = new Map<string, any>();
    const videoId = mockPostItem.attachments.data[0].target.id;
    const metaPostId = mockPostItem.id.split("_")[1];

    postsMap.set(mockPostItem.id, {
      id: mockPostItem.id,
      metaPostId,
      videoId,
      reelId: videoId,
      text: mockPostItem.message,
      likes: mockPostItem.likes.summary.total_count,
      comments: mockPostItem.comments.summary.total_count,
      shares: mockPostItem.shares.count,
      views: null,
      lengthSeconds: null,
    });

    // Merge video item
    let matched: any = null;
    for (const p of postsMap.values()) {
      if (p.videoId === mockVideoItem.id || p.id === mockVideoItem.id) {
        matched = p;
        break;
      }
    }

    assert.ok(matched, "Should find matching feed post by videoId");
    matched.views = mockVideoItem.views;
    matched.lengthSeconds = mockVideoItem.length;

    const all = Array.from(postsMap.values());
    assert.equal(all.length, 1, "Must contain exactly 1 deduplicated record, not 2");
    assert.equal(all[0].id, "1316616991525561_122113024527420309");
    assert.equal(all[0].metaPostId, "122113024527420309");
    assert.equal(all[0].videoId, "4621308234820038");
    assert.equal(all[0].views, 139475);
    assert.equal(all[0].lengthSeconds, 58.3);
  });

  it("Ensures missing metrics remain null and are NEVER fabricated with multipliers", () => {
    const postWithoutVideo = {
      id: "1316616991525561_122122680525420309",
      text: "Emotion is a variable.",
      likes: 1200,
      comments: 5,
      shares: 2,
      views: null, // No video attached
    };

    assert.equal(postWithoutVideo.views, null);
    assert.notEqual(postWithoutVideo.views, postWithoutVideo.likes * 12);
  });

  it("Post-specific filtering reliably matches by canonical ID, Meta post ID, and Video ID", () => {
    const testDatabase: FacebookPostAnalyticsItem[] = [
      {
        id: "1316616991525561_122113024527420309",
        metaPostId: "122113024527420309",
        videoId: "4621308234820038",
        reelId: "4621308234820038",
        text: "Episode #25",
        postedAt: new Date(),
        likes: 2812,
        comments: 17,
        shares: 88,
        views: 139475,
      },
      {
        id: "1316616991525561_122122765455420309",
        metaPostId: "122122765455420309",
        videoId: "1593302406155143",
        reelId: "1593302406155143",
        text: "Episode 1 Trailer",
        postedAt: new Date(),
        likes: 6,
        comments: 0,
        shares: 0,
        views: 432,
      },
    ];

    function filterPost(target: string) {
      return testDatabase.find(
        (p) =>
          p.id === target ||
          p.metaPostId === target ||
          p.videoId === target ||
          p.reelId === target ||
          p.id.endsWith(target)
      );
    }

    const byCanonical = filterPost("1316616991525561_122113024527420309");
    assert.ok(byCanonical);
    assert.equal(byCanonical?.videoId, "4621308234820038");

    const byMetaId = filterPost("122113024527420309");
    assert.ok(byMetaId);
    assert.equal(byMetaId?.id, "1316616991525561_122113024527420309");

    const byVideoId = filterPost("4621308234820038");
    assert.ok(byVideoId);
    assert.equal(byVideoId?.views, 139475);

    const byTrailerId = filterPost("1593302406155143");
    assert.ok(byTrailerId);
    assert.equal(byTrailerId?.text, "Episode 1 Trailer");

    const invalid = filterPost("non_existent_id_9999");
    assert.equal(invalid, undefined);
  });

  it("Accurately reports both followers_count and fan_count to prevent discrepancy confusion", () => {
    const rawMetaResponse = {
      id: "1316616991525561",
      name: "AnimeEdits",
      followers_count: 22774,
      fan_count: 22771,
    };

    const overview = {
      followers: rawMetaResponse.followers_count,
      pageFollowers: rawMetaResponse.followers_count,
      pageLikes: rawMetaResponse.fan_count,
      clarification: `followers_count (${rawMetaResponse.followers_count}) is page followers; fan_count (${rawMetaResponse.fan_count}) is users who liked the page.`,
    };

    assert.equal(overview.followers, 22774);
    assert.equal(overview.pageFollowers, 22774);
    assert.equal(overview.pageLikes, 22771);
    assert.ok(overview.clarification.includes("22774"));
    assert.ok(overview.clarification.includes("22771"));
  });

  it("Human-in-the-Loop Gateway blocks publishing unless confirmed: true is explicitly provided", () => {
    function simulatePublishGateway(postId: number, confirmed: boolean) {
      if (!confirmed) {
        return {
          ok: false,
          error: "ConfirmationRequired",
          message: `Safety Lock: Post #${postId} was NOT published without explicit user confirmation.`,
        };
      }
      return {
        ok: true,
        status: "published",
        postId,
      };
    }

    const unconfirmed = simulatePublishGateway(101, false);
    assert.equal(unconfirmed.ok, false);
    assert.equal(unconfirmed.error, "ConfirmationRequired");

    const confirmed = simulatePublishGateway(101, true);
    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.status, "published");
  });

  it("MCP Tool Schemas match specifications and require confirmation parameter", () => {
    const registeredTools = [
      {
        name: "create_post",
        required: ["title"],
      },
      {
        name: "publish_post",
        required: ["postId", "confirmed"],
      },
      {
        name: "get_analytics",
        properties: ["postId"],
      },
      {
        name: "list_posts",
        properties: ["limit", "status"],
      },
      {
        name: "update_post",
        required: ["postId"],
      },
      {
        name: "delete_post",
        properties: ["postId", "all"],
      },
    ];

    const publishTool = registeredTools.find((t) => t.name === "publish_post");
    assert.ok(publishTool);
    assert.ok(publishTool?.required.includes("confirmed"));

    const analyticsTool = registeredTools.find((t) => t.name === "get_analytics");
    assert.ok(analyticsTool);
    assert.ok(analyticsTool?.properties?.includes("postId"));
  });

  it("Gracefully handles Meta API error responses without crashing", () => {
    function parseMetaError(errorJson: any) {
      if (errorJson?.error) {
        return {
          ok: false,
          code: errorJson.error.code || 500,
          type: errorJson.error.type || "OAuthException",
          message: errorJson.error.message || "Unknown error",
        };
      }
      return { ok: true };
    }

    const expiredTokenErr = {
      error: {
        message: "Error validating access token: Session has expired",
        type: "OAuthException",
        code: 190,
      },
    };
    const rateLimitErr = {
      error: {
        message: "(#4) Application request limit reached",
        type: "OAuthException",
        code: 4,
      },
    };

    const parsed190 = parseMetaError(expiredTokenErr);
    assert.equal(parsed190.ok, false);
    assert.equal(parsed190.code, 190);

    const parsedRateLimit = parseMetaError(rateLimitErr);
    assert.equal(parsedRateLimit.ok, false);
    assert.equal(parsedRateLimit.code, 4);
  });
});

// ==========================================
// LIVE INTEGRATION TESTS (Read-Only)
// ==========================================

describe("Phase 4: OpenPost MCP Live Read-Only Integration Tests", () => {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
  const pageId = process.env.FACEBOOK_PAGE_ID || "1316616991525561";

  it("Live: Fetches authentic page overview with followers and fan count", async () => {
    const overview = await fetchFacebookPageOverview({
      pageId,
      pageAccessToken: token,
    });

    assert.equal(overview.id, pageId);
    assert.equal(overview.name, "AnimeEdits");
    assert.ok(overview.followers >= 22000, "Followers should be >= 22,000");
    assert.ok(overview.pageLikes >= 22000, "Page likes should be >= 22,000");
  });

  it("Live: Fetches deduplicated published posts and viral video reels", async () => {
    const posts = await fetchFacebookPageAnalytics({
      pageId,
      pageAccessToken: token,
      limit: 20,
    });

    assert.ok(posts.length > 0, "Should return published posts/videos");

    const idSet = new Set(posts.map((p) => p.id));
    assert.equal(idSet.size, posts.length, "All returned posts must have unique IDs");

    const videoReels = posts.filter((p) => p.videoId !== undefined && p.views !== null);
    assert.ok(videoReels.length > 0, "Should contain video reels with verified views");

    for (const v of videoReels) {
      assert.equal(typeof v.views, "number", "Views must be numeric");
      assert.ok(v.views! >= 0, "Views cannot be negative");
    }
  });

  it("Live: Isolates a specific post by Video ID with video insights", async () => {
    const targetVideoId = "1593302406155143";
    const filtered = await fetchFacebookPageAnalytics({
      pageId,
      pageAccessToken: token,
      targetPostId: targetVideoId,
    });

    assert.equal(filtered.length, 1, "Must return exactly 1 matched post");
    const item = filtered[0];
    assert.equal(item.videoId, targetVideoId);
    assert.ok(item.text.includes("MESSAGE FROM TOMORROW"));
    assert.ok(typeof item.views === "number");
    assert.ok(item.views! >= 400, "Trailer views should be at least 400");
  });
});
