import "server-only";
import path from "path";
import fs from "fs";
import postgres from "postgres";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

type AppDb = PostgresJsDatabase<typeof schema> | PgliteDatabase<typeof schema>;

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  avatar_url text,
  password_hash text,
  provider text NOT NULL DEFAULT 'email',
  active_campaign_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  icon_url text,
  icon_key text,
  office_image text NOT NULL DEFAULT 'wooden-office',
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_user_id_idx ON campaigns(user_id);

CREATE TABLE IF NOT EXISTS campaign_profiles (
  campaign_id integer PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  voice text NOT NULL DEFAULT 'Friendly, authentic, and engaging',
  audience text NOT NULL DEFAULT '',
  goals text NOT NULL DEFAULT '',
  platforms text[] NOT NULL DEFAULT ARRAY['instagram','tiktok','youtube'],
  time_zone text NOT NULL DEFAULT 'UTC',
  language text NOT NULL DEFAULT 'en',
  competitors text[] NOT NULL DEFAULT '{}',
  dos text[] NOT NULL DEFAULT '{}',
  donts text[] NOT NULL DEFAULT '{}',
  brand_colors jsonb NOT NULL DEFAULT '["#2563EB","#0F172A"]',
  logo_url text,
  publish_method text NOT NULL DEFAULT 'blotato',
  requires_approval boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_memories (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  kind text NOT NULL DEFAULT 'preference',
  content text NOT NULL,
  source_task_id bigint,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_memories_campaign_idx ON campaign_memories(campaign_id);

CREATE TABLE IF NOT EXISTS agent_settings (
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  custom_instructions text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, agent_id)
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  sender text NOT NULL,
  text text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  failed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_messages_chat_idx ON agent_messages(user_id, campaign_id, agent_id, id DESC);

CREATE TABLE IF NOT EXISTS agent_plans (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title text NOT NULL,
  request text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  summary text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS agent_plans_campaign_idx ON agent_plans(user_id, campaign_id, id DESC);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id bigserial PRIMARY KEY,
  plan_id bigint NOT NULL REFERENCES agent_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  instructions text NOT NULL,
  depends_on jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending',
  output text,
  question text,
  review text,
  revisions integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  repeat jsonb,
  next_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  consecutive_failures integer NOT NULL DEFAULT 0,
  queue_seq integer NOT NULL DEFAULT 0,
  run_owner text,
  sandbox_id text,
  run_state text,
  interruption jsonb,
  current_step text,
  waiting_since timestamptz,
  expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_tasks_plan_idx ON agent_tasks(plan_id, position);
CREATE INDEX IF NOT EXISTS agent_tasks_campaign_idx ON agent_tasks(campaign_id);

CREATE TABLE IF NOT EXISTS agent_communications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  plan_id bigint NOT NULL REFERENCES agent_plans(id) ON DELETE CASCADE,
  task_id bigint REFERENCES agent_tasks(id) ON DELETE CASCADE,
  from_agent text NOT NULL,
  to_agent text NOT NULL,
  kind text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_communications_plan_idx ON agent_communications(plan_id, id);

CREATE TABLE IF NOT EXISTS agent_task_runs (
  id bigserial PRIMARY KEY,
  task_id bigint NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  queue_seq integer NOT NULL,
  scheduled_for timestamptz NOT NULL,
  inngest_run_id text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  output text,
  result jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT agent_task_runs_unique_seq UNIQUE (task_id, queue_seq)
);

CREATE TABLE IF NOT EXISTS agent_sandboxes (
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sandbox_id text,
  status text NOT NULL DEFAULT 'none',
  active_at timestamptz,
  task_id bigint,
  lease_until timestamptz,
  control text NOT NULL DEFAULT 'agent',
  stream_key text,
  view_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, agent_id)
);

CREATE TABLE IF NOT EXISTS sandbox_previews (
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image text NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, agent_id)
);

CREATE TABLE IF NOT EXISTS agent_artifacts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  plan_id bigint,
  task_id bigint,
  task_run_id bigint,
  agent_id text NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  url text,
  imagekit_file_id text,
  sandbox_path text,
  mime_type text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_artifacts_campaign_idx ON agent_artifacts(campaign_id, id DESC);

CREATE TABLE IF NOT EXISTS research_findings (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  plan_id bigint,
  task_id bigint,
  task_run_id bigint,
  agent_id text NOT NULL,
  topic text NOT NULL,
  summary text NOT NULL,
  method text NOT NULL DEFAULT 'mixed',
  platforms text[] NOT NULL DEFAULT '{}',
  hashtags text[] NOT NULL DEFAULT '{}',
  findings jsonb NOT NULL DEFAULT '[]',
  sources jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_drafts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  plan_id bigint,
  task_id bigint,
  task_run_id bigint,
  agent_id text NOT NULL,
  kind text NOT NULL DEFAULT 'post',
  platform text NOT NULL,
  title text NOT NULL,
  hook text,
  body text NOT NULL,
  cta text,
  hashtags text[] NOT NULL DEFAULT '{}',
  media jsonb NOT NULL DEFAULT '[]',
  notes text,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_outputs (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  plan_id bigint NOT NULL,
  task_id bigint NOT NULL,
  task_run_id bigint,
  run_number integer NOT NULL DEFAULT 1,
  agent_id text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  summary text,
  details text,
  output text NOT NULL,
  review text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  draft_id bigint,
  title text NOT NULL,
  caption text NOT NULL DEFAULT '',
  hashtags text[] NOT NULL DEFAULT '{}',
  platforms text[] NOT NULL DEFAULT ARRAY['instagram'],
  media jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'scheduled',
  scheduled_at timestamptz,
  time_zone text NOT NULL DEFAULT 'UTC',
  account_ids jsonb NOT NULL DEFAULT '{}',
  platform_results jsonb NOT NULL DEFAULT '{}',
  error text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_campaign_idx ON posts(campaign_id, id DESC);
CREATE INDEX IF NOT EXISTS posts_due_idx ON posts(status, scheduled_at);

CREATE TABLE IF NOT EXISTS user_integrations (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  api_key_encrypted text NOT NULL,
  endpoint_url text,
  key_hint text NOT NULL,
  accounts jsonb NOT NULL DEFAULT '[]',
  accounts_refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_integrations_user_provider UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS post_analytics (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blotato_post_id text NOT NULL,
  campaign_id integer REFERENCES campaigns(id) ON DELETE SET NULL,
  post_id bigint REFERENCES posts(id) ON DELETE SET NULL,
  account_id text,
  platform text NOT NULL,
  state text NOT NULL DEFAULT 'published',
  posted_at timestamptz NOT NULL,
  text text,
  post_url text,
  error text,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  reach bigint,
  impressions bigint,
  raw_metrics jsonb,
  metrics_history jsonb NOT NULL DEFAULT '[]',
  metrics_fetched_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_analytics_unique UNIQUE (user_id, blotato_post_id)
);

CREATE TABLE IF NOT EXISTS analytics_syncs (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_synced_at timestamptz,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  posts_synced integer NOT NULL DEFAULT 0
);
`;

declare global {
  var __socialixDbPromise: Promise<AppDb> | undefined;
}

async function initDatabase(): Promise<AppDb> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const useSsl =
        databaseUrl.includes("render.com") ||
        databaseUrl.includes("dpg-") ||
        databaseUrl.includes("sslmode=require") ||
        process.env.NODE_ENV === "production";
      const client = postgres(databaseUrl, {
        max: 10,
        idle_timeout: 30,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      });
      const db = drizzlePg(client, { schema });
      await client.unsafe(BOOTSTRAP_SQL);
      return db;
    } catch (pgErr) {
      console.warn("[Database] Remote Postgres connection/bootstrap failed, falling back to PGlite:", pgErr);
    }
  }

  const dataDir = path.join(process.cwd(), ".data", "pgdata");
  fs.mkdirSync(dataDir, { recursive: true });

  // Clean up stale lock/pid files left behind by ungraceful process exits
  const pidFile = path.join(dataDir, "postmaster.pid");
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
    } catch {
      // ignore
    }
  }

  let pg: PGlite;
  try {
    pg = new PGlite(dataDir);
    await pg.waitReady;
  } catch (err) {
    console.warn("[Database] PGlite failed to resume, auto-recovering clean storage:", err);
    try {
      const backupDir = path.join(process.cwd(), ".data", `pgdata_recovered_${Date.now()}`);
      try {
        fs.renameSync(dataDir, backupDir);
      } catch {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
      fs.mkdirSync(dataDir, { recursive: true });
      pg = new PGlite(dataDir);
      await pg.waitReady;
    } catch (fallbackErr) {
      console.warn("[Database] Using in-memory PGlite fallback:", fallbackErr);
      pg = new PGlite();
      await pg.waitReady;
    }
  }

  try {
    await pg.exec(BOOTSTRAP_SQL);
  } catch (sqlErr: any) {
    if (sqlErr.message?.includes("File exists") || sqlErr.message?.includes("already exists")) {
      console.warn("[Database] Concurrent schema bootstrap detected; falling back to clean in-memory instance:", sqlErr.message);
      pg = new PGlite();
      await pg.waitReady;
      await pg.exec(BOOTSTRAP_SQL);
    } else {
      throw sqlErr;
    }
  }
  return drizzlePglite(pg, { schema });
}

export async function getDb(): Promise<PgliteDatabase<typeof schema>> {
  if (!globalThis.__socialixDbPromise) {
    globalThis.__socialixDbPromise = initDatabase().catch((err) => {
      globalThis.__socialixDbPromise = undefined;
      throw err;
    });
  }
  return (await globalThis.__socialixDbPromise) as PgliteDatabase<typeof schema>;
}

export { schema };
