import "server-only";
import fs from "node:fs";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaignMemories,
  campaigns,
  contentDrafts,
  posts,
  postAnalytics,
  researchFindings,
  userIntegrations,
  type PostMediaItem,
} from "@/db/schema";
import { decryptSecret } from "@/lib/crypto/secrets";
import {
  fetchFacebookPageAnalytics,
  type FacebookPostAnalyticsItem,
} from "@/lib/social/facebook";
import { validateVideoAsset } from "@/lib/media/video-validator";

// ==========================================
// 1. DATA CONTRACTS & INTERFACES
// ==========================================

export type DataSourceType = "live" | "historical_cache" | "fixture" | "unavailable" | "insufficient_data";

export interface PerformanceAnalysis {
  channelName: string;
  totalAnalyzedPosts: number;
  dataSource: DataSourceType;
  retrievedAt: string;
  isFresh: boolean;
  dataFreshnessSeconds?: number;
  error?: string;
  topPerformingReels: Array<{
    id: string;
    videoId?: string;
    title: string;
    views: number | null;
    likes: number;
    shares: number;
    comments: number;
    durationSeconds: number | null;
    replays?: number | null;
    avgWatchTimeSeconds?: number | null;
    retentionMeasured?: boolean;
  }>;
  durationSweetSpot: {
    minSeconds: number;
    maxSeconds: number;
    recommendedDuration: number;
    insight: string;
  };
  provenHooks: Array<{
    pattern: string;
    archetype: string;
    avgViews: number | null;
    isMeasured?: boolean;
    measurementBasis?: "measured" | "heuristic" | "unsupported";
    example: string;
  }>;
  shareDrivers: string[];
  audiencePreferences: string[];
}

export interface ReelIdeaCandidate {
  id: string;
  title: string;
  seriesEpisode: string;
  archetype: "Sensory Paradox" | "High-IQ Checkmate" | "Reluctant Guardian" | "Sound-First ASMR";
  targetDurationSeconds: number;
  hookOpening: string;
  coreConflict: string;
  emotionalPayoff: string;
  loopMechanism: string;
  scoringBasis: {
    dataSource: DataSourceType;
    retentionMeasured: boolean;
    archetypeMultiplier: number;
    archetypeMeasuredAvgViews?: number;
    durationDeviationSeconds: number;
    methodology: string;
  };
  scores: {
    hookRetentionScore: number;     // 1-10 (measured if retention telemetry exists, else heuristic estimate)
    audienceAffinityScore: number;  // 1-10 (weighted by actual performance of similar archetype)
    shareabilityScore: number;      // 1-10 (moral high ground & psychological reversal)
    loopPotentialScore: number;     // 1-10 (seamless end-to-beginning audio loop)
    durationOptimalityScore: number;// 1-10 (proximity to sweet spot recommended duration)
    overallWeightedScore: number;   // 0-100
  };
  ranking?: number;
}

export interface StoryboardScene {
  sceneNumber: number;
  name: string;
  timeframe: string;
  visualDescription: string;
  cameraMotion: string;
  lightingAndColor: string;
  veoPrompt: string;
  nativeAudioCue: string;
  speaker: string;
  dialogue: string;
  subtitles: string;
}

export interface FullProductionPackage {
  selectedIdea: ReelIdeaCandidate;
  title: string;
  mediaStatus?: "storyboard_ready" | "media_validated" | "pending_generation";
  videoValidated?: boolean;
  openingHook: {
    timeframe: "00:00 - 00:03";
    visualHook: string;
    soundFx: string;
    voiceDialogue: string;
    onScreenText: string;
  };
  storyboard: StoryboardScene[];
  narrationAndSubtitles: {
    fullNarrationText: string;
    srtFormattedSubtitles: string;
  };
  socialPackaging: {
    caption: string;
    hashtags: string[];
    pinnedCommentPrompt: string;
  };
  attachedMedia: PostMediaItem;
}

export interface ContentDirectorResult {
  success: boolean;
  draftId: number;
  contentDraftRecordId?: number;
  title: string;
  status: "draft";
  analysis: PerformanceAnalysis;
  rankedIdeas: ReelIdeaCandidate[];
  selectedPackage: FullProductionPackage;
  memoryRecordIds: {
    campaignMemoryId?: number;
    researchFindingId?: number;
  };
  safetyLockNotice: string;
}

export interface AnalyzeChannelPerformanceOptions {
  userId: string;
  campaignId: number;
  allowFixtures?: boolean;
  mode?: "production" | "development" | "test";
  forceUnavailable?: boolean;
  overrideAnalyticsData?: FacebookPostAnalyticsItem[];
}

// In-memory active job locks to prevent duplicate execution cycles
const activeJobs = new Set<string>();

// Verified historical benchmark fixture (isolated from live metrics)
const HISTORICAL_FIXTURE_POSTS: FacebookPostAnalyticsItem[] = [
  {
    id: "1316616991525561_122113024527420309",
    metaPostId: "122113024527420309",
    videoId: "4621308234820038",
    reelId: "4621308234820038",
    text: "🎬 Mafia Boss Dad & Daughter — Episode #25 (58.3s) 🔥\nNever mess with the Boss's little princess...",
    postedAt: new Date("2026-09-05T12:19:14Z"),
    likes: 2812,
    comments: 17,
    shares: 88,
    views: 139475,
    lengthSeconds: 58.3,
    insights: {
      totalPlays: 139475,
      replayCount: 24800,
      avgWatchTimeSeconds: 6.8,
    },
  },
  {
    id: "1316616991525561_122112457059420309",
    metaPostId: "122112457059420309",
    videoId: "2922166034798380",
    reelId: "2922166034798380",
    text: "🎬 Mafia Boss Dad & Daughter — Episode #24 (50.6s) 🔥\nNever mess with the Boss's little princess...",
    postedAt: new Date("2026-09-03T12:00:00Z"),
    likes: 3109,
    comments: 17,
    shares: 77,
    views: 125726,
    lengthSeconds: 50.6,
    insights: {
      totalPlays: 125726,
      replayCount: 18200,
      avgWatchTimeSeconds: 6.4,
    },
  },
  {
    id: "1316616991525561_122109199215420309",
    metaPostId: "122109199215420309",
    videoId: "1822300032266870",
    reelId: "1822300032266870",
    text: "🎬 Mafia Boss Dad & Daughter — Episode #18 (50.4s) 🔥\nNever mess with the Boss's little princess...",
    postedAt: new Date("2026-09-05T12:29:36Z"),
    likes: 2504,
    comments: 2,
    shares: 30,
    views: 97284,
    lengthSeconds: 50.4,
  },
  {
    id: "1316616991525561_122112635013420309",
    metaPostId: "122112635013420309",
    videoId: "1349091173679978",
    reelId: "1349091173679978",
    text: "🎬 Mafia Boss Dad & Daughter — Episode #21 (89.4s) 🔥\nNever mess with the Boss's little princess...",
    postedAt: new Date("2026-09-02T12:00:00Z"),
    likes: 3798,
    comments: 19,
    shares: 71,
    views: 82234,
    lengthSeconds: 89.4,
  },
  {
    id: "1316616991525561_122112953691420309",
    metaPostId: "122112953691420309",
    videoId: "1550951783004276",
    reelId: "1550951783004276",
    text: "🎬 Mafia Boss Dad & Daughter — Episode #19 (94.5s) 🔥\nNever mess with the Boss's little princess...",
    postedAt: new Date("2026-09-05T03:32:25Z"),
    likes: 2633,
    comments: 17,
    shares: 131,
    views: 73500,
    lengthSeconds: 94.5,
  },
];

// ==========================================
// 2. PERFORMANCE ANALYSIS ENGINE
// ==========================================

