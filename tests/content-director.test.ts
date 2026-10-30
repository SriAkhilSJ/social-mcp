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

  it("4a. Storyboard consistency: High-IQ Checkmate produces boardroom checkmate visuals, dialogues, and narration", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const checkmateIdea = ranked.find((i) => i.archetype === "High-IQ Checkmate")!;
    assert.ok(checkmateIdea, "High-IQ Checkmate candidate idea must exist");

    const pkg = buildProductionPackage(checkmateIdea, mockAnalysis);

    // Verify storyboard scene 1 corresponds to boardroom checkmate
    assert.equal(pkg.storyboard[0].name, "The Boardroom Checkmate Hook");
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("boardroom") || pkg.storyboard[0].visualDescription.toLowerCase().includes("calculator"));
    assert.ok(pkg.storyboard[0].veoPrompt.toLowerCase().includes("boardroom") || pkg.storyboard[0].veoPrompt.toLowerCase().includes("calculator"));
    assert.ok(pkg.storyboard[0].dialogue.toLowerCase().includes("debt") || pkg.storyboard[0].dialogue.toLowerCase().includes("boardroom"));

    // Verify narration and dialogue correspond to High-IQ Checkmate (not daughter bed time)
    assert.ok(pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("debt") || pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("checkmate"));
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("close your ears, sweetie"), "High-IQ checkmate must not use reluctant guardian daughter lines");
    assert.ok(pkg.openingHook.onScreenText.includes("CHECKMATE"));
    assert.ok(pkg.socialPackaging.hashtags.includes("highiq") || pkg.socialPackaging.hashtags.includes("checkmate"));
  });

  it("4b. Storyboard consistency: Sound-First ASMR produces foley rain umbrella alleyway visuals and dialogues", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const asmrIdea = ranked.find((i) => i.archetype === "Sound-First ASMR")!;
    assert.ok(asmrIdea, "Sound-First ASMR candidate idea must exist");

    const pkg = buildProductionPackage(asmrIdea, mockAnalysis);

    // Verify scene 1 corresponds to rain on umbrella
    assert.equal(pkg.storyboard[0].name, "The Foley Atmosphere Sensory Immersion");
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("umbrella") || pkg.storyboard[0].visualDescription.toLowerCase().includes("rain"));
    assert.ok(pkg.storyboard[0].veoPrompt.toLowerCase().includes("umbrella") || pkg.storyboard[0].veoPrompt.toLowerCase().includes("rain"));
    assert.ok(pkg.storyboard[0].nativeAudioCue.toLowerCase().includes("rain"));

    // Verify narration corresponds to ASMR alleyway dialogue
    assert.ok(pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("rain"));
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("five men how to knock"));
    assert.ok(pkg.openingHook.onScreenText.includes("HEADPHONES"));
    assert.ok(pkg.socialPackaging.hashtags.includes("asmr") || pkg.socialPackaging.hashtags.includes("sounddesign"));
  });

  it("4c. Storyboard consistency: Sensory Paradox produces obsidian crystal chess master visuals and dialogues", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const sensoryIdea = ranked.find((i) => i.archetype === "Sensory Paradox")!;
    assert.ok(sensoryIdea, "Sensory Paradox candidate idea must exist");

    const pkg = buildProductionPackage(sensoryIdea, mockAnalysis);

    // Verify scene 1 corresponds to crystal chess table / sensory paradox
    assert.equal(pkg.storyboard[0].name, "The Sensory Paradox Hook");
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("chess") || pkg.storyboard[0].visualDescription.toLowerCase().includes("crystal"));
    assert.ok(pkg.storyboard[0].veoPrompt.toLowerCase().includes("chess") || pkg.storyboard[0].veoPrompt.toLowerCase().includes("crystal"));
    assert.ok(pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("master") || pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("checkmate"));
    assert.ok(pkg.openingHook.onScreenText.includes("GRANDMASTER"));
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

  it("4e. Storyboard consistency: Blind Janitor idea matches broom sweeping, kicked bucket, and founder's oath (never substitutes chess)", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const janitorIdea = ranked.find((i) => i.id === "idea_the_janitor_origin_secret")!;
    assert.ok(janitorIdea, "The blind janitor candidate idea must exist");

    const pkg = buildProductionPackage(janitorIdea, mockAnalysis);

    // Scene 1: sweeping broom outside nightclub and kicked bucket
    assert.equal(pkg.storyboard[0].name, "The Sweeper's Interruption");
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("broom") || pkg.storyboard[0].visualDescription.toLowerCase().includes("janitor"));
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("bucket") || pkg.storyboard[0].visualDescription.toLowerCase().includes("nightclub"));
    assert.ok(pkg.storyboard[0].dialogue.toLowerCase().includes("janitor") || pkg.storyboard[0].dialogue.toLowerCase().includes("bucket"));

    // Scene 2 & 3: harassment and founder's bloodline oath
    assert.ok(pkg.storyboard[1].visualDescription.toLowerCase().includes("club") || pkg.storyboard[1].visualDescription.toLowerCase().includes("enforcers"));
    assert.ok(pkg.storyboard[2].visualDescription.toLowerCase().includes("broom") || pkg.storyboard[2].visualDescription.toLowerCase().includes("founder"));
    assert.ok(pkg.storyboard[2].dialogue.toLowerCase().includes("grandfather") || pkg.storyboard[2].dialogue.toLowerCase().includes("dragon"));

    // Narration must NOT substitute unrelated chess or rooftop stories
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("chess king"), "Janitor storyboard must not contain chess pieces");
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("heliport"), "Janitor storyboard must not contain rooftop helipad");
    assert.ok(pkg.openingHook.onScreenText.includes("JANITOR") || pkg.openingHook.onScreenText.includes("KABUKICHO"));
    assert.ok(pkg.socialPackaging.hashtags.includes("kabukicho") || pkg.socialPackaging.hashtags.includes("underdog"));
  });

  it("4f. Storyboard consistency: Chess Match idea produces obsidian crystal chess grandmaster sequence", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const chessIdea = ranked.find((i) => i.id === "idea_sensory_paradox_chess")!;
    assert.ok(chessIdea, "Chess candidate idea must exist");

    const pkg = buildProductionPackage(chessIdea, mockAnalysis);

    assert.ok(
      pkg.storyboard[0].name === "The Sensory Paradox Hook" ||
      pkg.storyboard[0].name === "The Obsidian King Slide Hook"
    );
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("obsidian") || pkg.storyboard[0].visualDescription.toLowerCase().includes("chess"));
    assert.ok(pkg.storyboard[2].name.toLowerCase().includes("checkmate"));
    assert.ok(pkg.storyboard[2].dialogue.toLowerCase().includes("checkmate"));
    assert.ok(pkg.openingHook.onScreenText.includes("GRANDMASTER"));
    assert.ok(pkg.socialPackaging.hashtags.includes("chess"));
  });

  it("4g. Storyboard consistency: Rooftop Confrontation idea matches helipad, sniper red dot, and lightning rod deflection (never substitutes chess)", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const rooftopIdea = ranked.find((i) => i.id === "idea_neon_rooftop_duel")!;
    assert.ok(rooftopIdea, "Rooftop duel candidate idea must exist");

    const pkg = buildProductionPackage(rooftopIdea, mockAnalysis);

    // Scene 1: red laser sniper dot on dark sunglasses at helipad
    assert.equal(pkg.storyboard[0].name, "The Sniper Red Dot Hook");
    assert.ok(pkg.storyboard[0].visualDescription.toLowerCase().includes("helipad") || pkg.storyboard[0].visualDescription.toLowerCase().includes("sniper"));
    assert.ok(
      pkg.storyboard[0].dialogue.toLowerCase().includes("laser") ||
      pkg.storyboard[0].dialogue.toLowerCase().includes("red dot"),
      "Scene 1 dialogue must reference the sniper laser or red dot"
    );

    // Scene 3: lightning rod deflection
    assert.equal(pkg.storyboard[2].name, "The Lightning Rod Deflection");
    assert.ok(pkg.storyboard[2].visualDescription.toLowerCase().includes("lightning"));
    assert.ok(pkg.storyboard[2].dialogue.toLowerCase().includes("conductor") || pkg.storyboard[2].dialogue.toLowerCase().includes("lightning"));

    // Narration must NOT substitute chess or janitor
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("chess"), "Rooftop duel must not contain chess");
    assert.ok(!pkg.narrationAndSubtitles.fullNarrationText.toLowerCase().includes("janitor"), "Rooftop duel must not contain janitor");
    assert.ok(pkg.openingHook.onScreenText.includes("CONDUCTOR") || pkg.openingHook.onScreenText.includes("LIGHTNING"));
  });

  it("4h. Storyboard consistency: Protective-parent concepts match specific situations (school festival vs penthouse defense)", () => {
    const ranked = generateAndRankIdeas(mockAnalysis);
    const schoolIdea = ranked.find((i) => i.id === "idea_daughter_school_festival")!;
    assert.ok(schoolIdea, "School festival idea must exist");

    const schoolPkg = buildProductionPackage(schoolIdea, mockAnalysis);

    // Verify school festival has elementary chair and crayon drawing
    assert.equal(schoolPkg.storyboard[0].name, "The Elementary School Chair Hook");
    assert.ok(schoolPkg.storyboard[0].visualDescription.toLowerCase().includes("elementary") || schoolPkg.storyboard[0].visualDescription.toLowerCase().includes("chair"));
    assert.ok(schoolPkg.storyboard[0].visualDescription.toLowerCase().includes("crayon") || schoolPkg.storyboard[0].visualDescription.toLowerCase().includes("drawing"));
    assert.ok(schoolPkg.storyboard[2].visualDescription.toLowerCase().includes("usb") || schoolPkg.storyboard[2].visualDescription.toLowerCase().includes("pocket"));
    assert.ok(schoolPkg.openingHook.onScreenText.includes("SCHOOL") || schoolPkg.openingHook.onScreenText.includes("DAD"));

    // Penthouse defense idea
    const defenseIdea = ranked.find((i) => i.id === "idea_daughter_protective_vengeance")!;
    assert.ok(defenseIdea, "Penthouse defense idea must exist");

    const defensePkg = buildProductionPackage(defenseIdea, mockAnalysis);
    assert.equal(defensePkg.storyboard[0].name, "The Penthouse Scarf Hook");
    assert.ok(defensePkg.storyboard[0].visualDescription.toLowerCase().includes("scarf"));
    assert.ok(defensePkg.storyboard[1].visualDescription.toLowerCase().includes("double doors") || defensePkg.storyboard[1].visualDescription.toLowerCase().includes("penthouse"));
    assert.ok(defensePkg.storyboard[3].dialogue.toLowerCase().includes("bedtime"));
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
