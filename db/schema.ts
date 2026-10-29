import {
  pgTable,
  serial,
  bigserial,
  bigint,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  uuid,
  primaryKey,
  unique,
  index,
} from "drizzle-orm/pg-core";

export interface ConnectedAccount {
  id: string;
  platform: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  status?: "connected" | "reconnect" | "disconnected";
}

export interface PostMediaItem {
  url: string;
  type?: "image" | "video" | "audio";
  fileId?: string | null;
  name?: string;
  mimeType?: string;
  origin?: "upload" | "generated" | "edited";
  sourceUrl?: string | null;
  prompt?: string | null;
  edits?: string[];
}

export interface PlatformPublishResult {
  status: "scheduled" | "published" | "failed";
  postId?: string | null;
  url?: string | null;
  error?: string | null;
  provider?: "blotato" | "openpost" | "facebook" | "local";
  updatedAt?: string;
}

export interface RepeatRule {
  frequency: "daily" | "weekly" | "hours";
  interval: number;
  maxRuns?: number | null;
}

export interface TaskInterruption {
  kind: "login" | "action" | "takeover";
  reason: string;
  url?: string | null;
  platform?: string | null;
}

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  provider: text("provider").notNull().default("email"),
  activeCampaignId: integer("active_campaign_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable(
  "campaigns",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon"),
    iconUrl: text("icon_url"),
    iconKey: text("icon_key"),
    officeImage: text("office_image").notNull().default("wooden-office"),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaigns_user_id_idx").on(t.userId)]
);

export const campaignProfiles = pgTable("campaign_profiles", {
  campaignId: integer("campaign_id")
    .primaryKey()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  brandName: text("brand_name").notNull().default(""),
  description: text("description").notNull().default(""),
  voice: text("voice").notNull().default("Friendly, authentic, and engaging"),
  audience: text("audience").notNull().default(""),
  goals: text("goals").notNull().default(""),
  platforms: text("platforms").array().notNull().default(["instagram", "tiktok", "youtube"]),
  timeZone: text("time_zone").notNull().default("UTC"),
  language: text("language").notNull().default("en"),
  competitors: text("competitors").array().notNull().default([]),
  dos: text("dos").array().notNull().default([]),
  donts: text("donts").array().notNull().default([]),
  brandColors: jsonb("brand_colors").$type<string[]>().notNull().default(["#2563EB", "#0F172A"]),
  logoUrl: text("logo_url"),
  publishMethod: text("publish_method").notNull().default("blotato"),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignMemories = pgTable(
  "campaign_memories",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    kind: text("kind").notNull().default("preference"),
    content: text("content").notNull(),
    sourceTaskId: bigint("source_task_id", { mode: "number" }),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaign_memories_campaign_idx").on(t.campaignId)]
);

export const agentSettings = pgTable(
  "agent_settings",
  {
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    customInstructions: text("custom_instructions").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.agentId] })]
);

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    sender: text("sender").notNull(),
    text: text("text").notNull(),
    metadata: jsonb("metadata")
      .$type<{
        planId?: number;
        images?: string[];
        postIds?: number[];
        toolCalls?: string[];
      }>()
      .notNull()
      .default({}),
    failed: boolean("failed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("agent_messages_chat_idx").on(t.userId, t.campaignId, t.agentId, t.id),
  ]
);

export const agentPlans = pgTable(
  "agent_plans",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    request: text("request").notNull(),
    status: text("status").notNull().default("in_progress"),
    summary: text("summary"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("agent_plans_campaign_idx").on(t.userId, t.campaignId, t.id)]
);