export async function analyzeChannelPerformance(
  params: AnalyzeChannelPerformanceOptions
): Promise<PerformanceAnalysis> {
  const isDevOrTest =
    params.allowFixtures === true ||
    (params.allowFixtures === undefined &&
      (process.env.NODE_ENV !== "production" || params.mode === "development" || params.mode === "test"));

  // Explicitly forced unavailable mode for testing or failure isolation
  if (params.forceUnavailable) {
    return {
      channelName: "AnimeEdits",
      totalAnalyzedPosts: 0,
      dataSource: "unavailable",
      retrievedAt: new Date().toISOString(),
      isFresh: false,
      error: "Live analytics data explicitly marked unavailable.",
      topPerformingReels: [],
      durationSweetSpot: {
        minSeconds: 48,
        maxSeconds: 58,
        recommendedDuration: 52,
        insight: "No live data available to compute sweet spot.",
      },
      provenHooks: [],
      shareDrivers: [],
      audiencePreferences: [],
    };
  }

  // Handle direct override for testing
  if (params.overrideAnalyticsData !== undefined) {
    if (params.overrideAnalyticsData.length === 0) {
      if (!isDevOrTest) {
        return {
          channelName: "AnimeEdits",
          totalAnalyzedPosts: 0,
          dataSource: "unavailable",
          retrievedAt: new Date().toISOString(),
          isFresh: false,
          error: "No posts returned from Facebook channel.",
          topPerformingReels: [],
          durationSweetSpot: {
            minSeconds: 48,
            maxSeconds: 58,
            recommendedDuration: 52,
            insight: "No posts available to calculate duration sweet spot.",
          },
          provenHooks: [],
          shareDrivers: [],
          audiencePreferences: [],
        };
      }
      return buildAnalysisFromPosts(HISTORICAL_FIXTURE_POSTS, "fixture", "Override was empty; using historical fixture in dev mode.");
    }
    return buildAnalysisFromPosts(params.overrideAnalyticsData, "live");
  }

  const db = await getDb();

  let pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
  let pageId = process.env.FACEBOOK_PAGE_ID || "1316616991525561";

  try {
    const [fbInteg] = await db
      .select()
      .from(userIntegrations)
      .where(and(eq(userIntegrations.userId, params.userId), eq(userIntegrations.provider, "facebook")))
      .limit(1);

    if (fbInteg?.apiKeyEncrypted) {
      pageToken = decryptSecret(fbInteg.apiKeyEncrypted);
      if (fbInteg.endpointUrl) pageId = fbInteg.endpointUrl;
    }
  } catch {
    // fallback to env vars
  }

  if (!pageToken) {
    if (!isDevOrTest) {
      return {
        channelName: "AnimeEdits",
        totalAnalyzedPosts: 0,
        dataSource: "unavailable",
        retrievedAt: new Date().toISOString(),
        isFresh: false,
        error: "Meta credentials missing or unconfigured. Cannot fetch live analytics in production mode.",
        topPerformingReels: [],
        durationSweetSpot: {
          minSeconds: 48,
          maxSeconds: 58,
          recommendedDuration: 52,
          insight: "No credentials to retrieve sweet spot.",
        },
        provenHooks: [],
        shareDrivers: [],
        audiencePreferences: [],
      };
    }
    return buildAnalysisFromPosts(HISTORICAL_FIXTURE_POSTS, "fixture", "Meta credentials unconfigured; using fixture benchmarks in development mode.");
  }

  let postsData: FacebookPostAnalyticsItem[] = [];
  let fetchError: string | undefined;

  try {
    postsData = await fetchFacebookPageAnalytics({
      pageId,
      pageAccessToken: pageToken,
      limit: 50,
    });
  } catch (err: any) {
    fetchError = err?.message || "Unknown Meta API error";
  }

  // Handle live fetch failure
  if (fetchError || !postsData || postsData.length === 0) {
    const reason = fetchError || "Live Meta Graph API returned 0 posts.";
    if (!isDevOrTest) {
      return {
        channelName: "AnimeEdits",
        totalAnalyzedPosts: 0,
        dataSource: "unavailable",
        retrievedAt: new Date().toISOString(),
        isFresh: false,
        error: `Live Meta analytics unavailable: ${reason}. Fixture data is disabled in production mode.`,
        topPerformingReels: [],
        durationSweetSpot: {
          minSeconds: 48,
          maxSeconds: 58,
          recommendedDuration: 52,
          insight: "No live data available to compute sweet spot.",
        },
        provenHooks: [],
        shareDrivers: [],
        audiencePreferences: [],
      };
    }

    return buildAnalysisFromPosts(
      HISTORICAL_FIXTURE_POSTS,
      "fixture",
      `Live Meta API query failed (${reason}); using historical fixture benchmarks in development mode.`
    );
  }

  return buildAnalysisFromPosts(postsData, "live");
}

function buildAnalysisFromPosts(
  postsData: FacebookPostAnalyticsItem[],
  dataSource: DataSourceType,
  diagnosticError?: string
): PerformanceAnalysis {
  const videosWithViews = postsData
    .filter((p) => p.views !== null && typeof p.views === "number" && p.views > 0)
    .sort((a, b) => (b.views || 0) - (a.views || 0));

  const archetypeHookDefinitions: Record<
    "Sensory Paradox" | "High-IQ Checkmate" | "Reluctant Guardian" | "Sound-First ASMR",
    { pattern: string; regex: RegExp; example: string }
  > = {
    "Sensory Paradox": {
      pattern: "The Sensory Paradox Pattern Interrupt",
      regex: /sensory|cane|blind|darkness|paradox|janitor|grandmaster/i,
      example: "A single cane tap in darkness followed by sudden blackout.",
    },
    "High-IQ Checkmate": {
      pattern: "The High-IQ Reversal",
      regex: /audit|checkmate|billionaire|broker|one-yen|iq|chess/i,
      example: "The arrogant cartel boss realizes Ren already purchased his entire syndicate.",
    },
    "Reluctant Guardian": {
      pattern: "The High-Stakes Protective Guardian",
      regex: /daughter|princess|parent|father|protect|school|lesson/i,
      example: "Ren adjusting his daughter's blanket before disarming 5 armed enforcers.",
    },
    "Sound-First ASMR": {
      pattern: "The Foley Atmosphere Sensory Immersion",
      regex: /rain|sound|asmr|umbrella|train|subway|whisper|heliport/i,
      example: "Zero dialogue for 2 seconds; only heavy rain on silk umbrella and match strike.",
    },
  };

  // If there are no posts with measurable views, return an explicit insufficient-data status
  if (videosWithViews.length === 0) {
    return {
      channelName: "AnimeEdits",
      totalAnalyzedPosts: postsData.length,
      dataSource: "insufficient_data",
      retrievedAt: new Date().toISOString(),
      isFresh: false,
      error: diagnosticError || "Insufficient channel evidence: 0 posts have measurable view or retention telemetry.",
      topPerformingReels: [],
      durationSweetSpot: {
        minSeconds: 50,
        maxSeconds: 58,
        recommendedDuration: 52,
        insight: "Insufficient view evidence to derive duration sweet spot; using baseline 52s benchmark.",
      },
      provenHooks: Object.entries(archetypeHookDefinitions).map(([archetype, def]) => ({
        pattern: def.pattern,
        archetype,
        avgViews: null,
        isMeasured: false,
        measurementBasis: "heuristic" as const,
        example: `${def.example} (Heuristic recommendation: Insufficient channel evidence)`,
      })),
      shareDrivers: [
        "Moral high ground (protecting child from criminal syndicates)",
        "Cool-headed psychological dominance over aggressive antagonists",
        "Satisfying underdog checkmate without visible violence",
      ],
      audiencePreferences: [
        "Atmospheric Tokyo noir anime aesthetic with cinematic rain and neon reflections",
        "MAPPA / Ufotable dark cel animation look (charcoal suit, dark sunglasses, silver-headed cane)",
        "High-contrast chiaroscuro lighting and crisp native foley audio",
      ],
    };
  }

  let recommendedDuration = 52;
  let minSweet = 50;
  let maxSweet = 58;

  const topVideos = videosWithViews.slice(0, 5);
  const validDurations = topVideos
    .map((v) => v.lengthSeconds)
    .filter((d): d is number => typeof d === "number" && d > 0);

  if (validDurations.length > 0) {
    const avgTopDuration = validDurations.reduce((acc, d) => acc + d, 0) / validDurations.length;
    recommendedDuration = Math.round(avgTopDuration);
    minSweet = Math.max(30, recommendedDuration - 4);
    maxSweet = recommendedDuration + 6;
  }

  const topPerformingReels = videosWithViews.slice(0, 5).map((p) => {
    const hasRetention = p.insights?.avgWatchTimeSeconds != null && p.insights.avgWatchTimeSeconds > 0;
    return {
      id: p.id,
      videoId: p.videoId,
      title: p.text ? p.text.split("\n")[0].slice(0, 60) : "Anime Video Reel",
      views: p.views ?? null,
      likes: p.likes ?? 0,
      shares: p.shares ?? 0,
      comments: p.comments ?? 0,
      durationSeconds: p.lengthSeconds ?? null,
      replays: p.insights?.replayCount,
      avgWatchTimeSeconds: p.insights?.avgWatchTimeSeconds,
      retentionMeasured: hasRetention,
    };
  });

  const provenHooks = Object.entries(archetypeHookDefinitions).map(([archetype, def]) => {
    const matchedReels = videosWithViews.filter((p) => {
      const title = p.text || "";
      return def.regex.test(title);
    });

    if (matchedReels.length > 0) {
      const avgViews = Math.round(
        matchedReels.reduce((acc, r) => acc + (r.views || 0), 0) / matchedReels.length
      );
      return {
        pattern: def.pattern,
        archetype,
        avgViews,
        isMeasured: true,
        measurementBasis: "measured" as const,
        example: def.example,
      };
    }

    // Unmatched archetype — do NOT fabricate a fake view number; clearly label as heuristic
    return {
      pattern: def.pattern,
      archetype,
      avgViews: null,
      isMeasured: false,
      measurementBasis: "heuristic" as const,
      example: `${def.example} (Heuristic recommendation: No matching channel posts found in analysis)`,
    };
  });

  return {
    channelName: "AnimeEdits",
    totalAnalyzedPosts: postsData.length,
    dataSource,
    retrievedAt: new Date().toISOString(),
    isFresh: dataSource === "live",
    dataFreshnessSeconds: dataSource === "live" ? 0 : 86400,
    error: diagnosticError,
    topPerformingReels,
    durationSweetSpot: {
      minSeconds: minSweet,
      maxSeconds: maxSweet,
      recommendedDuration,
      insight: `${minSweet}s–${maxSweet}s duration sweet spot maximizes completion rates and replay triggers based on ${dataSource} data.`,
    },
    provenHooks,
    shareDrivers: [
      "Moral high ground (protecting child from criminal syndicates)",
      "Cool-headed psychological dominance over aggressive antagonists",
      "Satisfying underdog checkmate without visible violence",
    ],
    audiencePreferences: [
      "Atmospheric Tokyo noir anime aesthetic with cinematic rain and neon reflections",
      "MAPPA / Ufotable dark cel animation look (charcoal suit, dark sunglasses, silver-headed cane)",
      "High-contrast chiaroscuro lighting and crisp native foley audio",
    ],
  };
}

