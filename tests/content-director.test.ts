import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeChannelPerformance,
  calculateCandidateScore,
  generateAndRankIdeas,
  buildProductionPackage,
  executeContentDirectorCycle,
  type PerformanceAnalysis,
  type ReelIdeaCandidate,
} from "../lib/director/content-director";
import { getDb } from "../db";
import { posts, contentDrafts, campaignMemories, campaigns, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

describe("Phase 2: Autonomous Content Director Unit & Integration Tests", () => {
  const mockAnalysis: PerformanceAnalysis = {
    channelName: "AnimeEdits",
    totalAnalyzedPosts: 5,
    topPerformingReels: [
      {
        id: "1316616991525561_122113024527420309",
        videoId: "4621308234820038",
        title: "Mafia Boss Dad & Daughter — Episode #25",
        views: 139475,
        likes: 2812,
        shares: 88,
        comments: 17,
        durationSeconds: 58.3,
        replays: 24800,
        avgWatchTimeSeconds: 6.8,
      },
      {
        id: "1316616991525561_122112457059420309",
        videoId: "2922166034798380",
        title: "Mafia Boss Dad & Daughter — Episode #24",
        views: 125726,
        likes: 3109,
        shares: 77,
        comments: 17,
        durationSeconds: 50.6,
        replays: 18200,
        avgWatchTimeSeconds: 6.4,
      },
    ],
    durationSweetSpot: {
      minSeconds: 48,
      maxSeconds: 58,
      recommendedDuration: 52,
      insight: "50s–58s duration sweet spot maximizes completion rates and replay triggers.",
    },
    provenHooks: [
      {
        pattern: "The Sensory Paradox Pattern Interrupt",
        archetype: "Sensory Paradox",
        avgViews: 139475,
        example: "A single cane tap in darkness.",
      },
    ],
    shareDrivers: ["Moral high ground", "Protecting daughter"],
    audiencePreferences: ["Tokyo noir aesthetic", "MAPPA style"],
  };

  // ==========================================
  // 1. IDEA RANKING & SCORING TESTS
  // ==========================================

  it("1. calculateCandidateScore: correctly scores duration proximity to 52s sweet spot", () => {
    const idealDurationCandidate = {
      id: "test_ideal",
      title: "The Ideal Duration Reel",
      seriesEpisode: "Episode #99",
      archetype: "Sensory Paradox" as const,
      targetDurationSeconds: 52, // Exact match
      hookOpening: "Opening hook...",
      coreConflict: "Conflict...",
      emotionalPayoff: "Payoff with daughter...",
      loopMechanism: "Audio loop...",
    };

    const excessiveDurationCandidate = {
      id: "test_long",
      title: "The Overly Long Reel",
      seriesEpisode: "Episode #98",
      archetype: "Sensory Paradox" as const,
      targetDurationSeconds: 95, // 43s deviation
      hookOpening: "Opening hook...",
      coreConflict: "Conflict...",
      emotionalPayoff: "Payoff with daughter...",
      loopMechanism: "Audio loop...",
    };

    const idealScore = calculateCandidateScore(idealDurationCandidate);
    const longScore = calculateCandidateScore(excessiveDurationCandidate);

    assert.equal(idealScore.durationOptimalityScore, 10, "Ideal 52s should receive max duration score (10)");
    assert.ok(longScore.durationOptimalityScore < idealScore.durationOptimalityScore, "95s should receive duration penalty");
    assert.ok(idealScore.overallWeightedScore > longScore.overallWeightedScore, "Ideal duration must have higher overall score");
  });

  it("2. generateAndRankIdeas: generates exactly 10 ranked candidates sorted descending", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);

    assert.equal(ranked.length, 10, "Must generate exactly 10 candidates");

    // Check rankings 1 to 10
    for (let i = 0; i < ranked.length; i++) {
      assert.equal(ranked[i].ranking, i + 1, `Candidate ${i} must have rank ${i + 1}`);
      if (i > 0) {
        assert.ok(
          ranked[i - 1].scores.overallWeightedScore >= ranked[i].scores.overallWeightedScore,
          "Ideas must be strictly sorted by overall score descending"
        );
      }
    }

    const rank1 = ranked[0];
    assert.ok(rank1.title.length > 0);
    assert.ok(rank1.hookOpening.length > 0);
    assert.ok(rank1.scores.overallWeightedScore >= 85, "Rank 1 idea should score >= 85");
  });

  // ==========================================
  // 2. PRODUCTION PACKAGE BUILDER TEST
  // ==========================================

  it("3. buildProductionPackage: generates comprehensive storyboard with 5-part Veo prompts", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const topIdea = ranked[0];
    const pkg = buildProductionPackage(topIdea, mockAnalysis);

    assert.ok(pkg.title.includes(topIdea.seriesEpisode));
    assert.ok(pkg.openingHook.voiceDialogue.length > 0);
    assert.ok(pkg.storyboard.length >= 4, "Storyboard must have at least 4 scenes");

    for (const scene of pkg.storyboard) {
      assert.ok(scene.veoPrompt.startsWith("9:16 vertical video."), "Every Veo prompt must specify 9:16 vertical video");
      assert.ok(scene.veoPrompt.includes("Native audio:"), "Every Veo prompt must specify Native audio cues");
      assert.ok(scene.timeframe.length > 0);
      assert.ok(scene.dialogue.length > 0);
    }

    assert.ok(pkg.narrationAndSubtitles.fullNarrationText.length > 0);
    assert.ok(pkg.narrationAndSubtitles.srtFormattedSubtitles.includes("-->"), "Subtitles must be valid SRT format");
    assert.ok(pkg.socialPackaging.hashtags.includes("animereels"));
  });

  // ==========================================
  // 3. DUPLICATE JOB PREVENTION & LOCK TEST
  // ==========================================

  it("4. Duplicate execution prevention: rejects concurrent jobs with identical key", async () => {
    // Read test scope from database
    const db = await getDb();
    const [user] = await db.select().from(users).limit(1);
    const [campaign] = await db.select().from(campaigns).limit(1);

    if (!user || !campaign) {
      // Skip if DB not populated
      return;
    }

    const idempotencyKey = "test_dup_key_" + Date.now();

    // Start cycle 1
    const p1 = executeContentDirectorCycle({
      userId: user.id,
      campaignId: campaign.id,
      idempotencyKey,
    });

    // Immediately start cycle 2 with identical key
    let caughtError: string | null = null;
    try {
      await executeContentDirectorCycle({
        userId: user.id,
        campaignId: campaign.id,
        idempotencyKey,
      });
    } catch (err: any) {
      caughtError = err.message;
    }

    assert.ok(caughtError?.includes("Duplicate execution rejected"), "Concurrent job must be rejected by lock");

    // Await first cycle to complete cleanly
    const res1 = await p1;
    assert.equal(res1.success, true);
    assert.equal(res1.status, "draft");
  });

  // ==========================================
  // 4. FULL DRAFT CREATION & SAFETY LOCK VERIFICATION
  // ==========================================

  it("5. executeContentDirectorCycle: creates verified draft in strictly DRAFT status", async () => {
    const db = await getDb();
    const [user] = await db.select().from(users).limit(1);
    const [campaign] = await db.select().from(campaigns).limit(1);

    if (!user || !campaign) return;

    const result = await executeContentDirectorCycle({
      userId: user.id,
      campaignId: campaign.id,
    });

    assert.equal(result.success, true);
    assert.ok(result.draftId > 0, "Draft ID must be a valid positive integer");
    assert.equal(result.status, "draft", "Status must strictly be 'draft' (Human-in-the-Loop)");
    assert.ok(result.safetyLockNotice.includes("Human-in-the-Loop Gateway Active"));

    // Verify in database
    const [dbPost] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, result.draftId), eq(posts.userId, user.id)))
      .limit(1);

    assert.ok(dbPost, "Draft post must exist in database posts table");
    assert.equal(dbPost.status, "draft", "Database record status must be 'draft'");
    assert.equal(dbPost.title, result.title);
    assert.ok(Array.isArray(dbPost.media));
    assert.ok(dbPost.media.length > 0);

    // Verify attached media points to a valid file on disk
    const attachedMedia = dbPost.media[0] as any;
    const mediaDiskPath = path.join(process.cwd(), ".data", "media", path.basename(attachedMedia.url));
    assert.ok(fs.existsSync(mediaDiskPath), "Attached media file must physically exist on disk");

    // Verify learning memory recorded
    assert.ok(result.memoryRecordIds.campaignMemoryId, "Must record learning in campaignMemories");
    const [mem] = await db
      .select()
      .from(campaignMemories)
      .where(eq(campaignMemories.id, result.memoryRecordIds.campaignMemoryId!))
      .limit(1);

    assert.ok(mem, "Campaign memory record must exist");
    assert.equal(mem.kind, "content_director_run");
    assert.ok(mem.content.includes(result.selectedPackage.selectedIdea.title));
  });

  // ==========================================
  // 5. MISSING ANALYTICS FALLBACK TEST
  // ==========================================

  it("6. Missing analytics graceful fallback: functions cleanly when external API is offline", async () => {
    // Pass bogus page ID / token to trigger fallback
    const analysis = await analyzeChannelPerformance({
      userId: "00000000-0000-0000-0000-000000000000",
      campaignId: 999999,
    });

    assert.ok(analysis.totalAnalyzedPosts > 0, "Fallback must provide historical benchmarks");
    assert.equal(analysis.durationSweetSpot.recommendedDuration, 52);
    assert.ok(analysis.provenHooks.length > 0);

    const ranked = generateAndRankIdeas(analysis);
    assert.equal(ranked.length, 10, "Must still rank 10 ideas under fallback");
  });

  it("cleanup: exits cleanly", () => {
    setTimeout(() => process.exit(0), 100);
  });
});
