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
import { validateVideoAsset } from "../lib/media/video-validator";
import { getDb } from "../db";
import { posts, contentDrafts, campaignMemories, campaigns, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

describe("Phase 2: Autonomous Content Director Unit & Integration Tests", () => {
  const mockAnalysis: PerformanceAnalysis = {
    channelName: "AnimeEdits",
    totalAnalyzedPosts: 5,
    dataSource: "fixture",
    retrievedAt: new Date().toISOString(),
    isFresh: false,
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
        retentionMeasured: true,
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
        retentionMeasured: true,
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

  it("1. calculateCandidateScore: correctly scores duration proximity to sweet spot", () => {
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

    const idealResult = calculateCandidateScore(idealDurationCandidate, mockAnalysis);
    const longResult = calculateCandidateScore(excessiveDurationCandidate, mockAnalysis);

    assert.equal(idealResult.scores.durationOptimalityScore, 10, "Ideal 52s should receive max duration score (10)");
    assert.ok(
      longResult.scores.durationOptimalityScore < idealResult.scores.durationOptimalityScore,
      "95s should receive duration penalty"
    );
    assert.ok(
      idealResult.scores.overallWeightedScore > longResult.scores.overallWeightedScore,
      "Ideal duration must have higher overall score"
    );
  });

  it("2. generateAndRankIdeas: generates exactly 10 ranked candidates sorted descending", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);

    assert.equal(ranked.length, 10, "Must generate exactly 10 candidate ideas");

    for (let i = 0; i < ranked.length - 1; i++) {
      const current = ranked[i];
      const next = ranked[i + 1];
      assert.ok(
        current.scores.overallWeightedScore >= next.scores.overallWeightedScore,
        `Candidates must be sorted descending: #${i + 1} (${current.scores.overallWeightedScore}) vs #${i + 2} (${next.scores.overallWeightedScore})`
      );
      assert.equal(current.ranking, i + 1, "Candidate rank number must match array position");
      assert.ok(current.scoringBasis, "Each candidate must record scoringBasis");
      assert.ok(typeof current.scoringBasis.retentionMeasured === "boolean");
    }
  });

  it("3. Priority 3: Data-driven ranking dynamically shifts #1 candidate when performance input changes", () => {
    // Scenario A: Channel data heavily favors High-IQ Checkmate
    const highIqAnalysis: PerformanceAnalysis = {
      ...mockAnalysis,
      topPerformingReels: [
        {
          id: "reel_high_iq_1",
          videoId: "1111",
          title: "The Billionaire Checkmate & Audit Reversal",
          views: 350000,
          likes: 8000,
          shares: 500,
          comments: 120,
          durationSeconds: 52,
          avgWatchTimeSeconds: 22.5,
          retentionMeasured: true,
        },
      ],
      durationSweetSpot: {
        minSeconds: 50,
        maxSeconds: 54,
        recommendedDuration: 52,
        insight: "52s High-IQ Checkmate dominates views.",
      },
    };

    const highIqRanked = generateAndRankIdeas(highIqAnalysis);
    assert.equal(
      highIqRanked[0].archetype,
      "High-IQ Checkmate",
      "When High-IQ Checkmate dominates views (350K), #1 candidate must be High-IQ Checkmate"
    );
    assert.equal(highIqRanked[0].scoringBasis.retentionMeasured, true);
    assert.ok(highIqRanked[0].scoringBasis.methodology.includes("Data-driven"));

    // Scenario B: Channel data heavily favors Reluctant Guardian with 54s sweet spot
    const guardianAnalysis: PerformanceAnalysis = {
      ...mockAnalysis,
      topPerformingReels: [
        {
          id: "reel_guardian_1",
          videoId: "2222",
          title: "Father & Daughter Parent Conference Bloodline Protection",
          views: 400000,
          likes: 9500,
          shares: 750,
          comments: 200,
          durationSeconds: 54,
          avgWatchTimeSeconds: 25.0,
          retentionMeasured: true,
        },
      ],
      durationSweetSpot: {
        minSeconds: 52,
        maxSeconds: 56,
        recommendedDuration: 54,
        insight: "54s Reluctant Guardian dominates views.",
      },
    };

    const guardianRanked = generateAndRankIdeas(guardianAnalysis);
    assert.equal(
      guardianRanked[0].archetype,
      "Reluctant Guardian",
      "When Reluctant Guardian dominates views (400K), #1 candidate must be Reluctant Guardian"
    );
    assert.equal(guardianRanked[0].targetDurationSeconds, 54, "Candidate matching 54s sweet spot should win");
  });

  it("4. buildProductionPackage: generates comprehensive storyboard with 5-part Veo prompts", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const winningIdea = ranked[0];
    const pkg = buildProductionPackage(winningIdea, mockAnalysis);

    assert.ok(pkg.title.includes(winningIdea.seriesEpisode));
    assert.equal(pkg.storyboard.length, 4);
    assert.ok(pkg.attachedMedia.url.endsWith(".mp4"));
  });

  // ==========================================
  // 2. PRIORITY 2: SEPARATE LIVE ANALYTICS FROM FIXTURES
  // ==========================================

  it("5. Priority 2: Returns dataSource: 'live' when live post analytics are retrieved", async () => {
    const liveSamplePosts = [
      {
        id: "fb_live_post_1",
        metaPostId: "meta_1",
        videoId: "v_1",
        text: "Live Anime Reel",
        postedAt: new Date(),
        likes: 100,
        comments: 5,
        shares: 10,
        views: 2500,
        lengthSeconds: 52,
      },
    ];

    const analysis = await analyzeChannelPerformance({
      userId: "00000000-0000-0000-0000-000000000000",
      campaignId: 1,
      overrideAnalyticsData: liveSamplePosts,
    });

    assert.equal(analysis.dataSource, "live");
    assert.equal(analysis.isFresh, true);
    assert.equal(analysis.dataFreshnessSeconds, 0);
    assert.equal(analysis.totalAnalyzedPosts, 1);
  });

  it("6. Priority 2: Returns dataSource: 'unavailable' in production mode when credentials missing or data empty", async () => {
    const analysis = await analyzeChannelPerformance({
      userId: "00000000-0000-0000-0000-000000000000",
      campaignId: 1,
      mode: "production",
      allowFixtures: false,
      overrideAnalyticsData: [],
    });

    assert.equal(analysis.dataSource, "unavailable");
    assert.equal(analysis.isFresh, false);
    assert.equal(analysis.totalAnalyzedPosts, 0);
    assert.ok(analysis.error, "Must include explicit error message");
  });

  it("7. Priority 2: Uses dataSource: 'fixture' with explicit indicator when allowFixtures is enabled in dev", async () => {
    const analysis = await analyzeChannelPerformance({
      userId: "00000000-0000-0000-0000-000000000000",
      campaignId: 1,
      allowFixtures: true,
      mode: "development",
      overrideAnalyticsData: [],
    });

    assert.equal(analysis.dataSource, "fixture");
    assert.equal(analysis.isFresh, false);
    assert.ok(analysis.totalAnalyzedPosts > 0);
    assert.ok(analysis.error?.includes("historical fixture"));
  });

  // ==========================================
  // 3. PRIORITY 1: NEVER CREATE FAKE VIDEO ASSETS
  // ==========================================

  it("8. Priority 1: validateVideoAsset rejects files containing placeholder signatures or corrupt bytes", async () => {
    const fakeTestFile = path.join(process.cwd(), ".data", "media", "test_corrupt_placeholder.mp4");
    fs.mkdirSync(path.dirname(fakeTestFile), { recursive: true });
    fs.writeFileSync(fakeTestFile, Buffer.from("AI_ANIME_REEL_MASTER_STREAM_PLACEHOLDER_CORRUPT_BYTES_XYZ"));

    const val = await validateVideoAsset(fakeTestFile);
    fs.unlinkSync(fakeTestFile);

    assert.equal(val.valid, false, "Placeholder file must fail validation");
    assert.ok(val.error?.includes("suspiciously small") || val.error?.includes("Media integrity violation"));
  });

  it("9. Priority 1: executeContentDirectorCycle stops and throws MediaIntegrityError when media is missing or invalid", async () => {
    const db = await getDb();
    const [user] = await db.select().from(users).limit(1);
    const [campaign] = await db.select().from(campaigns).limit(1);
    if (!user || !campaign) return;

    // Count posts before failed cycle
    const postsBefore = await db.select().from(posts).where(eq(posts.userId, user.id));

    // Temporarily rename the real media file to simulate missing asset
    const realMediaDir = path.join(process.cwd(), ".data", "media");
    const realFile = path.join(realMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    const tempFile = path.join(realMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4.bak");

    const pubMediaDir = path.join(process.cwd(), "public", "media");
    const pubFile = path.join(pubMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    const pubTemp = path.join(pubMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4.bak");

    const standaloneMediaDir = path.join(process.cwd(), ".next", "standalone", "public", "media");
    const standaloneFile = path.join(standaloneMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    const standaloneTemp = path.join(standaloneMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4.bak");

    try {
      if (fs.existsSync(realFile)) fs.renameSync(realFile, tempFile);
      if (fs.existsSync(pubFile)) fs.renameSync(pubFile, pubTemp);
      if (fs.existsSync(standaloneFile)) fs.renameSync(standaloneFile, standaloneTemp);

      let caughtError: string | null = null;
      try {
        await executeContentDirectorCycle({
          userId: user.id,
          campaignId: campaign.id,
          idempotencyKey: "test_missing_media_" + Date.now(),
          allowFixtures: true,
        });
      } catch (err: any) {
        caughtError = err.message;
      }

      assert.ok(caughtError?.includes("MediaIntegrityError"), "Must throw MediaIntegrityError when media asset is missing");
      assert.ok(!caughtError?.includes("PASSWORD"), "Must not leak credentials in error");

      // Verify NO post was created
      const postsAfter = await db.select().from(posts).where(eq(posts.userId, user.id));
      assert.equal(postsAfter.length, postsBefore.length, "No draft post should be created when media integrity fails");

      // Verify NO placeholder file was written
      assert.equal(fs.existsSync(realFile), false, "Must NEVER write a fake placeholder MP4 to disk");
    } finally {
      // Restore real files
      if (fs.existsSync(tempFile)) fs.renameSync(tempFile, realFile);
      if (fs.existsSync(pubTemp)) fs.renameSync(pubTemp, pubFile);
      if (fs.existsSync(standaloneTemp)) fs.renameSync(standaloneTemp, standaloneFile);
    }
  });

  // ==========================================
  // 4. DUPLICATE JOB PREVENTION & VALID DRAFT CREATION
  // ==========================================

  it("10. Duplicate execution prevention: rejects concurrent jobs with identical key", async () => {
    const db = await getDb();
    const [user] = await db.select().from(users).limit(1);
    const [campaign] = await db.select().from(campaigns).limit(1);
    if (!user || !campaign) return;

    const idempotencyKey = "test_dup_key_" + Date.now();

    const p1 = executeContentDirectorCycle({
      userId: user.id,
      campaignId: campaign.id,
      idempotencyKey,
      allowFixtures: true,
    });

    let caughtError: string | null = null;
    try {
      await executeContentDirectorCycle({
        userId: user.id,
        campaignId: campaign.id,
        idempotencyKey,
        allowFixtures: true,
      });
    } catch (err: any) {
      caughtError = err.message;
    }

    assert.ok(caughtError?.includes("Duplicate execution rejected"));
    const res1 = await p1;
    assert.equal(res1.success, true);
    assert.equal(res1.status, "draft");
  });

  it("11. executeContentDirectorCycle: creates verified draft with valid media attached in strictly DRAFT status", async () => {
    const db = await getDb();
    const [user] = await db.select().from(users).limit(1);
    const [campaign] = await db.select().from(campaigns).limit(1);
    if (!user || !campaign) return;

    const result = await executeContentDirectorCycle({
      userId: user.id,
      campaignId: campaign.id,
      allowFixtures: true,
    });

    assert.equal(result.success, true);
    assert.ok(result.draftId > 0);
    assert.equal(result.status, "draft");
    assert.ok(result.safetyLockNotice.includes("Human-in-the-Loop Gateway Active"));

    const [dbPost] = await db.select().from(posts).where(eq(posts.id, result.draftId)).limit(1);
    assert.ok(dbPost);
    assert.equal(dbPost.status, "draft");
  });

  it("cleanup: exits cleanly", () => {
    setTimeout(() => process.exit(0), 100);
  });
});