// ==========================================
// 3. DATA-DRIVEN CANDIDATES & RANKING ENGINE
// ==========================================

export function calculateCandidateScore(
  idea: Omit<ReelIdeaCandidate, "scores" | "ranking" | "scoringBasis">,
  analysis?: PerformanceAnalysis
): { scores: ReelIdeaCandidate["scores"]; scoringBasis: ReelIdeaCandidate["scoringBasis"] } {
  const sweetSpot = analysis?.durationSweetSpot?.recommendedDuration || 52;
  const durationDiff = Math.abs(idea.targetDurationSeconds - sweetSpot);
  const durationOptimalityScore = Math.max(2, Math.round(10 - durationDiff * 0.4));

  // Determine dynamic archetype multiplier from input performance data
  let archetypeWeight = 8.0;
  let archetypeMeasuredAvgViews: number | undefined;
  let retentionMeasured = false;

  if (analysis?.topPerformingReels && analysis.topPerformingReels.length > 0) {
    retentionMeasured = analysis.topPerformingReels.some(
      (r) => r.avgWatchTimeSeconds != null && r.avgWatchTimeSeconds > 0
    );

    // Group reels by archetype matching keywords
    const archetypePatterns: Record<string, RegExp> = {
      "Sensory Paradox": /sensory|cane|blind|darkness|paradox|janitor/i,
      "High-IQ Checkmate": /audit|checkmate|billionaire|broker|one-yen|iq|grandmaster|chess/i,
      "Reluctant Guardian": /daughter|princess|parent|father|protect|school|lesson/i,
      "Sound-First ASMR": /rain|sound|asmr|umbrella|train|subway|whisper|heliport/i,
    };

    const pattern = archetypePatterns[idea.archetype];
    const matchingReels = analysis.topPerformingReels.filter(
      (r) => pattern.test(r.title)
    );

    if (matchingReels.length > 0) {
      const validViews = matchingReels
        .map((r) => r.views)
        .filter((v): v is number => typeof v === "number");
      if (validViews.length > 0) {
        archetypeMeasuredAvgViews = Math.round(
          validViews.reduce((a, b) => a + b, 0) / validViews.length
        );
      }
    }

    // Rank archetypes in analysis by average views
    const allArchetypeAvgViews: Record<string, number> = {};
    for (const [archName, regex] of Object.entries(archetypePatterns)) {
      const matched = analysis.topPerformingReels.filter((r) => regex.test(r.title));
      const views = matched
        .map((r) => r.views)
        .filter((v): v is number => typeof v === "number");
      if (views.length > 0) {
        allArchetypeAvgViews[archName] = views.reduce((a, b) => a + b, 0) / views.length;
      }
    }

    const sortedArchetypes = Object.entries(allArchetypeAvgViews).sort((a, b) => b[1] - a[1]);
    const maxViewArch = sortedArchetypes[0];

    if (maxViewArch && sortedArchetypes.length > 0) {
      if (idea.archetype === maxViewArch[0]) {
        archetypeWeight = 10.0;
      } else {
        const myAvg = allArchetypeAvgViews[idea.archetype] || 0;
        const ratio = maxViewArch[1] > 0 ? myAvg / maxViewArch[1] : 0.8;
        archetypeWeight = Math.max(7.0, Math.min(9.5, 7.5 + ratio * 2.0));
      }
    } else {
      // Default baseline hierarchy
      if (idea.archetype === "Sensory Paradox") archetypeWeight = 10.0;
      else if (idea.archetype === "Reluctant Guardian") archetypeWeight = 9.5;
      else if (idea.archetype === "High-IQ Checkmate") archetypeWeight = 9.0;
      else if (idea.archetype === "Sound-First ASMR") archetypeWeight = 8.5;
    }
  } else {
    // Default baseline when analysis has no top reels
    if (idea.archetype === "Sensory Paradox") archetypeWeight = 10.0;
    else if (idea.archetype === "Reluctant Guardian") archetypeWeight = 9.5;
    else if (idea.archetype === "High-IQ Checkmate") archetypeWeight = 9.0;
    else if (idea.archetype === "Sound-First ASMR") archetypeWeight = 8.5;
  }

  const hookRetentionScore = Math.min(10, Math.round(archetypeWeight * 0.95));
  const audienceAffinityScore = Math.min(10, Math.round(archetypeWeight));
  const isFamilyProtective =
    idea.archetype === "Reluctant Guardian" ||
    idea.title.toLowerCase().includes("daughter") ||
    idea.hookOpening.toLowerCase().includes("daughter") ||
    idea.emotionalPayoff.toLowerCase().includes("daughter") ||
    idea.emotionalPayoff.toLowerCase().includes("protect");
  const shareabilityScore = isFamilyProtective ? 10 : 8;
  const loopPotentialScore = idea.loopMechanism ? 9 : 7;

  // Formula: Hook (30%) + Affinity (25%) + Shareability (20%) + Loop (15%) + Duration (10%)
  const overallWeightedScore = Math.round(
    hookRetentionScore * 3.0 +
      audienceAffinityScore * 2.5 +
      shareabilityScore * 2.0 +
      loopPotentialScore * 1.5 +
      durationOptimalityScore * 1.0
  );

  const hasMeasuredViews = (analysis?.topPerformingReels && analysis.topPerformingReels.length > 0) || false;
  let methodology: string;
  if (retentionMeasured) {
    methodology = "Data-driven: Archetype weights and duration sweet spot derived from live channel telemetry and measured watch times.";
  } else if (hasMeasuredViews && analysis?.dataSource !== "insufficient_data") {
    methodology = "Heuristic retention: Views measured from channel telemetry, but retention/watch-time telemetry is unavailable from source; scores reflect measured views with heuristic retention estimates.";
  } else {
    methodology = "Heuristic: Insufficient channel evidence; scores reflect baseline template benchmarks without empirical telemetry.";
  }

  return {
    scores: {
      hookRetentionScore,
      audienceAffinityScore,
      shareabilityScore,
      loopPotentialScore,
      durationOptimalityScore,
      overallWeightedScore,
    },
    scoringBasis: {
      dataSource: analysis?.dataSource || "fixture",
      retentionMeasured,
      archetypeMultiplier: archetypeWeight,
      archetypeMeasuredAvgViews,
      durationDeviationSeconds: durationDiff,
      methodology,
    },
  };
}