export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    planId: bigint("plan_id", { mode: "number" })
      .notNull()
      .references(() => agentPlans.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    position: integer("position").notNull().default(0),
    title: text("title").notNull(),
    instructions: text("instructions").notNull(),
    dependsOn: jsonb("depends_on").$type<number[]>().notNull().default([]),
    status: text("status").notNull().default("pending"),
    output: text("output"),
    question: text("question"),
    review: text("review"),
    revisions: integer("revisions").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
    repeat: jsonb("repeat").$type<RepeatRule | null>(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    runCount: integer("run_count").notNull().default(0),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    queueSeq: integer("queue_seq").notNull().default(0),
    runOwner: text("run_owner"),
    sandboxId: text("sandbox_id"),
    runState: text("run_state"),
    interruption: jsonb("interruption").$type<TaskInterruption | null>(),
    currentStep: text("current_step"),
    waitingSince: timestamp("waiting_since", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("agent_tasks_plan_idx").on(t.planId, t.position),
    index("agent_tasks_campaign_idx").on(t.campaignId),
  ]
);

export const agentCommunications = pgTable(
  "agent_communications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    planId: bigint("plan_id", { mode: "number" })
      .notNull()
      .references(() => agentPlans.id, { onDelete: "cascade" }),
    taskId: bigint("task_id", { mode: "number" }).references(() => agentTasks.id, {
      onDelete: "cascade",
    }),
    fromAgent: text("from_agent").notNull(),
    toAgent: text("to_agent").notNull(),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_communications_plan_idx").on(t.planId, t.id)]
);

export const agentTaskRuns = pgTable(
  "agent_task_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    taskId: bigint("task_id", { mode: "number" })
      .notNull()
      .references(() => agentTasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    queueSeq: integer("queue_seq").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    inngestRunId: text("inngest_run_id").notNull(),
    status: text("status").notNull().default("in_progress"),
    output: text("output"),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique("agent_task_runs_unique_seq").on(t.taskId, t.queueSeq)]
);

export const agentSandboxes = pgTable(
  "agent_sandboxes",
  {
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sandboxId: text("sandbox_id"),
    status: text("status").notNull().default("none"),
    activeAt: timestamp("active_at", { withTimezone: true }),
    taskId: bigint("task_id", { mode: "number" }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    control: text("control").notNull().default("agent"),
    streamKey: text("stream_key"),
    viewKey: text("view_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.agentId] })]
);

export const sandboxPreviews = pgTable(
  "sandbox_previews",
  {
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    image: text("image").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.agentId] })]
);

export const agentArtifacts = pgTable(
  "agent_artifacts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    planId: bigint("plan_id", { mode: "number" }),
    taskId: bigint("task_id", { mode: "number" }),
    taskRunId: bigint("task_run_id", { mode: "number" }),
    agentId: text("agent_id").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    url: text("url"),
    imagekitFileId: text("imagekit_file_id"),
    sandboxPath: text("sandbox_path"),
    mimeType: text("mime_type"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_artifacts_campaign_idx").on(t.campaignId, t.id)]
);

export const researchFindings = pgTable("research_findings", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  planId: bigint("plan_id", { mode: "number" }),
  taskId: bigint("task_id", { mode: "number" }),
  taskRunId: bigint("task_run_id", { mode: "number" }),
  agentId: text("agent_id").notNull(),
  topic: text("topic").notNull(),
  summary: text("summary").notNull(),
  method: text("method").notNull().default("mixed"),
  platforms: text("platforms").array().notNull().default([]),
  hashtags: text("hashtags").array().notNull().default([]),
  findings: jsonb("findings").$type<Array<{ insight: string; details: string }>>().notNull().default([]),
  sources: jsonb("sources").$type<Array<{ title: string; url: string; platform?: string }>>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentDrafts = pgTable("content_drafts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  planId: bigint("plan_id", { mode: "number" }),
  taskId: bigint("task_id", { mode: "number" }),
  taskRunId: bigint("task_run_id", { mode: "number" }),
  agentId: text("agent_id").notNull(),
  kind: text("kind").notNull().default("post"),
  platform: text("platform").notNull(),
  title: text("title").notNull(),
  hook: text("hook"),
  body: text("body").notNull(),
  cta: text("cta"),
  hashtags: text("hashtags").array().notNull().default([]),
  media: jsonb("media").$type<PostMediaItem[]>().notNull().default([]),
  notes: text("notes"),
  status: text("status").notNull().default("draft"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentOutputs = pgTable("agent_outputs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  planId: bigint("plan_id", { mode: "number" }).notNull(),
  taskId: bigint("task_id", { mode: "number" }).notNull(),
  taskRunId: bigint("task_run_id", { mode: "number" }),
  runNumber: integer("run_number").notNull().default(1),
  agentId: text("agent_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  details: text("details"),
  output: text("output").notNull(),
  review: text("review"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable(
  "posts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("manual"),
    draftId: bigint("draft_id", { mode: "number" }),
    title: text("title").notNull(),
    caption: text("caption").notNull().default(""),
    hashtags: text("hashtags").array().notNull().default([]),
    platforms: text("platforms").array().notNull().default(["instagram"]),
    media: jsonb("media").$type<PostMediaItem[]>().notNull().default([]),
    status: text("status").notNull().default("scheduled"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    timeZone: text("time_zone").notNull().default("UTC"),
    accountIds: jsonb("account_ids").$type<Record<string, string>>().notNull().default({}),
    platformResults: jsonb("platform_results")
      .$type<Record<string, PlatformPublishResult>>()
      .notNull()
      .default({}),
    error: text("error"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("posts_campaign_idx").on(t.campaignId, t.id),
    index("posts_due_idx").on(t.status, t.scheduledAt),
  ]
);

export const userIntegrations = pgTable(
  "user_integrations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    endpointUrl: text("endpoint_url"),
    keyHint: text("key_hint").notNull(),
    accounts: jsonb("accounts").$type<ConnectedAccount[]>().notNull().default([]),
    accountsRefreshedAt: timestamp("accounts_refreshed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("user_integrations_user_provider").on(t.userId, t.provider)]
);

export const postAnalytics = pgTable(
  "post_analytics",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blotatoPostId: text("blotato_post_id").notNull(),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    postId: bigint("post_id", { mode: "number" }).references(() => posts.id, {
      onDelete: "set null",
    }),
    accountId: text("account_id"),
    platform: text("platform").notNull(),
    state: text("state").notNull().default("published"),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    text: text("text"),
    postUrl: text("post_url"),
    error: text("error"),
    views: bigint("views", { mode: "number" }),
    likes: bigint("likes", { mode: "number" }),
    comments: bigint("comments", { mode: "number" }),
    shares: bigint("shares", { mode: "number" }),
    saves: bigint("saves", { mode: "number" }),
    reach: bigint("reach", { mode: "number" }),
    impressions: bigint("impressions", { mode: "number" }),
    rawMetrics: jsonb("raw_metrics").$type<Record<string, unknown> | null>(),
    metricsHistory: jsonb("metrics_history").$type<Array<Record<string, unknown>>>().notNull().default([]),
    metricsFetchedAt: timestamp("metrics_fetched_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("post_analytics_unique").on(t.userId, t.blotatoPostId)]
);

export const analyticsSyncs = pgTable("analytics_syncs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  lastError: text("last_error"),
  postsSynced: integer("posts_synced").notNull().default(0),
});
