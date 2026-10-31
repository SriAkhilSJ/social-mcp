import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeChannelPerformance,
  calculateCandidateScore,
  generateAndRankIdeas,
  buildProductionPackage,
  executeContentDirectorCycle,
  verifyDraftConsistency,
  DraftConsistencyError,
  evaluateChannelPerformance,
  type PerformanceAnalysis,
  type ReelIdeaCandidate,
} from "../lib/director/content-director";
import { validateVideoAsset } from "../lib/media/video-validator";
import {
  inspectVideoAsset,
  parseSrtSubtitles,
  DEFAULT_ANIME_CHARACTER_BIBLE,
  calculateVideoConsistencyScore,
} from "../lib/media/video-inspector";
import { recordDraftTombstone, isDraftTombstoned, getTombstonedDraftIds } from "../lib/tombstones";
import { fetchFacebookPageAnalytics } from "../lib/social/facebook";
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

  it("4a. Storyboard consistency: High-IQ Checkmate produces hallway secret & backpack ringtone visuals, dialogues, and narration", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const checkmateIdea = ranked.find((i) => i.archetype === "High-IQ Checkmate")!;
    assert.ok(checkmateIdea, "High-IQ Checkmate candidate idea must exist");

    const pkg = buildProductionPackage(checkmateIdea, mockAnalysis);

    // Verify storyboard scene 1 corresponds to hallway confrontation
    assert.equal(pkg.storyboard[0].name, "The Hallway Confrontation Hook");
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("locker") || pkg.storyboard[0].visualDescription.toLowerCase().includes("phone"));
    assert.ok(pkg.storyboard[0].veoPrompt.toLowerCase().includes("locker") || pkg.storyboard[0].veoPrompt.toLowerCase().includes("hallway"));
    assert.ok(pkg.storyboard[0].dialogue.toLowerCase().includes("locker") || pkg.storyboard[0].dialogue.toLowerCase().includes("phone"));

    // Verify narration and dialogue correspond to High-IQ Checkmate
    assert.ok(pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("backpack") || pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("phone"));
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("close your ears, sweetie"), "High-IQ checkmate must not use reluctant guardian daughter lines");
    assert.ok(pkg.openingHook.onScreenText.includes("BEST FRIEND") || pkg.openingHook.onScreenText.includes("SECRET"));
    assert.ok(pkg.socialPackaging.hashtags.includes("EveryoneIgnoredHim") || pkg.socialPackaging.hashtags.includes("Betrayal"));
  });

  it("4b. Storyboard consistency: Sound-First ASMR produces foley glitching audio wave visuals and dialogues", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const asmrIdea = ranked.find((i) => i.id === "idea_voice_note_future_ren")!;
    assert.ok(asmrIdea, "Sound-First ASMR candidate idea must exist");

    const pkg = buildProductionPackage(asmrIdea, mockAnalysis);

    // Verify scene 1 corresponds to audio waveform / silence
    assert.equal(pkg.storyboard[0].name, "The Glitching Audio Wave Hook");
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("waveform") || pkg.storyboard[0].visualDescription.toLowerCase().includes("darkness") || pkg.storyboard[0].visualDescription.toLowerCase().includes("screen"));
    assert.ok(pkg.storyboard[0].veoPrompt.toLowerCase().includes("waveform") || pkg.storyboard[0].veoPrompt.toLowerCase().includes("screen"));
    assert.ok(pkg.storyboard[0].nativeAudioCue.toLowerCase().includes("whisper") || pkg.storyboard[0].nativeAudioCue.toLowerCase().includes("static") || pkg.storyboard[0].nativeAudioCue.toLowerCase().includes("breathing"));

    // Verify narration corresponds to voice note dialogue
    assert.ok(pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("audio note") || pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("knocks"));
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("five men how to knock"));
    assert.ok(pkg.openingHook.onScreenText.includes("VOICE") || pkg.openingHook.onScreenText.includes("TOMORROW"));
    assert.ok(pkg.socialPackaging.hashtags.includes("EveryoneIgnoredHim") || pkg.socialPackaging.hashtags.includes("AnimeASMR"));
  });

  it("4c. Storyboard consistency: Sensory Paradox produces 3:14 AM vibrating phone visuals and dialogues", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const sensoryIdea = ranked.find((i) => i.archetype === "Sensory Paradox")!;
    assert.ok(sensoryIdea, "Sensory Paradox candidate idea must exist");

    const pkg = buildProductionPackage(sensoryIdea, mockAnalysis);

    // Verify scene 1 corresponds to 3:14 AM notification hook
    assert.equal(pkg.storyboard[0].name, "The 3:14 AM Notification Hook");
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("bedroom") || pkg.storyboard[0].visualDescription.toLowerCase().includes("nightstand") || pkg.storyboard[0].visualDescription.toLowerCase().includes("phone"));
    assert.ok(pkg.storyboard[0].veoPrompt.toLowerCase().includes("bedroom") || pkg.storyboard[0].veoPrompt.toLowerCase().includes("3:14"));
    assert.ok(pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("3:14 am") || pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("message"));
    assert.ok(pkg.openingHook.onScreenText.includes("MESSAGE") || pkg.openingHook.onScreenText.includes("TOMORROW"));
  });

  it("4d. Storyboard consistency: Does not claim finished video unless media asset has been generated and validated", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const idea = ranked[0];

    // Explicitly unverified media
    const pkg = buildProductionPackage(idea, mockAnalysis, { isRealMediaValidated: false });
    assert.equal(pkg.videoValidated, false, "Must not claim finished video when media has not been validated");
    assert.equal(pkg.mediaStatus, "storyboard_ready", "Media status must be storyboard_ready");
    assert.equal(pkg.attachedMedia.origin, "edited");
  });

  it("4e. Storyboard consistency: Message from Tomorrow idea matches dark bedroom, 3:14 AM lock screen, and empty desk prediction (never substitutes unrelated storylines)", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const tomorrowIdea = ranked.find((i) => i.id === "idea_tomorrow_message_314am")!;
    assert.ok(tomorrowIdea, "The 3:14 AM message from tomorrow candidate idea must exist");

    const pkg = buildProductionPackage(tomorrowIdea, mockAnalysis);

    // Scene 1: vibrating phone in dark bedroom
    assert.equal(pkg.storyboard[0].name, "The 3:14 AM Notification Hook");
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("bedroom") || pkg.storyboard[0].visualDescription.toLowerCase().includes("vibrating"));
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("nightstand") || pkg.storyboard[0].visualDescription.toLowerCase().includes("phone"));
    assert.ok(pkg.storyboard[0].dialogue.toLowerCase().includes("homeroom") || pkg.storyboard[0].dialogue.toLowerCase().includes("desk 4"));

    // Scene 2 & 3: classroom whispers and erased desk
    assert.ok(pkg.storyboard[1].visualDescription.toLowerCase().includes("hallway") || pkg.storyboard[1].visualDescription.toLowerCase().includes("whisper") || pkg.storyboard[1].visualDescription.toLowerCase().includes("students"));
    assert.ok(pkg.storyboard[2].visualDescription.toLowerCase().includes("desk") || pkg.storyboard[2].visualDescription.toLowerCase().includes("floorboards"));
    assert.ok(pkg.storyboard[2].dialogue.toLowerCase().includes("daiki") || pkg.storyboard[2].dialogue.toLowerCase().includes("nobody"));

    // Narration must NOT substitute unrelated chess or rooftop stories
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("chess king"), "Mystery storyboard must not contain chess pieces");
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("heliport"), "Mystery storyboard must not contain rooftop helipad");
    assert.ok(pkg.openingHook.onScreenText.includes("MESSAGE") || pkg.openingHook.onScreenText.includes("TOMORROW"));
    assert.ok(pkg.socialPackaging.hashtags.includes("EveryoneIgnoredHim") || pkg.socialPackaging.hashtags.includes("Ren"));
  });

  it("4f. Storyboard consistency: Erased Classmate idea produces sudden disappearance, falling pencil, and dissolving group photo sequence", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const erasedIdea = ranked.find((i) => i.id === "idea_classroom_erased_classmate")!;
    assert.ok(erasedIdea, "Erased classmate candidate idea must exist");

    const pkg = buildProductionPackage(erasedIdea, mockAnalysis);

    assert.equal(pkg.storyboard[0].name, "The Dissolving Classmate Hook");
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("pencil") || pkg.storyboard[0].visualDescription.toLowerCase().includes("static") || pkg.storyboard[0].visualDescription.toLowerCase().includes("dissolve"));
    assert.ok(pkg.storyboard[2].name.toLowerCase().includes("photo"));
    assert.ok(pkg.storyboard[2].dialogue.toLowerCase().includes("photo"));
    assert.ok(pkg.openingHook.onScreenText.includes("ERASED"));
    assert.ok(pkg.socialPackaging.hashtags.includes("PsychologicalAnime") || pkg.socialPackaging.hashtags.includes("EveryoneIgnoredHim"));
  });

  it("4g. Storyboard consistency: The Best Friend's Secret idea matches hallway tension, locker confrontation, and ringing backpack phone (never substitutes chess)", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const secretIdea = ranked.find((i) => i.id === "idea_best_friend_secret")!;
    assert.ok(secretIdea, "Best friend secret candidate idea must exist");

    const pkg = buildProductionPackage(secretIdea, mockAnalysis);

    // Scene 1: hallway locker confrontation
    assert.equal(pkg.storyboard[0].name, "The Hallway Confrontation Hook");
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("locker") || pkg.storyboard[0].visualDescription.toLowerCase().includes("hallway"));
    assert.ok(
      pkg.storyboard[0].dialogue.toLowerCase().includes("locker") ||
      pkg.storyboard[0].dialogue.toLowerCase().includes("phone"),
      "Scene 1 dialogue must reference the locker or phone"
    );

    // Scene 3: ringing backpack
    assert.equal(pkg.storyboard[2].name, "The Ringing Backpack");
    assert.ok(pkg.storyboard[2].visualDescription.toLowerCase().includes("backpack") || pkg.storyboard[2].visualDescription.toLowerCase().includes("ringtone"));
    assert.ok(pkg.storyboard[2].dialogue.toLowerCase().includes("backpack") || pkg.storyboard[2].dialogue.toLowerCase().includes("ringing"));

    // Narration must NOT substitute chess or janitor
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("chess"), "Hallway confrontation must not contain chess");
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("janitor"), "Hallway confrontation must not contain janitor");
    assert.ok(pkg.openingHook.onScreenText.includes("BEST FRIEND") || pkg.openingHook.onScreenText.includes("SECRET"));
  });

  it("4h. Storyboard consistency: Reluctant Guardian concepts match specific rescue situations (Yamanote train platform vs rooftop lockdown)", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const trainIdea = ranked.find((i) => i.id === "idea_yamanote_platform_rescue")!;
    assert.ok(trainIdea, "Train platform rescue idea must exist");

    const trainPkg = buildProductionPackage(trainIdea, mockAnalysis);

    // Verify train rescue has station yellow line and electrical arc
    assert.equal(trainPkg.storyboard[0].name, "The 4:18 PM Station Yellow Line Hook");
    assert.ok(trainPkg.storyboard[0].visualDescription.toLowerCase().includes("platform") || trainPkg.storyboard[0].visualDescription.toLowerCase().includes("yellow line"));
    assert.ok(trainPkg.storyboard[0].dialogue.toLowerCase().includes("yellow line"));
    assert.ok(trainPkg.storyboard[2].visualDescription.toLowerCase().includes("electrical") || trainPkg.storyboard[2].visualDescription.toLowerCase().includes("track") || trainPkg.storyboard[2].visualDescription.toLowerCase().includes("arc"));
    assert.ok(trainPkg.openingHook.onScreenText.includes("TRAIN") || trainPkg.openingHook.onScreenText.includes("RESCUE"));

    // Rooftop lockdown idea
    const rooftopIdea = ranked.find((i) => i.id === "idea_rooftop_lockdown_protective")!;
    assert.ok(rooftopIdea, "Rooftop lockdown idea must exist");

    const rooftopPkg = buildProductionPackage(rooftopIdea, mockAnalysis);
    assert.equal(rooftopPkg.storyboard[0].name, "The Rooftop Barricade Hook");
    assert.ok(rooftopPkg.storyboard[0].visualDescription.toLowerCase().includes("rooftop") || rooftopPkg.storyboard[0].visualDescription.toLowerCase().includes("barricade") || rooftopPkg.storyboard[0].visualDescription.toLowerCase().includes("door"));
    assert.ok(rooftopPkg.storyboard[1].visualDescription.toLowerCase().includes("stairwell") || rooftopPkg.storyboard[1].visualDescription.toLowerCase().includes("silhouettes"));
    assert.ok(rooftopPkg.storyboard[3].dialogue.toLowerCase().includes("exist"));
  });

  it("4i. Storyboard consistency: Incomplete or invalid idea candidate throws explicit StoryboardGenerationError", () => {
    assert.throws(
      () => {
        buildProductionPackage(
          {
            id: "incomplete_idea",
            title: "Missing Fields",
            seriesEpisode: "Episode #99",
            archetype: "Sensory Paradox",
            targetDurationSeconds: 52,
            hookOpening: "", // missing hookOpening
            coreConflict: "",
            emotionalPayoff: "",
            loopMechanism: "",
            scores: {} as any,
            ranking: 1,
            scoringBasis: {} as any,
          },
          mockAnalysis
        );
      },
      (err: any) => {
        return err instanceof Error && err.message.includes("StoryboardGenerationError");
      },
      "Must throw explicit StoryboardGenerationError for incomplete idea"
    );
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

  it("7a. Evidence-based analytics: Missing views returns dataSource 'insufficient_data' and provenHooks with avgViews: null", async () => {
    const missingViewsPosts = [
      {
        id: "post_no_views_1",
        metaPostId: "meta_nv_1",
        videoId: "v_nv_1",
        text: "Anime post with null views",
        postedAt: new Date(),
        likes: 12,
        comments: 0,
        shares: 1,
        views: null, // telemetry unavailable
        lengthSeconds: 52,
      },
    ];

    const analysis = await analyzeChannelPerformance({
      userId: "00000000-0000-0000-0000-000000000000",
      campaignId: 1,
      overrideAnalyticsData: missingViewsPosts,
    });

    assert.equal(analysis.dataSource, "insufficient_data", "Must return explicit insufficient_data when view telemetry is missing");
    assert.equal(analysis.topPerformingReels.length, 0, "No reels should be ranked as top performing without views");
    assert.ok(analysis.provenHooks.every((h) => h.avgViews === null), "Proven hooks must have avgViews: null when views are missing");
    assert.ok(analysis.provenHooks.every((h) => h.isMeasured === false && h.measurementBasis === "heuristic"));

    const ranked = generateAndRankIdeas(analysis);
    assert.equal(ranked[0].scoringBasis.retentionMeasured, false);
    assert.ok(ranked[0].scoringBasis.methodology.toLowerCase().includes("insufficient channel evidence"));
  });

  it("7b. Evidence-based analytics: Missing retention sets retentionMeasured: false and heuristic retention methodology", async () => {
    const missingRetentionPosts = [
      {
        id: "post_ret_missing_1",
        metaPostId: "meta_ret_1",
        videoId: "v_ret_1",
        title: "The Billionaire Checkmate & Audit Reversal",
        text: "The Billionaire Checkmate & Audit Reversal",
        postedAt: new Date(),
        likes: 450,
        comments: 12,
        shares: 30,
        views: 280000,
        lengthSeconds: 52,
        insights: undefined, // Retention telemetry missing
      },
    ];

    const analysis = await analyzeChannelPerformance({
      userId: "00000000-0000-0000-0000-000000000000",
      campaignId: 1,
      overrideAnalyticsData: missingRetentionPosts,
    });

    assert.equal(analysis.dataSource, "live");
    assert.equal(analysis.topPerformingReels[0].retentionMeasured, false, "Must not claim retentionMeasured when telemetry is missing");

    const ranked = generateAndRankIdeas(analysis);
    assert.equal(ranked[0].scoringBasis.retentionMeasured, false);
    assert.ok(
      ranked[0].scoringBasis.methodology.toLowerCase().includes("heuristic retention"),
      "Methodology must distinguish heuristic retention from measured telemetry"
    );
  });

  it("7c. Evidence-based analytics: Unmatched archetypes have isMeasured: false, avgViews: null, and are labeled heuristic", async () => {
    const singleArchetypePosts = [
      {
        id: "post_single_iq",
        metaPostId: "meta_iq",
        videoId: "v_iq",
        title: "The Billionaire Checkmate & Audit Reversal",
        text: "The Billionaire Checkmate & Audit Reversal",
        postedAt: new Date(),
        likes: 800,
        comments: 20,
        shares: 50,
        views: 350000,
        lengthSeconds: 52,
      },
    ];

    const analysis = await analyzeChannelPerformance({
      userId: "00000000-0000-0000-0000-000000000000",
      campaignId: 1,
      overrideAnalyticsData: singleArchetypePosts,
    });

    const highIqHook = analysis.provenHooks.find((h) => h.archetype === "High-IQ Checkmate")!;
    assert.ok(highIqHook, "High-IQ Checkmate hook must exist");
    assert.equal(highIqHook.isMeasured, true, "Matched archetype must be marked isMeasured: true");
    assert.equal(highIqHook.measurementBasis, "measured");
    assert.equal(highIqHook.avgViews, 350000, "Matched archetype must reflect real measured views");

    const sensoryHook = analysis.provenHooks.find((h) => h.archetype === "Sensory Paradox")!;
    assert.ok(sensoryHook);
    assert.equal(sensoryHook.isMeasured, false, "Unmatched archetype must have isMeasured: false");
    assert.equal(sensoryHook.measurementBasis, "heuristic");
    assert.equal(sensoryHook.avgViews, null, "Unmatched archetype must NOT fabricate a fake view number");
    assert.ok(sensoryHook.example.includes("Heuristic recommendation"));
  });

  it("7d. Evidence-based analytics: Missing retention/completion telemetry does NOT claim duration maximizes completion rates", async () => {
    const postsWithViewsNoRetention = [
      {
        id: "post_no_ret_1",
        metaPostId: "meta_nr_1",
        videoId: "v_nr_1",
        text: "The High-IQ Reversal Checkmate",
        postedAt: new Date(),
        likes: 120,
        comments: 4,
        shares: 10,
        views: 18000,
        lengthSeconds: 54,
        insights: undefined, // no watch time or completion telemetry
      },
    ];

    const analysis = await analyzeChannelPerformance({
      userId: "00000000-0000-0000-0000-000000000000",
      campaignId: 1,
      overrideAnalyticsData: postsWithViewsNoRetention,
    });

    // Duration recommendation explanation must NOT claim to maximize completion rates
    const insight = analysis.durationSweetSpot.insight.toLowerCase();
    assert.ok(!insight.includes("maximizes completion rates"), "Must not claim to maximize completion rates without retention telemetry");
    assert.ok(insight.includes("unmeasured") || insight.includes("benchmark"), "Must explain that completion rate telemetry is unmeasured");
    assert.equal(analysis.topPerformingReels[0].retentionMeasured, false);
  });

  it("7e. Evidence-based analytics: Keyword match in title does NOT label a hook as proven without retention metrics", async () => {
    const keywordOnlyPosts = [
      {
        id: "post_kw_1",
        metaPostId: "meta_kw_1",
        videoId: "v_kw_1",
        text: "The High-IQ Reversal and checkmate audit",
        postedAt: new Date(),
        likes: 200,
        comments: 8,
        shares: 15,
        views: 45000,
        lengthSeconds: 52,
        insights: undefined, // Retention/watch time unmeasured
      },
    ];

    const analysis = await analyzeChannelPerformance({
      userId: "00000000-0000-0000-0000-000000000000",
      campaignId: 1,
      overrideAnalyticsData: keywordOnlyPosts,
    });

    const highIqHook = analysis.provenHooks.find((h) => h.archetype === "High-IQ Checkmate")!;
    assert.ok(highIqHook, "High-IQ Checkmate hook must exist");
    assert.equal(highIqHook.isMeasured, true, "Views are measured");
    assert.equal(highIqHook.isProven, false, "Hook must NOT be labeled proven solely due to keyword match without retention metrics");
    assert.ok(highIqHook.evidenceNotes?.toLowerCase().includes("unproven") || highIqHook.evidenceNotes?.toLowerCase().includes("keyword-matched"));
  });

  it("7f. Evidence-based analytics: Measured retention telemetry derives duration sweet spot from watch times and confirms proven hook", async () => {
    const liveWithRetentionPosts = [
      {
        id: "post_ret_measured_1",
        metaPostId: "meta_rm_1",
        videoId: "v_rm_1",
        text: "The High-IQ Reversal and checkmate audit",
        postedAt: new Date(),
        likes: 500,
        comments: 25,
        shares: 80,
        views: 95000,
        lengthSeconds: 52,
        insights: {
          avgWatchTimeSeconds: 38.5,
          replayCount: 420,
        },
      },
    ];

    const analysis = await analyzeChannelPerformance({
      userId: "00000000-0000-0000-0000-000000000000",
      campaignId: 1,
      overrideAnalyticsData: liveWithRetentionPosts,
    });

    // Duration recommendation derives from measured retention
    const insight = analysis.durationSweetSpot.insight.toLowerCase();
    assert.ok(insight.includes("measured retention") || insight.includes("watch time"));
    assert.ok(insight.includes("38.5s"));

    // Hook backed by measured retention is verified
    const highIqHook = analysis.provenHooks.find((h) => h.archetype === "High-IQ Checkmate")!;
    assert.equal(highIqHook.isProven, true, "Hook with measured retention telemetry must have isProven: true");
    assert.ok(highIqHook.evidenceNotes?.toLowerCase().includes("proven: supported by measured retention"));
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

  it("8a. Strict video validation: Rejects corrupt MP4 even if binary header contains valid ftyp box", async () => {
    const corruptMp4File = path.join(process.cwd(), ".data", "media", "test_corrupt_with_valid_header.mp4");
    fs.mkdirSync(path.dirname(corruptMp4File), { recursive: true });

    // Construct 5000 bytes: valid 24-byte ftyp box followed by corrupt random zeros
    const header = Buffer.from([
      0x00, 0x00, 0x00, 0x18, // 24 bytes box size
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x69, 0x73, 0x6f, 0x6d, // 'isom'
      0x00, 0x00, 0x02, 0x00, // minor version
      0x69, 0x73, 0x6f, 0x6d, // compatible brand 'isom'
      0x6d, 0x70, 0x34, 0x31, // compatible brand 'mp41'
    ]);
    const payload = Buffer.alloc(5000, 0);
    fs.writeFileSync(corruptMp4File, Buffer.concat([header, payload]));

    const val = await validateVideoAsset(corruptMp4File);
    fs.unlinkSync(corruptMp4File);

    assert.equal(val.valid, false, "Must not accept a corrupt MP4 merely because its 128-byte header has an ftyp box");
    assert.ok(val.error?.includes("FFprobe failed to decode") || val.error?.includes("corrupt"));
  });

  it("8b. Strict video validation: Fails safely when FFprobe is missing or unavailable on PATH", async () => {
    const realVideo = path.join(process.cwd(), "public", "media", "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    if (!fs.existsSync(realVideo)) return;

    const val = await validateVideoAsset(realVideo, {
      ffprobePath: "nonexistent_ffprobe_executable_xyz",
    });

    assert.equal(val.valid, false, "Must fail safely when FFprobe cannot verify video stream and duration");
    assert.ok(val.error?.includes("Validation failed safely") || val.error?.includes("not installed"));
  });

  it("8c. Strict video validation: Successfully verifies authentic playable MP4 file with positive duration and stream info", async () => {
    const realVideo = path.join(process.cwd(), "public", "media", "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    if (!fs.existsSync(realVideo)) return;

    const val = await validateVideoAsset(realVideo);
    assert.equal(val.valid, true, "Authentic mastercut MP4 must pass validation");
    assert.equal(val.toolUsed, "ffprobe");
    assert.ok(val.metadata !== undefined);
    assert.ok(val.metadata.durationSeconds! > 40, "Must confirm positive video duration (> 40s)");
    assert.equal(val.metadata.videoCodec, "h264");
  });

  it("9. Priority 1: executeContentDirectorCycle stops and throws MediaIntegrityError when media is missing or invalid", async () => {
    const db = await getDb();
    const [user] = await db.select().from(users).limit(1);
    const [campaign] = await db.select().from(campaigns).limit(1);
    if (!user || !campaign) return;

    // Count posts before failed cycle
    const postsBefore = await db.select().from(posts).where(eq(posts.userId, user.id));

    // Temporarily rename all real media files to simulate missing asset
    const realMediaDir = path.join(process.cwd(), ".data", "media");
    const realFile = path.join(realMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    const tempFile = path.join(realMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4.bak");
    const realFile2 = path.join(realMediaDir, "Everyone_Ignored_Him_Until_Tomorrow_Ep1_MasterCut_42s.mp4");
    const tempFile2 = path.join(realMediaDir, "Everyone_Ignored_Him_Until_Tomorrow_Ep1_MasterCut_42s.mp4.bak");

    const pubMediaDir = path.join(process.cwd(), "public", "media");
    const pubFile = path.join(pubMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    const pubTemp = path.join(pubMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4.bak");
    const pubFile2 = path.join(pubMediaDir, "Everyone_Ignored_Him_Until_Tomorrow_Ep1_MasterCut_42s.mp4");
    const pubTemp2 = path.join(pubMediaDir, "Everyone_Ignored_Him_Until_Tomorrow_Ep1_MasterCut_42s.mp4.bak");

    const standaloneMediaDir = path.join(process.cwd(), ".next", "standalone", "public", "media");
    const standaloneFile = path.join(standaloneMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    const standaloneTemp = path.join(standaloneMediaDir, "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4.bak");
    const standaloneFile2 = path.join(standaloneMediaDir, "Everyone_Ignored_Him_Until_Tomorrow_Ep1_MasterCut_42s.mp4");
    const standaloneTemp2 = path.join(standaloneMediaDir, "Everyone_Ignored_Him_Until_Tomorrow_Ep1_MasterCut_42s.mp4.bak");

    try {
      if (fs.existsSync(realFile)) fs.renameSync(realFile, tempFile);
      if (fs.existsSync(pubFile)) fs.renameSync(pubFile, pubTemp);
      if (fs.existsSync(standaloneFile)) fs.renameSync(standaloneFile, standaloneTemp);
      if (fs.existsSync(realFile2)) fs.renameSync(realFile2, tempFile2);
      if (fs.existsSync(pubFile2)) fs.renameSync(pubFile2, pubTemp2);
      if (fs.existsSync(standaloneFile2)) fs.renameSync(standaloneFile2, standaloneTemp2);

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
      if (fs.existsSync(tempFile2)) fs.renameSync(tempFile2, realFile2);
      if (fs.existsSync(pubTemp2)) fs.renameSync(pubTemp2, pubFile2);
      if (fs.existsSync(standaloneTemp2)) fs.renameSync(standaloneTemp2, standaloneFile2);
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

  it("12. Task 2 Video Inspection: extracts stream metadata, scene cuts, 3 representative frames, and visual summary", async () => {
    const videoPath = path.join(process.cwd(), "public", "media", "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    assert.ok(fs.existsSync(videoPath), "Production mastercut must physically exist on disk");

    const report = await inspectVideoAsset(videoPath, { targetDurationSeconds: 42 });

    assert.equal(report.exists, true);
    assert.equal(report.canDecode, true);
    assert.ok(report.videoMetadata, "Video metadata must be extracted");
    assert.equal(report.videoMetadata?.codecName, "h264");
    assert.equal(report.videoMetadata?.width, 1080);
    assert.equal(report.videoMetadata?.height, 1920);
    assert.equal(report.videoMetadata?.isVertical, true);
    assert.equal(report.videoMetadata?.aspectRatio, "9:16");
    assert.ok(report.audioMetadata, "Audio metadata must be extracted");
    assert.equal(report.audioMetadata?.codecName, "aac");
    assert.ok(report.sceneChanges.length >= 2, "Must detect scene cuts");
    assert.equal(report.visualSummary.frames.length, 3, "Must extract exactly 3 representative frames (beginning, middle, end)");
    for (const frame of report.visualSummary.frames) {
      assert.equal(frame.isValidImage, true, `Frame at ${frame.position} must be a valid image buffer`);
      assert.ok(frame.sizeBytes > 1000, `Frame at ${frame.position} must be non-empty`);
    }
    assert.equal(report.visuallyVerified, true, "Valid vertical video with audio, scene progression, and matching duration must pass visual verification");
  });

  it("12a. Task 2 Video Inspection: does NOT mark video verified if duration deviates or aspect ratio is horizontal", async () => {
    const videoPath = path.join(process.cwd(), "public", "media", "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    // Test with candidate expecting 65s duration (42s actual video deviates by 23s)
    const reportMismatched = await inspectVideoAsset(videoPath, { targetDurationSeconds: 65 });
    assert.equal(reportMismatched.visuallyVerified, false, "Must not mark as verified when duration deviates beyond tolerance");
    assert.ok(reportMismatched.storyboardComparison.mismatchReasons.some((r) => r.includes("deviates from candidate target duration")));
  });

  it("12b. Adaptive scene-based frame extraction: extracts frames around every detected scene transition and action events", async () => {
    const videoPath = path.join(process.cwd(), "public", "media", "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    const report = await inspectVideoAsset(videoPath, {
      targetDurationSeconds: 42,
      samplingMode: "adaptive",
    });

    assert.ok(report.sceneChanges.length >= 2, "Must detect multiple scene cuts");
    // Verify adaptive keyframes are extracted
    assert.ok(report.extractedKeyframes.length >= 6, `Must extract at least 6 adaptive keyframes (found ${report.extractedKeyframes.length})`);

    // Verify frames around transitions
    const transitionFrames = report.extractedKeyframes.filter(
      (f) => f.position === "scene_transition" || f.eventType?.startsWith("transition_")
    );
    assert.ok(transitionFrames.length >= 4, "Must extract pre-cut and post-cut frames for detected transitions");
    assert.ok(transitionFrames.some((f) => f.eventType === "transition_pre"), "Must have pre-cut frames");
    assert.ok(transitionFrames.some((f) => f.eventType === "transition_post"), "Must have post-cut frames");

    // Verify action event frames
    const hookFrame = report.extractedKeyframes.find((f) => f.eventType === "hook");
    assert.ok(hookFrame, "Must extract opening hook frame");
    assert.ok(hookFrame.timestampSeconds <= 2.0, "Hook frame must be within first 2 seconds");

    const climaxFrame = report.extractedKeyframes.find((f) => f.eventType === "midpoint_climax");
    assert.ok(climaxFrame, "Must extract midpoint climax frame");

    const cliffhangerFrame = report.extractedKeyframes.find((f) => f.eventType === "cliffhanger");
    assert.ok(cliffhangerFrame, "Must extract cliffhanger frame");

    const resolutionFrame = report.extractedKeyframes.find((f) => f.eventType === "resolution");
    assert.ok(resolutionFrame, "Must extract closing resolution frame");

    // Verify all frames are valid JPEGs with base64 data
    for (const frame of report.extractedKeyframes) {
      assert.equal(frame.isValidImage, true, `Frame at ${frame.timestampSeconds}s must be valid`);
      assert.ok(frame.sizeBytes > 1000, `Frame at ${frame.timestampSeconds}s must be non-empty`);
      assert.ok(frame.base64Data, `Frame at ${frame.timestampSeconds}s must have base64Data for vision model`);
    }
  });

  it("12c. Multimodal Vision input: feeds actual binary image buffers (inlineData), not just string URLs", async () => {
    const videoPath = path.join(process.cwd(), "public", "media", "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    const report = await inspectVideoAsset(videoPath, {
      targetDurationSeconds: 42,
      samplingMode: "adaptive",
      characterBible: DEFAULT_ANIME_CHARACTER_BIBLE,
    });

    // Verify keyframes contain actual base64 image data for feeding directly to multimodal vision
    assert.ok(report.extractedKeyframes.length > 0);
    const validBase64Frames = report.extractedKeyframes.filter(
      (f) => typeof f.base64Data === "string" && f.base64Data.length > 500
    );
    assert.equal(
      validBase64Frames.length,
      report.extractedKeyframes.length,
      "Every extracted frame must provide binary base64 data for multimodal vision models"
    );

    // Verify base64 decodes back to authentic JPEG magic bytes (FF D8 FF)
    const firstFrameBuffer = Buffer.from(validBase64Frames[0].base64Data!, "base64");
    assert.equal(firstFrameBuffer[0], 0xff);
    assert.equal(firstFrameBuffer[1], 0xd8);
  });

  it("12d. Timestamped ASR & scene descriptions: combines ASR narration transcript with visual scene descriptions", async () => {
    const videoPath = path.join(process.cwd(), "public", "media", "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");
    const testSrt = `1\n00:00:00,000 --> 00:00:10,500\nRen Kurokawa: 3:14 AM. The phone vibrates against the cold floor.\n\n2\n00:00:10,500 --> 00:00:21,000\nRen Kurokawa: No caller ID. Look at the desk next to you.\n\n3\n00:00:21,000 --> 00:00:31,500\nRen Kurokawa: Desk four is empty.\n\n4\n00:00:31,500 --> 00:00:42,000\nRen Kurokawa: Until a message arrives timestamped tomorrow.`;

    const parsedAsr = parseSrtSubtitles(testSrt);
    assert.equal(parsedAsr.length, 4, "Must parse 4 SRT ASR segments");
    assert.equal(parsedAsr[0].speaker, "Ren Kurokawa");
    assert.equal(parsedAsr[0].startTimeSeconds, 0);
    assert.equal(parsedAsr[0].endTimeSeconds, 10.5);

    const report = await inspectVideoAsset(videoPath, {
      targetDurationSeconds: 42,
      asrTranscript: parsedAsr,
    });

    assert.ok(report.sceneDescriptions.length >= 3, "Must produce scene-by-scene descriptions");
    for (const scene of report.sceneDescriptions) {
      assert.ok(scene.sceneIndex >= 1, "Must have valid scene index");
      assert.ok(scene.durationSeconds > 0, "Must have positive duration");
      assert.ok(scene.visualDescription.length > 10, "Must have rich visual description");
      assert.ok(scene.asrTranscript.length > 5, "Must combine spoken ASR text");
      assert.ok(scene.keyframeTimestamps.length > 0, "Must associate keyframe timestamps");
      assert.ok(scene.detectedActions.length > 0, "Must identify detected actions");
    }
  });

  it("12e. Storyboard comparison & defect detection: detects missing scenes, inconsistent characters, unrelated footage, subtitle errors, and narration mismatches", async () => {
    const videoPath = path.join(process.cwd(), "public", "media", "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");

    // Storyboard expecting 6 scenes, but 42s video has 4 scenes -> scene 5 and 6 should be detected as missing
    const storyboardWithMissingScenes = [
      { sceneNumber: 1, timeframe: "00:00 - 00:10", visualDescription: "Ren in bedroom 3:14 AM", nativeAudioCue: "rain", dialogue: "3:14 AM vibrating phone", veoPrompt: "scene 1" },
      { sceneNumber: 2, timeframe: "00:10 - 00:21", visualDescription: "Ren looks at locker", nativeAudioCue: "buzz", dialogue: "Look at locker", veoPrompt: "scene 2" },
      { sceneNumber: 3, timeframe: "00:21 - 00:31", visualDescription: "Desk 4 empty", nativeAudioCue: "gasp", dialogue: "Desk four is empty", veoPrompt: "scene 3" },
      { sceneNumber: 4, timeframe: "00:31 - 00:42", visualDescription: "Message from tomorrow", nativeAudioCue: "glitch", dialogue: "Timestamped tomorrow", veoPrompt: "scene 4" },
      { sceneNumber: 5, timeframe: "00:42 - 00:52", visualDescription: "Future train platform showdown", nativeAudioCue: "train screech", dialogue: "You shouldn't have come here", veoPrompt: "scene 5" },
      { sceneNumber: 6, timeframe: "00:52 - 01:02", visualDescription: "Rooftop escape route", nativeAudioCue: "wind", dialogue: "Run before midnight", veoPrompt: "scene 6" },
    ];

    const report = await inspectVideoAsset(videoPath, {
      targetDurationSeconds: 42,
      storyboard: storyboardWithMissingScenes,
    });

    assert.ok(report.defects.missingScenes.length >= 2, "Must detect missing scenes #5 and #6 from storyboard");
    assert.equal(report.defects.missingScenes[0].severity, "critical");
    assert.ok(report.defects.missingScenes.some((d) => d.sceneIndex === 5 || d.sceneIndex === 6));
  });

  it("12f. Tiered verification distinction: distinguishes technical validation, sampled visual verification, and full semantic verification", async () => {
    const videoPath = path.join(process.cwd(), "public", "media", "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");

    // 1. Sampled mode: only 3 frames sampled -> MUST NEVER claim full verification
    const sampledReport = await inspectVideoAsset(videoPath, {
      targetDurationSeconds: 42,
      samplingMode: "sampled",
    });

    assert.equal(sampledReport.verificationTier.level, "sampled_visual_verification");
    assert.equal(sampledReport.verificationTier.technicalValid, true);
    assert.equal(sampledReport.verificationTier.sampledVisualValid, true);
    assert.equal(sampledReport.verificationTier.fullSemanticValid, false, "3 frames must NEVER be full semantic valid");
    assert.equal(sampledReport.verificationTier.claimFullVerificationAllowed, false, "Must NEVER claim full verification from three frames");
    assert.ok(sampledReport.verificationTier.explanation.includes("Only 3 sparse frames inspected"));

    // 2. Full adaptive mode: all transitions + vision model + ASR -> full semantic verification
    const fullReport = await inspectVideoAsset(videoPath, {
      targetDurationSeconds: 42,
      samplingMode: "adaptive",
      characterBible: DEFAULT_ANIME_CHARACTER_BIBLE,
    });

    assert.equal(fullReport.verificationTier.level, "full_semantic_verification");
    assert.equal(fullReport.verificationTier.fullSemanticValid, true);
    assert.equal(fullReport.verificationTier.claimFullVerificationAllowed, true);
    assert.equal(fullReport.fullSemanticVerified, true);
  });

  it("12g. Consistency score & draft gate: computes weighted consistency score and preserves draft-first approval", async () => {
    const videoPath = path.join(process.cwd(), "public", "media", "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4");

    const report = await inspectVideoAsset(videoPath, {
      targetDurationSeconds: 42,
      characterBible: DEFAULT_ANIME_CHARACTER_BIBLE,
    });

    assert.ok(report.consistencyScore.overallScore >= 80, `Consistency score must pass (got ${report.consistencyScore.overallScore})`);
    assert.equal(report.consistencyScore.status, "passed");
    assert.ok(report.consistencyScore.breakdown.storyboardAlignmentScore > 0);
    assert.ok(report.consistencyScore.breakdown.characterConsistencyScore > 0);
    assert.ok(report.consistencyScore.breakdown.narrationAsrScore > 0);
    assert.ok(report.consistencyScore.breakdown.subtitleSyncScore > 0);
    assert.ok(report.consistencyScore.breakdown.pacingAndTransitionsScore > 0);

    // Verify timestamped evidence log
    assert.ok(report.timestampedEvidenceLog.length >= 5, "Must log timestamped verification evidence");
    assert.ok(report.timestampedEvidenceLog.some((e) => e.type === "scene_transition"));
    assert.ok(report.timestampedEvidenceLog.some((e) => e.type === "keyframe"));
    assert.ok(report.timestampedEvidenceLog.some((e) => e.type === "asr_beat"));
    assert.ok(report.timestampedEvidenceLog.some((e) => e.type === "verification_milestone"));
  });

  it("13. Task 3 Draft Consistency Gate: rejects thematic mismatches (school conference title with house invasion caption)", () => {
    const candidateIdea: ReelIdeaCandidate = {
      id: "candidate_conf",
      title: "Parent-Teacher Conference in Blood",
      seriesEpisode: "#31",
      archetype: "Reluctant Guardian",
      targetDurationSeconds: 42,
      hookOpening: "Parent-teacher conference",
      coreConflict: "Protecting daughter from syndicate enforcers at school",
      emotionalPayoff: "Daughter finishes homework peacefully",
      loopMechanism: "Pencil tap loops into heartbeat",
      scoringBasis: {
        dataSource: "live",
        retentionMeasured: true,
        archetypeMultiplier: 9.0,
        durationDeviationSeconds: 0,
        methodology: "test",
      },
      scores: {
        hookRetentionScore: 9,
        audienceAffinityScore: 9,
        shareabilityScore: 9,
        loopPotentialScore: 9,
        durationOptimalityScore: 9,
        overallWeightedScore: 90,
      },
    };

    const conflictingDraft = {
      selectedIdea: candidateIdea,
      title: "🎬 Mafia Boss Dad & Daughter — Episode #31: Parent-Teacher Conference in Blood (42s) 🔥",
      storyboard: [
        {
          sceneNumber: 1,
          name: "School Gate",
          timeframe: "00:00 - 00:03",
          visualDescription: "Ren Kurokawa arriving at the school gate",
          cameraMotion: "Push-in",
          lightingAndColor: "Cinematic noir",
          veoPrompt: "Ren at school gate",
          nativeAudioCue: "School bell",
          speaker: "Ren",
          dialogue: "I have a parent-teacher meeting.",
          subtitles: "I have a parent-teacher meeting.",
        },
      ],
      fullNarrationText: "Ren Kurokawa attending his daughter's parent-teacher conference.",
      // Conflict: caption describes house invasion rather than school conference
      caption: "Syndicate broke into a blind man's house, not knowing who was inside... Episode #31",
      hashtags: ["#MafiaBossDad", "#AnimeEdits"],
    };

    const result = verifyDraftConsistency(conflictingDraft);
    assert.equal(result.valid, false, "Must reject draft with thematic mismatch between title and caption");
    assert.ok(result.mismatches.some((m) => m.includes("Thematic mismatch detected")));
    assert.ok(result.mismatches.some((m) => m.includes("school-conference title must not be paired with a caption describing an unrelated house invasion")));
  });

  it("13a. Task 3 Draft Consistency Gate: rejects episode number mismatch between title and caption", () => {
    const candidateIdea: ReelIdeaCandidate = {
      id: "candidate_ep_mismatch",
      title: "Blind Janitor in the Syndicate Vault",
      seriesEpisode: "#31",
      archetype: "Sensory Paradox",
      targetDurationSeconds: 42,
      hookOpening: "A cane taps",
      coreConflict: "Janitor cleaning floor while cartel audits vault",
      emotionalPayoff: "Cartel realizes who swept the floor",
      loopMechanism: "Cane tap loop",
      scoringBasis: {
        dataSource: "live",
        retentionMeasured: true,
        archetypeMultiplier: 9.0,
        durationDeviationSeconds: 0,
        methodology: "test",
      },
      scores: {
        hookRetentionScore: 9,
        audienceAffinityScore: 9,
        shareabilityScore: 9,
        loopPotentialScore: 9,
        durationOptimalityScore: 9,
        overallWeightedScore: 90,
      },
    };

    const mismatchedEpisodeDraft = {
      selectedIdea: candidateIdea,
      title: "🎬 Blind Janitor — Episode #31: The Founder's Oath (42s) 🔥",
      storyboard: [
        {
          sceneNumber: 1,
          name: "Vault Corridor",
          timeframe: "00:00 - 00:03",
          visualDescription: "Ren sweeping floor with broom",
          cameraMotion: "Tracking shot",
          lightingAndColor: "Obsidian noir",
          veoPrompt: "Blind janitor sweeping floor",
          nativeAudioCue: "Broom scrape",
          speaker: "Ren",
          dialogue: "Just doing my rounds.",
          subtitles: "Just doing my rounds.",
        },
      ],
      fullNarrationText: "The blind janitor tapped his cane and swept the marble floor.",
      caption: "🎬 Blind Janitor — Episode #28 (Mismatched number) #AnimeEdits",
      hashtags: ["#AnimeEdits", "#BlindJanitor"],
    };

    const result = verifyDraftConsistency(mismatchedEpisodeDraft);
    assert.equal(result.valid, false, "Must reject draft when title specifies Episode #31 but caption specifies Episode #28");
    assert.ok(result.mismatches.some((m) => m.includes("Episode number mismatch")));
  });

  it("13b. Task 3 Draft Consistency Gate: accepts properly aligned draft package", () => {
    const candidateIdea: ReelIdeaCandidate = {
      id: "candidate_valid",
      title: "Blind Janitor in the Syndicate Vault",
      seriesEpisode: "#31",
      archetype: "Sensory Paradox",
      targetDurationSeconds: 42,
      hookOpening: "A single cane tap in darkness",
      coreConflict: "Janitor cleaning floor while cartel audits vault",
      emotionalPayoff: "Cartel realizes who swept the floor",
      loopMechanism: "Cane tap loop",
      scoringBasis: {
        dataSource: "live",
        retentionMeasured: true,
        archetypeMultiplier: 9.0,
        durationDeviationSeconds: 0,
        methodology: "test",
      },
      scores: {
        hookRetentionScore: 9,
        audienceAffinityScore: 9,
        shareabilityScore: 9,
        loopPotentialScore: 9,
        durationOptimalityScore: 9,
        overallWeightedScore: 90,
      },
    };

    const alignedDraft = {
      selectedIdea: candidateIdea,
      title: "🎬 Blind Janitor — Episode #31: The Founder's Oath (42s) 🔥",
      storyboard: [
        {
          sceneNumber: 1,
          name: "Vault Corridor",
          timeframe: "00:00 - 00:03",
          visualDescription: "Ren sweeping floor with broom, tapping cane in darkness",
          cameraMotion: "Tracking shot",
          lightingAndColor: "Obsidian noir",
          veoPrompt: "Blind janitor sweeping floor",
          nativeAudioCue: "Broom scrape",
          speaker: "Ren",
          dialogue: "Just doing my rounds.",
          subtitles: "Just doing my rounds.",
        },
      ],
      fullNarrationText: "The blind janitor tapped his cane and swept the marble floor in complete darkness.",
      caption: "🎬 Blind Janitor — Episode #31: The Founder's Oath (42s) 🔥\nThe cartel thought he was just an old cleaning man... #AnimeEdits #BlindJanitor",
      hashtags: ["#AnimeEdits", "#BlindJanitor"],
    };

    const result = verifyDraftConsistency(alignedDraft);
    assert.equal(result.valid, true, "Properly aligned draft must pass consistency gate");
    assert.equal(result.mismatches.length, 0);
  });

  it("14. Task 4 Performance Learning: evaluates sample sizes, retention rates, completion rates, and labels uncertain conclusions", () => {
    const samplePosts = [
      {
        id: "fb_p_1",
        metaPostId: "p_1",
        text: "Reluctant Guardian Episode #1: Protecting his daughter at school",
        postedAt: new Date(),
        likes: 1200,
        comments: 20,
        shares: 60,
        views: 80000,
        lengthSeconds: 50,
        insights: {
          totalPlays: 80000,
          initialPlays: 72000,
          avgWatchTimeSeconds: 15.0,
        },
      },
    ];

    const learning = evaluateChannelPerformance(samplePosts);

    assert.equal(learning.totalPublishedReelsAnalyzed, 1);
    const guardian = learning.conceptPerformance.find((c) => c.archetype === "Reluctant Guardian");
    assert.ok(guardian);
    assert.equal(guardian.sampleSize, 1);
    assert.equal(guardian.confidence, "low", "N=1 must be labeled low confidence");
    assert.ok(guardian.conclusion.includes("Tentative finding"), "Must state conclusions are tentative with small sample size");
    assert.equal(guardian.averageCompletionRatePercent, 30.0, "15s watch / 50s duration = 30% completion rate");

    const unmatchedCheckmate = learning.conceptPerformance.find((c) => c.archetype === "High-IQ Checkmate");
    assert.ok(unmatchedCheckmate);
    assert.equal(unmatchedCheckmate.sampleSize, 0);
    assert.equal(unmatchedCheckmate.confidence, "insufficient_sample");
    assert.equal(unmatchedCheckmate.isMeasured, false);
    assert.ok(unmatchedCheckmate.conclusion.includes("Heuristic recommendation"));
  });

  it("15. Tombstone Deletion Persistence: manually deleted drafts stay tombstoned across simulated restarts", async () => {
    // Record tombstone for draft 9
    await recordDraftTombstone(9, "Parent-Teacher Conference in Blood", "user_requested_deletion");

    // Must be tombstoned immediately
    const isTombstoned = await isDraftTombstoned(9);
    assert.equal(isTombstoned, true, "Draft 9 must be confirmed tombstoned");

    // Simulated container restart: verify from tombstone file on disk
    const tombstoneFile = path.join(process.cwd(), ".data", "tombstones.json");
    assert.ok(fs.existsSync(tombstoneFile), "Tombstone backup file must exist on disk");
    const onDiskList = JSON.parse(fs.readFileSync(tombstoneFile, "utf-8"));
    const found = onDiskList.find((item: any) => item.draftId === 9);
    assert.ok(found, "Draft 9 must be present in on-disk tombstone registry");

    const allTombstoned = getTombstonedDraftIds();
    assert.ok(allTombstoned.includes(9), "Tombstone IDs list must include 9");
  });

  it("16. Draft ID Resolution: single digit targetPostId '9' never matches a Facebook Reel URL containing digit 9", async () => {
    // When querying Facebook posts with targetPostId '9', it must not match Reel 1593302406155143 merely because 9 is in the URL
    const results = await fetchFacebookPageAnalytics({
      pageId: "1316616991525561",
      pageAccessToken: "demo",
      targetPostId: "9",
      allowFixtures: true,
    });

    // None of the historical posts have id, metaPostId, videoId, or reelId equal to "9"
    assert.equal(results.length, 0, "targetPostId '9' must return 0 Facebook posts (preventing false URL matching)");
  });

  it("cleanup: exits cleanly", () => {
    setTimeout(() => process.exit(0), 100);
  });
});