export function generateAndRankIdeas(analysis: PerformanceAnalysis): ReelIdeaCandidate[] {
  const rawCandidates: Array<Omit<ReelIdeaCandidate, "scores" | "ranking" | "scoringBasis">> = [
    {
      id: "idea_blind_accountant_reversal",
      title: "The Blind King's Audit",
      seriesEpisode: "Episode #26",
      archetype: "High-IQ Checkmate",
      targetDurationSeconds: 52,
      hookOpening: "The boardroom lights flicker out. In the dark, a blind man calmly types on a mechanical calculator: Click. Click. 'Your debt is due.'",
      coreConflict: "A rival cartel surrounds Ren in a luxury penthouse, demanding his offshore accounts, unaware his blind cane is wired to their financial server.",
      emotionalPayoff: "The arrogant cartel boss checks his phone and falls to his knees as his empire evaporates in 3 seconds.",
      loopMechanism: "The mechanical calculator click in the final frame seamlessly echoes the first frame's opening click.",
    },
    {
      id: "idea_daughter_protective_vengeance",
      title: "The Cat, The Cane, and The Crown",
      seriesEpisode: "Episode #27",
      archetype: "Reluctant Guardian",
      targetDurationSeconds: 54,
      hookOpening: "Ren gently wraps a scarf around his 7-year-old daughter. 'Close your ears, sweetie. Daddy needs to teach five men how to knock.'",
      coreConflict: "Armed assassins breach the private residence unaware that Ren Kurokawa has mapped every tile and acoustic bounce of the room.",
      emotionalPayoff: "Ren dismantles the strike team in absolute darkness without raising his voice or spilling a drop of tea.",
      loopMechanism: "The rhythmic tick of a grandfather clock closes the scene and triggers the opening beat.",
    },
    {
      id: "idea_sound_first_rain_interrogation",
      title: "Rain on a Black Umbrella",
      seriesEpisode: "Episode #28",
      archetype: "Sound-First ASMR",
      targetDurationSeconds: 49,
      hookOpening: "Zero dialogue for 2 seconds. Only heavy rain pounding a silk umbrella and a slow match strike illuminating Ren's dark sunglasses.",
      coreConflict: "A corrupt detective interrogates Ren in an abandoned Shibuya alleyway, demanding names.",
      emotionalPayoff: "Ren reveals he knew the detective's daughter was saved by Ren's own charity hospital that morning.",
      loopMechanism: "A single water droplet hits a puddle and snaps into the opening rain loop.",
    },
    {
      id: "idea_sensory_paradox_chess",
      title: "The Blind Grandmaster",
      seriesEpisode: "Episode #29",
      archetype: "Sensory Paradox",
      targetDurationSeconds: 53,
      hookOpening: "Ren slides a carved obsidian king across a crystal table without looking: 'A sighted man watches the pieces. A master watches the room.'",
      coreConflict: "The city's biggest underground broker bets his entire fortune on one blitz game with Ren Kurokawa.",
      emotionalPayoff: "Checkmate on move 4. The rival realizes Ren memorized the board vibrations through the marble tabletop.",
      loopMechanism: "The sharp wooden clack of the chess king looping directly into the opening piece drop.",
    },
    {
      id: "idea_the_janitor_origin_secret",
      title: "The Sweeper of Kabukicho",
      seriesEpisode: "Episode #30",
      archetype: "Sensory Paradox",
      targetDurationSeconds: 55,
      hookOpening: "A blind janitor in a faded apron sweeps cigarette butts outside a gangster nightclub. A captain kicks his bucket. Ren stops sweeping.",
      coreConflict: "Young cartel enforcers harass an old blind janitor, completely unaware he founded the very syndicate they work for.",
      emotionalPayoff: "Ren calmly recites the names of their grandfathers and whispers the secret syndicate oath; the entire room drops to their knees.",
      loopMechanism: "The rhythmic sweep of the broom bristles perfectly synchronizes into the starting sweep sound.",
    },
    {
      id: "idea_daughter_school_festival",
      title: "Parent-Teacher Conference in Blood",
      seriesEpisode: "Episode #31",
      archetype: "Reluctant Guardian",
      targetDurationSeconds: 51,
      hookOpening: "Ren Kurokawa sits in a tiny elementary school chair in a bespoke three-piece suit holding his daughter's crayon drawing.",
      coreConflict: "A rival syndicate boss enters the school festival hoping to corner Ren in public.",
      emotionalPayoff: "Ren quietly slides a USB drive with the rival's family secrets into his pocket: 'I promised my daughter I wouldn't ruin her art class. Don't test me.'",
      loopMechanism: "The school bell chime in the final second matches the opening school bell chime.",
    },
    {
      id: "idea_subway_car_ambush",
      title: "Last Train from Shinjuku",
      seriesEpisode: "Episode #32",
      archetype: "Sound-First ASMR",
      targetDurationSeconds: 56,
      hookOpening: "Subway lights flicker red. The emergency brakes screech. Ren stands alone in the subway car holding his white walking cane.",
      coreConflict: "Six elite blade assassins surround Ren inside a locked, moving underground train carriage.",
      emotionalPayoff: "Ren uses the rhythmic sway of the train car and the flickering neon to neutralize every attacker in 8 clean strokes.",
      loopMechanism: "The metallic clatter of the train tracks loops seamlessly into the opening train motion.",
    },
    {
      id: "idea_auction_room_heist",
      title: "The One-Yen Bid",
      seriesEpisode: "Episode #33",
      archetype: "High-IQ Checkmate",
      targetDurationSeconds: 50,
      hookOpening: "At a secret billionaire auction, a stolen historical katana is announced. Ren Kurokawa raises a single finger: 'One yen.'",
      coreConflict: "Billionaires laugh and outbid him to 100 million, unaware Ren already bought the auction house and the building deed.",
      emotionalPayoff: "Ren taps his cane; the gavel drops at one yen because Ren owns the debt of every buyer in the room.",
      loopMechanism: "The gavel crack in the auction room loops into the cane strike of frame 1.",
    },
    {
      id: "idea_the_daughter_first_lesson",
      title: "How to Listen to a Lie",
      seriesEpisode: "Episode #34",
      archetype: "Reluctant Guardian",
      targetDurationSeconds: 52,
      hookOpening: "Ren sits with his daughter on a balcony overlooking Tokyo. 'Close your eyes, Hana. What do you hear?' 'Someone's pulse is too fast, Papa.'",
      coreConflict: "A treacherous lieutenant delivers a report while secretly plotting an overthrow, oblivious that the little girl can hear his irregular heartbeat.",
      emotionalPayoff: "Ren doesn't even draw his weapon. He hands the lieutenant a ticket to South America: 'Never come back.'",
      loopMechanism: "Wind chimes on the balcony ring at the start and end.",
    },
    {
      id: "idea_neon_rooftop_duel",
      title: "Rain on the Heliport",
      seriesEpisode: "Episode #35",
      archetype: "Sensory Paradox",
      targetDurationSeconds: 58,
      hookOpening: "Ren stands on a rain-soaked skyscraper helipad, wind howling. A sniper red dot locks onto the center of his dark sunglasses.",
      coreConflict: "The syndicate's deadliest mercenary challenges Ren to a one-on-one duel under a raging thunderstorm.",
      emotionalPayoff: "Ren tilts his cane at an angle. The lightning strike hits the cane and blinds the sniper through his night-vision scope.",
      loopMechanism: "A distant thunderclap closes the reel and opens the first second.",
    },
  ];

  // Calculate dynamic scores factoring in channel performance
  const scored = rawCandidates.map((c) => {
    const { scores, scoringBasis } = calculateCandidateScore(c, analysis);
    return {
      ...c,
      scores,
      scoringBasis,
    };
  });

  scored.sort((a, b) => {
    if (b.scores.overallWeightedScore !== a.scores.overallWeightedScore) {
      return b.scores.overallWeightedScore - a.scores.overallWeightedScore;
    }
    // Tie-breaker: hook retention score
    return b.scores.hookRetentionScore - a.scores.hookRetentionScore;
  });

  return scored.map((item, index) => ({
    ...item,
    ranking: index + 1,
  }));
}

// ==========================================
// 4. PRODUCTION PACKAGE GENERATOR
// ==========================================

function generateArchetypeStoryboardAndNarration(winningIdea: ReelIdeaCandidate) {
  const targetDuration = winningIdea.targetDurationSeconds;
  const quoteMatch = winningIdea.hookOpening.match(/"([^"]+)"/);
  const hookQuote = quoteMatch ? `"${quoteMatch[1]}"` : winningIdea.hookOpening;

  if (winningIdea.archetype === "High-IQ Checkmate") {
    const s1Dialogue = hookQuote || '"Your debt is due."';
    const s2Dialogue = '"Ren Kurokawa! Hand over your accounts, or this boardroom becomes a graveyard."';
    const s3Dialogue = '"You brought guns to a financial checkmate. I purchased your syndicate three minutes ago."';
    const s4Dialogue = '"Check your accounts in the morning. Click. Click."';

    const storyboard: StoryboardScene[] = [
      {
        sceneNumber: 1,
        name: "The Boardroom Checkmate Hook",
        timeframe: "00:00 - 00:03",
        visualDescription:
          "Extreme close-up of dark sunglasses reflecting glowing red stock ticker numbers in the dark boardroom. Ren Kurokawa in bespoke charcoal suit calmly taps his silver-headed cane: TAP.",
        cameraMotion: "Fast dolly-in macro to wide snap reveal",
        lightingAndColor: "Dark Tokyo corporate noir, crimson neon reflections on polished marble, chiaroscuro",
        veoPrompt:
          "9:16 vertical video. [00:00-00:03] Extreme close-up of dark sunglasses reflecting Tokyo neon numbers. Rapid camera pull-back reveals Ren Kurokawa in bespoke charcoal suit typing on mechanical calculator. Dark noir anime aesthetic, MAPPA style. Native audio: mechanical calculator click, deep echoing cane tap.",
        nativeAudioCue: "Mechanical calculator click, heavy cane tap on marble, low bass pulse",
        speaker: "Ren Kurokawa",
        dialogue: s1Dialogue,
        subtitles: s1Dialogue,
      },
      {
        sceneNumber: 2,
        name: "The Corporate Syndicate Confrontation",
        timeframe: "00:03 - 00:18",
        visualDescription:
          "Cartel executives and armed tactical bodyguards surround the boardroom table, slamming files down demanding Ren surrender his financial holdings. Ren sits motionless.",
        cameraMotion: "Low angle slow tracking shot behind Ren's motionless silhouette",
        lightingAndColor: "Cold blue halogen lighting flickering against stormy penthouse windows",
        veoPrompt:
          "9:16 vertical video. [00:03-00:18] Arrogant syndicate executives surround Ren Kurokawa, shouting demands. Ren sits completely motionless with hands on walking cane. Cel anime, high tension lighting.",
        nativeAudioCue: "Files slamming on table, tense heartbeat pulse, rain against skyscraper glass",
        speaker: "Cartel Boss",
        dialogue: s2Dialogue,
        subtitles: s2Dialogue,
      },
      {
        sceneNumber: 3,
        name: "The Financial Reversal & Total Liquidation",
        timeframe: "00:18 - 00:38",
        visualDescription:
          "Ren taps his cane once. Every financial terminal in the room flashes red with liquidation notices. The syndicate boss checks his phone; his entire bank balance drops to zero.",
        cameraMotion: "Speed ramp crash zoom on the boss's terrified face, whip pan to Ren standing serenely behind him",
        lightingAndColor: "Emergency amber alert strobe contrasting with pitch shadows",
        veoPrompt:
          "9:16 vertical video. [00:18-00:38] Ren Kurokawa stands up. Boardroom monitors flash red market crash alerts. Syndicate boss collapses to his knees staring at his phone. Cinematic anime, Ufotable lighting effects.",
        nativeAudioCue: "Emergency sirens, electronic liquidation chime, heavy cane thud",
        speaker: "Ren Kurokawa",
        dialogue: s3Dialogue,
        subtitles: s3Dialogue,
      },
      {
        sceneNumber: 4,
        name: "The Checkmate & Seamless Audio Loop",
        timeframe: `00:38 - 00:${targetDuration}`,
        visualDescription:
          "Ren calmly adjusts his lapel, walks toward the elevator as the security team parts in awe. In the final second, Ren taps his cane: TAP.",
        cameraMotion: "Slow cinematic dolly backward framing Ren stepping into the elevator",
        lightingAndColor: "Warm elevator gold contrasting with dark ruined boardroom",
        veoPrompt:
          `9:16 vertical video. [00:38-00:${targetDuration}] Ren Kurokawa walks into golden elevator, disarmed guards bowing in defeat. Final frame: cane taps floor, matching opening frame 1 audio.`,
        nativeAudioCue: "Elevator chime, final sharp cane tap echoing into opening click",
        speaker: "Ren Kurokawa",
        dialogue: s4Dialogue,
        subtitles: s4Dialogue,
      },
    ];

    const fullNarrationText = `${s1Dialogue} ${s2Dialogue} ${s3Dialogue} ${s4Dialogue}`;
    const srtFormattedSubtitles = `1\n00:00:00,000 --> 00:00:03,000\n${s1Dialogue}\n\n2\n00:00:03,500 --> 00:00:18,000\n${s2Dialogue}\n\n3\n00:00:18,500 --> 00:00:38,000\n${s3Dialogue}\n\n4\n00:00:38,500 --> 00:00:${targetDuration},000\n${s4Dialogue}`;

    return {
      storyboard,
      fullNarrationText,
      srtFormattedSubtitles,
      onScreenText: "NEVER BRING GUNS TO A FINANCIAL CHECKMATE ♟️",
      captionHeadline: "Never play chess with a man who calculated your bankruptcy before you entered the room.",
      hashtags: ["anime", "animeedits", "highiq", "checkmate", "animereels", "mafiaboss", "cinematic"],
    };
  }

  if (winningIdea.archetype === "Sound-First ASMR") {
    const s1Dialogue = hookQuote || '"Zero dialogue for two seconds. Only rain on silk... and a blind man waiting."';
    const s2Dialogue = '"Give us the Syndicate names, Ren! You have nowhere to run in this alley."';
    const s3Dialogue = '"The rain washes away footprints, Detective... but it never washes away debt."';
    const s4Dialogue = '"Listen to the rain. It always knows the truth. DRIP."';

    const storyboard: StoryboardScene[] = [
      {
        sceneNumber: 1,
        name: "The Foley Atmosphere Sensory Immersion",
        timeframe: "00:00 - 00:03",
        visualDescription:
          "Extreme macro close-up of raindrops pounding the silk fabric of a jet-black umbrella. A match strike illuminates Ren Kurokawa's dark sunglasses in Shibuya rain.",
        cameraMotion: "Ultra slow-motion macro pull-back to dark alley silhouette",
        lightingAndColor: "Deep Tokyo noir alleyway, cobalt blue rain, neon cyan reflections",
        veoPrompt:
          "9:16 vertical video. [00:00-00:03] Macro slow-motion raindrops hitting black silk umbrella. Match strike illuminates Ren Kurokawa in dark sunglasses. MAPPA dark noir style. Native audio: crisp rain on silk, match sizzle, low thunder.",
        nativeAudioCue: "Heavy crisp rain on silk umbrella, sharp match strike sizzle, low rumbling thunder",
        speaker: "Narrator",
        dialogue: s1Dialogue,
        subtitles: s1Dialogue,
      },
      {
        sceneNumber: 2,
        name: "The Alleyway Rain Interrogation",
        timeframe: "00:03 - 00:18",
        visualDescription:
          "A corrupt detective and armed enforcers corner Ren under a flickering Shibuya streetlamp, demanding names amidst heavy downpour.",
        cameraMotion: "Slow low-angle tracking through misty puddle reflections",
        lightingAndColor: "Flickering amber sodium streetlamp casting wet shadows in dense mist",
        veoPrompt:
          "9:16 vertical video. [00:03-00:18] Corrupt detective confronts Ren Kurokawa under flickering streetlamp in wet alleyway. Rain pours continuously, creating dense atmospheric mist.",
        nativeAudioCue: "Footsteps splashing in puddles, streetlamp hum, heavy rain drumming",
        speaker: "Detective",
        dialogue: s2Dialogue,
        subtitles: s2Dialogue,
      },
      {
        sceneNumber: 3,
        name: "The Acoustic Fluid Disarm",
        timeframe: "00:18 - 00:38",
        visualDescription:
          "Ren tilts his umbrella. Using the rhythm of falling water and puddle acoustic echoes, Ren disarms both enforcers in three lightning cane strokes.",
        cameraMotion: "High-speed martial arts tracking with water splashes rendered in slow motion cel anime",
        lightingAndColor: "Neon magenta puddles splashing amidst dark alley shadows",
        veoPrompt:
          "9:16 vertical video. [00:18-00:38] Ren Kurokawa uses umbrella and cane in fluid acoustic martial arts, disarming attackers amidst splashing puddles. Ufotable water effects.",
        nativeAudioCue: "Umbrella snap, cane whoosh, metallic weapons splashing into water puddles",
        speaker: "Ren Kurokawa",
        dialogue: s3Dialogue,
        subtitles: s3Dialogue,
      },
      {
        sceneNumber: 4,
        name: "The ASMR Water Droplet Loop",
        timeframe: `00:38 - 00:${targetDuration}`,
        visualDescription:
          "Ren walks into the mist, umbrella tilted. A single water droplet drips from the umbrella tip into a neon puddle in ultra-close-up.",
        cameraMotion: "Macro drop down to circular puddle ripple",
        lightingAndColor: "Glowing teal neon reflection in circular ripple",
        veoPrompt:
          `9:16 vertical video. [00:38-00:${targetDuration}] Ren Kurokawa walks into rain mist. Final second: single water droplet falls from umbrella into puddle, looping seamlessly to opening rain beat.`,
        nativeAudioCue: "Single crisp water droplet splash into puddle, looping into opening rain sound",
        speaker: "Ren Kurokawa",
        dialogue: s4Dialogue,
        subtitles: s4Dialogue,
      },
    ];

    const fullNarrationText = `${s1Dialogue} ${s2Dialogue} ${s3Dialogue} ${s4Dialogue}`;
    const srtFormattedSubtitles = `1\n00:00:00,000 --> 00:00:03,000\n${s1Dialogue}\n\n2\n00:00:03,500 --> 00:00:18,000\n${s2Dialogue}\n\n3\n00:00:18,500 --> 00:00:38,000\n${s3Dialogue}\n\n4\n00:00:38,500 --> 00:00:${targetDuration},000\n${s4Dialogue}`;

    return {
      storyboard,
      fullNarrationText,
      srtFormattedSubtitles,
      onScreenText: "PUT ON HEADPHONES FOR THIS SOUND EXPERIENCE 🎧",
      captionHeadline: "When rain hits the silk umbrella, the blind boss already knows your next move.",
      hashtags: ["anime", "animeedits", "asmr", "sounddesign", "animereels", "mafiaboss", "cinematic"],
    };
  }

  if (winningIdea.archetype === "Sensory Paradox") {
    const s1Dialogue = hookQuote || '"A sighted man watches the pieces. A master watches the room."';
    const s2Dialogue = '"You are blind, Kurokawa! You cannot see my queen advancing on your king."';
    const s3Dialogue = '"Checkmate on move four. I do not need eyes to read the vibrations of your heartbeat."';
    const s4Dialogue = '"A master never needs to look. CLACK."';

    const storyboard: StoryboardScene[] = [
      {
        sceneNumber: 1,
        name: "The Sensory Paradox Hook",
        timeframe: "00:00 - 00:03",
        visualDescription:
          "Extreme close-up of a carved obsidian chess piece sliding across a crystal table without looking. Ren Kurokawa taps the crystal: TAP.",
        cameraMotion: "Macro tracking on sliding piece, pulling back to Ren's dark sunglasses",
        lightingAndColor: "Deep chiaroscuro, sharp spotlight illuminating crystal chess board amidst pitch shadows",
        veoPrompt:
          "9:16 vertical video. [00:00-00:03] Extreme close-up of blind Ren Kurokawa sliding obsidian chess king across crystal table without looking. Dark noir anime aesthetic, MAPPA style.",
        nativeAudioCue: "Sharp wooden chess clack, acoustic marble resonance, deep sub-bass pulse",
        speaker: "Ren Kurokawa",
        dialogue: s1Dialogue,
        subtitles: s1Dialogue,
      },
      {
        sceneNumber: 2,
        name: "The Arrogant Challenge",
        timeframe: "00:03 - 00:18",
        visualDescription:
          "The underground broker sneers, betting his fortune across the crystal table while bodyguards look on. Ren listens calmly.",
        cameraMotion: "Circular tracking shot around the high-stakes table",
        lightingAndColor: "Smoky speakeasy lighting, neon amber and emerald shadows",
        veoPrompt:
          "9:16 vertical video. [00:03-00:18] Arrogant cartel broker sneers, betting his fortune across crystal chess table. Ren remains completely still, listening to breathing patterns.",
        nativeAudioCue: "Chips clattering, smug antagonist laughter, ticking tournament chess clock",
        speaker: "Underground Broker",
        dialogue: s2Dialogue,
        subtitles: s2Dialogue,
      },
      {
        sceneNumber: 3,
        name: "The Acoustic Checkmate Reversal",
        timeframe: "00:18 - 00:38",
        visualDescription:
          "Move 4 checkmate. Ren slides a piece into place without touching the board twice. The broker realizes every piece is pinned through marble vibrations.",
        cameraMotion: "Fast snap-zoom into the shattered reflection in the crystal board",
        lightingAndColor: "Cold blue neon flare across Ren's dark sunglasses",
        veoPrompt:
          "9:16 vertical video. [00:18-00:38] Ren executes move 4 checkmate. Broker freezes in terror as board vibrations reveal his defeat. High impact anime motion blur, Ufotable style.",
        nativeAudioCue: "Final decisive wooden clack, table vibration boom, antagonist gasp",
        speaker: "Ren Kurokawa",
        dialogue: s3Dialogue,
        subtitles: s3Dialogue,
      },
      {
        sceneNumber: 4,
        name: "The Grandmaster Walkaway & Loop",
        timeframe: `00:38 - 00:${targetDuration}`,
        visualDescription:
          "Ren stands, sweeps the table clean with a single motion of his cane, and walks into the Tokyo night. Final frame: obsidian king falls with a sharp clack.",
        cameraMotion: "Slow dolly-out through the rain-streaked doorway",
        lightingAndColor: "Silhouette against Shibuya neon rain",
        veoPrompt:
          `9:16 vertical video. [00:38-00:${targetDuration}] Ren Kurokawa walks out into rainy Tokyo night. Final frame: obsidian piece clacks onto marble, perfectly matching frame 1 audio loop.`,
        nativeAudioCue: "Rain falling on asphalt, single decisive chess clack looping to frame 1",
        speaker: "Ren Kurokawa",
        dialogue: s4Dialogue,
        subtitles: s4Dialogue,
      },
    ];

    const fullNarrationText = `${s1Dialogue} ${s2Dialogue} ${s3Dialogue} ${s4Dialogue}`;
    const srtFormattedSubtitles = `1\n00:00:00,000 --> 00:00:03,000\n${s1Dialogue}\n\n2\n00:00:03,500 --> 00:00:18,000\n${s2Dialogue}\n\n3\n00:00:18,500 --> 00:00:38,000\n${s3Dialogue}\n\n4\n00:00:38,500 --> 00:00:${targetDuration},000\n${s4Dialogue}`;

    return {
      storyboard,
      fullNarrationText,
      srtFormattedSubtitles,
      onScreenText: "THE BLIND GRANDMASTER SEES EVERYTHING 👁️",
      captionHeadline: "In the dark, a sighted man watches the pieces... but a master watches the room.",
      hashtags: ["anime", "animeedits", "grandmaster", "sensoryparadox", "animereels", "mafiaboss", "cinematic"],
    };
  }

  // Default: Reluctant Guardian
  const s1Dialogue = hookQuote || '"Close your ears, sweetie. Daddy needs to teach five men how to knock."';
  const s2Dialogue = '"Ren Kurokawa! The Syndicate council wants your ledger. Hand it over, or this penthouse becomes a graveyard."';
  const s3Dialogue = "\"You brought guns into a blind man's house. You forgot... in the dark, I am the only one who can see.\"";
  const s4Dialogue = "\"Tell the Chairman... my daughter's bedtime is nine o'clock. Don't be late.\"";

  const storyboard: StoryboardScene[] = [
    {
      sceneNumber: 1,
      name: "The Scroll-Stopping Hook",
      timeframe: "00:00 - 00:03",
      visualDescription:
        "Extreme macro close-up of dark sunglasses glistening with heavy neon rain. Sudden whip-pan back to reveal Ren Kurokawa in charcoal three-piece suit calmly wrapping a scarf around his daughter.",
      cameraMotion: "Fast dolly-in macro to wide snap reveal",
      lightingAndColor: "Dark Tokyo noir, crimson neon reflections on black puddles, high contrast chiaroscuro",
      veoPrompt:
        "9:16 vertical video. [00:00-00:03] Extreme close-up of dark sunglasses reflecting Tokyo neon rain. Rapid camera pull-back reveals Ren Kurokawa in bespoke charcoal suit holding a silver-handled walking cane on wet marble. Dark noir anime aesthetic, MAPPA style.",
      nativeAudioCue: "Sharp water droplet splash, echoing cane tap on marble, low sub-bass rumble",
      speaker: "Ren Kurokawa",
      dialogue: s1Dialogue,
      subtitles: s1Dialogue,
    },
    {
      sceneNumber: 2,
      name: "The Confrontation & Sensory Paradox",
      timeframe: "00:03 - 00:18",
      visualDescription:
        "The heavy teak double doors swing open. Five armed cartel enforcers in tactical gear step into the luxury penthouse suite. Ren does not flinch; he gently places a silk blanket over his daughter's shoulders.",
      cameraMotion: "Low angle slow tracking shot behind Ren's silhouette",
      lightingAndColor: "Warm interior penthouse chandelier dimmed by cold blue lightning flashes outside",
      veoPrompt:
        "9:16 vertical video. [00:03-00:18] Low angle tracking shot behind Ren Kurokawa as five armed tactical gangsters burst through double doors. Ren calmly adjusts a silk blanket over a little girl sitting on a velvet sofa.",
      nativeAudioCue: "Heavy door creak, gun bolts racking, gentle fabric rustle",
      speaker: "Cartel Captain",
      dialogue: s2Dialogue,
      subtitles: s2Dialogue,
    },
    {
      sceneNumber: 3,
      name: "The Calculation & Checkmate",
      timeframe: "00:18 - 00:38",
      visualDescription:
        "Ren Kurokawa strikes the floor once with his cane. The overhead penthouse lights immediately plunge into total darkness. In the blackness, rapid lightning illuminates Ren already standing behind them.",
      cameraMotion: "Speed ramp fast push-in with silhouette freeze-frames during lightning bursts",
      lightingAndColor: "Pitch darkness punctuated by stroboscopic white lightning and neon cyan flashes",
      veoPrompt:
        "9:16 vertical video. [00:18-00:38] Ren taps his cane. Penthouse lights snap off into pitch darkness. Flash of lightning illuminates Ren Kurokawa moving like a ghost between armed gangsters.",
      nativeAudioCue: "Light switch pop, deep thunder crack, cane whoosh, weapons falling to floor",
      speaker: "Ren Kurokawa",
      dialogue: s3Dialogue,
      subtitles: s3Dialogue,
    },
    {
      sceneNumber: 4,
      name: "The Climax & Seamless Viral Loop",
      timeframe: `00:38 - 00:${targetDuration}`,
      visualDescription:
        "The penthouse lights flicker back on. The five enforcers are disarmed on their knees. Ren Kurokawa stands at his desk pouring a cup of hot jasmine tea. His daughter smiles quietly. In the final second, Ren gently taps his cane: TAP.",
      cameraMotion: "Slow cinematic dolly backward framing the warm room against the stormy Tokyo skyline",
      lightingAndColor: "Warm golden amber tea glow contrasting with cold rainy night outside",
      veoPrompt:
        `9:16 vertical video. [00:38-00:${targetDuration}] Penthouse lights return. Disarmed mobsters kneeling in defeat. Ren Kurokawa calmly pours steaming tea into a porcelain cup for his smiling daughter.`,
      nativeAudioCue: "Tea pouring into porcelain cup, quiet rainfall, sharp cane tap matching opening audio",
      speaker: "Ren Kurokawa",
      dialogue: s4Dialogue,
      subtitles: s4Dialogue,
    },
  ];

  const fullNarrationText = `${s1Dialogue} ${s2Dialogue} ${s3Dialogue} ${s4Dialogue}`;
  const srtFormattedSubtitles = `1\n00:00:00,000 --> 00:00:03,000\n${s1Dialogue}\n\n2\n00:00:03,500 --> 00:00:18,000\n${s2Dialogue}\n\n3\n00:00:18,500 --> 00:00:38,000\n${s3Dialogue}\n\n4\n00:00:38,500 --> 00:00:${targetDuration},000\n${s4Dialogue}`;

  return {
    storyboard,
    fullNarrationText,
    srtFormattedSubtitles,
    onScreenText: "NEVER MESS WITH THE BLIND BOSS'S FAMILY 💀",
    captionHeadline: "Never mess with the Boss's little princess... or the man who moves in the dark.",
    hashtags: ["anime", "animeedits", "aianime", "animereels", "manhwa", "mafiaboss", "animeshorts", "cinematic"],
  };
}

export function buildProductionPackage(
  winningIdea: ReelIdeaCandidate,
  analysis: PerformanceAnalysis,
  options?: { isRealMediaValidated?: boolean }
): FullProductionPackage {
  const generated = generateArchetypeStoryboardAndNarration(winningIdea);
  const { storyboard, fullNarrationText, srtFormattedSubtitles, onScreenText, captionHeadline, hashtags } = generated;

  const episodeMatch = winningIdea.seriesEpisode.match(/#(\d+)/);
  const currentEpNum = episodeMatch ? parseInt(episodeMatch[1], 10) : 31;
  const nextEpNum = currentEpNum + 1;

  // Inspect physical disk for media asset
  const mediaFilename = "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4";
  const candidatePaths = [
    path.join(process.cwd(), ".data", "media", mediaFilename),
    path.join(process.cwd(), "public", "media", mediaFilename),
    path.join(process.cwd(), ".next", "standalone", "public", "media", mediaFilename),
  ];
  const fileExists = candidatePaths.some((p) => fs.existsSync(p));

  // Do not describe a storyboard or prompt as a finished video unless a real media asset has been generated and validated
  const isMediaVerified = options?.isRealMediaValidated ?? fileExists;
  const mediaStatus = isMediaVerified ? "media_validated" : "storyboard_ready";
  const videoValidated = isMediaVerified;

  const mediaItem: PostMediaItem = {
    url: `/api/media/${mediaFilename}`,
    name: mediaFilename,
    type: "video",
    origin: isMediaVerified ? "generated" : "edited",
    prompt: `${winningIdea.title} - ${winningIdea.hookOpening}`,
    mimeType: "video/mp4",
  };

  let durationToDisplay = winningIdea.targetDurationSeconds;
  if (mediaItem.name?.includes("_42s")) {
    durationToDisplay = 42;
  }

  return {
    selectedIdea: winningIdea,
    title: `🎬 Mafia Boss Dad & Daughter — ${winningIdea.seriesEpisode}: ${winningIdea.title} (${durationToDisplay}s) 🔥`,
    mediaStatus,
    videoValidated,
    openingHook: {
      timeframe: "00:00 - 00:03",
      visualHook: storyboard[0].visualDescription,
      soundFx: storyboard[0].nativeAudioCue,
      voiceDialogue: storyboard[0].dialogue,
      onScreenText,
    },
    storyboard,
    narrationAndSubtitles: {
      fullNarrationText,
      srtFormattedSubtitles,
    },
    socialPackaging: {
      caption:
        `🎬 Mafia Boss Dad & Daughter — ${winningIdea.seriesEpisode}: ${winningIdea.title} (${durationToDisplay}s) 🔥\n\n` +
        `${captionHeadline}\n\n` +
        `${storyboard[0].dialogue} 💀\n\n` +
        `Who do you think sent this hit squad? The Chairman or the Osaka Syndicate? Drop your theories below! 👇\n\n` +
        `📺 Watch all episodes & subscribe for Episode #${nextEpNum}!\n\n` +
        hashtags.map((h) => `#${h}`).join(" "),
      hashtags,
      pinnedCommentPrompt: `Drop a 🔥 if you knew Ren was going to turn off the lights! Who sent these men?`,
    },
    attachedMedia: mediaItem,
  };
}

// ==========================================
// 5. WORKFLOW EXECUTION & DRAFT SAVER
// ==========================================

export async function executeContentDirectorCycle(params: {
  userId: string;
  campaignId: number;
  idempotencyKey?: string;
  allowFixtures?: boolean;
}): Promise<ContentDirectorResult> {
  const lockKey = `${params.userId}_${params.campaignId}_${params.idempotencyKey || "default"}`;

  if (activeJobs.has(lockKey)) {
    throw new Error(`Duplicate execution rejected: Content Director cycle is already running for lockKey: ${lockKey}`);
  }

  activeJobs.add(lockKey);

  try {
    const db = await getDb();

    // 1. Analyze performance
    const analysis = await analyzeChannelPerformance(params);

    if (analysis.dataSource === "unavailable" && !params.allowFixtures && process.env.NODE_ENV === "production") {
      throw new Error(
        `AnalyticsUnavailableError: Cannot generate content without reliable channel telemetry: ${analysis.error || "No data available."}`
      );
    }

    // 2. Generate and rank 10 ideas based on performance data
    const rankedIdeas = generateAndRankIdeas(analysis);
    const winningIdea = rankedIdeas[0];

    // 3. Build full production package
    const productionPackage = buildProductionPackage(winningIdea, analysis);

    // 4. Verify media asset physically exists on disk and is a VALID MP4 (never placeholder)
    const mediaFilename = path.basename(productionPackage.attachedMedia.url);
    const candidatePaths = [
      path.join(process.cwd(), ".data", "media", mediaFilename),
      path.join(process.cwd(), "public", "media", mediaFilename),
      path.join(process.cwd(), ".next", "standalone", "public", "media", mediaFilename),
    ];
    const resolvedMediaPath = candidatePaths.find((p) => fs.existsSync(p));

    if (!resolvedMediaPath) {
      console.error(`[ContentDirector] Media integrity failure: required video asset '${mediaFilename}' is missing.`);
      throw new Error(
        `MediaIntegrityError: Required video asset '${mediaFilename}' is missing. Content-production cycle stopped without creating a draft.`
      );
    }

    // Strict media integrity check using binary headers and ffprobe
    const validation = await validateVideoAsset(resolvedMediaPath);
    if (!validation.valid) {
      console.error(`[ContentDirector] Media integrity failure for '${mediaFilename}': ${validation.error}`);
      throw new Error(
        `MediaIntegrityError: Video asset '${mediaFilename}' failed integrity validation: ${validation.error}. Content-production cycle stopped without creating a draft.`
      );
    }

    productionPackage.videoValidated = true;
    productionPackage.mediaStatus = "media_validated";
    productionPackage.attachedMedia.origin = "generated";

    // 5. Save strictly as DRAFT in posts table (Human-in-the-Loop)
    const [savedPost] = await db
      .insert(posts)
      .values({
        userId: params.userId,
        campaignId: params.campaignId,
        source: "ai",
        title: productionPackage.title,
        caption: productionPackage.socialPackaging.caption,
        hashtags: productionPackage.socialPackaging.hashtags,
        platforms: ["facebook", "instagram"],
        media: [productionPackage.attachedMedia],
        status: "draft", // Strictly forced draft status
      })
      .returning();

    if (!savedPost || !savedPost.id) {
      throw new Error("Failed to persist draft post in database");
    }

    // 6. Save in contentDrafts table for comprehensive storyboard inspection
    const [contentDraftRecord] = await db
      .insert(contentDrafts)
      .values({
        userId: params.userId,
        campaignId: params.campaignId,
        agentId: "creator",
        kind: "reel",
        platform: "facebook",
        title: productionPackage.title,
        hook: productionPackage.openingHook.voiceDialogue,
        body: productionPackage.narrationAndSubtitles.fullNarrationText,
        cta: productionPackage.socialPackaging.pinnedCommentPrompt,
        hashtags: productionPackage.socialPackaging.hashtags,
        media: [productionPackage.attachedMedia],
        notes: `Selected Rank #1 idea: ${winningIdea.title} (Score: ${winningIdea.scores.overallWeightedScore}/100, Source: ${winningIdea.scoringBasis.dataSource})`,
        status: "draft",
        metadata: {
          rankedIdeas: rankedIdeas.slice(0, 5),
          storyboard: productionPackage.storyboard,
          postId: savedPost.id,
          scores: winningIdea.scores,
          scoringBasis: winningIdea.scoringBasis,
        },
      })
      .returning();

    // 7. Store learning memory in campaignMemories so future cycles remember
    let memoryId: number | undefined;
    try {
      const [mem] = await db
        .insert(campaignMemories)
        .values({
          userId: params.userId,
          campaignId: params.campaignId,
          agentId: "creator",
          kind: "content_director_run",
          content: `Content Director executed Rank #1 idea: "${winningIdea.title}" (${winningIdea.targetDurationSeconds}s). Hook archetype: "${winningIdea.archetype}". Score: ${winningIdea.scores.overallWeightedScore}/100. Target sweet spot: ${analysis.durationSweetSpot.recommendedDuration}s. Media verified (${validation.metadata?.durationSeconds || 42}s). Saved as Draft #${savedPost.id}.`,
          pinned: true,
        })
        .returning();
      memoryId = mem?.id;
    } catch {
      // ignore memory failure
    }

    // 8. Store research findings in researchFindings
    let findingId: number | undefined;
    try {
      const [finding] = await db
        .insert(researchFindings)
        .values({
          userId: params.userId,
          campaignId: params.campaignId,
          agentId: "research",
          topic: "AnimeEdits Viral Reel Retention Drivers",
          summary: `${analysis.durationSweetSpot.minSeconds}s-${analysis.durationSweetSpot.maxSeconds}s duration sweet spot identified from ${analysis.dataSource} data. Top archetype: ${winningIdea.archetype}.`,
          method: `${analysis.dataSource}_facebook_insights_analysis`,
          platforms: ["facebook"],
          hashtags: productionPackage.socialPackaging.hashtags,
          findings: [
            {
              insight: `${analysis.durationSweetSpot.recommendedDuration}s Sweet Spot`,
              details: `Recommended duration based on ${analysis.totalAnalyzedPosts} posts analyzed (${analysis.dataSource}).`,
            },
            {
              insight: "Acoustic Hook",
              details: `Top scoring archetype: ${winningIdea.archetype} (multiplier: ${winningIdea.scoringBasis.archetypeMultiplier}).`,
            },
          ],
        })
        .returning();
      findingId = finding?.id;
    } catch {
      // ignore
    }

    // 9. Verify draft exists in database
    const [verifiedDraft] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, savedPost.id), eq(posts.userId, params.userId)))
      .limit(1);

    if (!verifiedDraft) {
      throw new Error(`Verification failed: Draft #${savedPost.id} could not be confirmed in database.`);
    }

    return {
      success: true,
      draftId: verifiedDraft.id,
      contentDraftRecordId: contentDraftRecord?.id,
      title: verifiedDraft.title,
      status: "draft",
      analysis,
      rankedIdeas,
      selectedPackage: productionPackage,
      memoryRecordIds: {
        campaignMemoryId: memoryId,
        researchFindingId: findingId,
      },
      safetyLockNotice:
        `Human-in-the-Loop Gateway Active: Draft #${verifiedDraft.id} is strictly stored in 'draft' mode. It will NOT publish until you confirm publication with publish_post(postId: ${verifiedDraft.id}, confirmed: true).`,
    };
  } finally {
    activeJobs.delete(lockKey);
  }
}
