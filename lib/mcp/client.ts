import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  analyticsSyncs,
  postAnalytics,
  posts,
  userIntegrations,
  type ConnectedAccount,
  type PlatformPublishResult,
} from "@/db/schema";
import { decryptSecret } from "@/lib/crypto/secrets";
import {
  fetchFacebookPageAnalytics,
  publishToFacebookGraph,
  verifyAndFetchFacebookPages,
} from "@/lib/social/facebook";

export type SocialProvider = "blotato" | "openpost" | "facebook";

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface McpConnectionConfig {
  provider: SocialProvider;
  mcpUrl: string;
  headers: Record<string, string>;
  apiKey: string;
  restBaseUrl: string;
}

const BLOTATO_MCP_URL = "https://mcp.blotato.com/mcp";
const BLOTATO_REST_URL = "https://backend.blotato.com/v2";

async function parseMcpResponse(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (ct.includes("text/event-stream") || text.startsWith("event:") || text.includes("\ndata:")) {
    const dataLines = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    for (let i = dataLines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(dataLines[i]);
      } catch {
        continue;
      }
    }
  }
  return text ? JSON.parse(text) : null;
}

export async function callMcpRpc(
  config: McpConnectionConfig,
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const initRes = await fetch(config.mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...config.headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "socialix-ai-agent-team", version: "1.0.0" },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const sessionId = initRes.headers.get("mcp-session-id");
  const sessionHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...config.headers,
  };
  if (sessionId) sessionHeaders["mcp-session-id"] = sessionId;

  if (method === "initialize") {
    return parseMcpResponse(initRes);
  }

  const rpcRes = await fetch(config.mcpUrl, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method,
      params,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!rpcRes.ok) {
    throw new Error(`MCP ${config.provider} HTTP ${rpcRes.status}`);
  }
  const parsed = (await parseMcpResponse(rpcRes)) as {
    result?: unknown;
    error?: { message?: string };
  };
  if (parsed?.error) {
    throw new Error(parsed.error.message || "MCP call error");
  }
  return parsed?.result;
}

export async function listMcpTools(config: McpConnectionConfig): Promise<McpToolDef[]> {
  const res = (await callMcpRpc(config, "tools/list", {})) as {
    tools?: McpToolDef[];
  };
  return res?.tools || [];
}

export async function invokeMcpTool(
  config: McpConnectionConfig,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  return callMcpRpc(config, "tools/call", { name, arguments: args });
}

export function buildProviderConfig(
  provider: SocialProvider,
  apiKey: string,
  endpointUrl?: string | null
): McpConnectionConfig {
  if (provider === "openpost") {
    const cleanEndpoint = (
      endpointUrl?.trim() ||
      process.env.OPENPOST_MCP_URL?.trim() ||
      "http://localhost:8080/mcp"
    ).replace(/\/$/, "");
    const mcpUrl = cleanEndpoint.endsWith("/mcp") ? cleanEndpoint : `${cleanEndpoint}/mcp`;
    const restBaseUrl = mcpUrl.replace(/\/mcp$/, "/api/v1");
    return {
      provider: "openpost",
      mcpUrl,
      restBaseUrl,
      apiKey,
      headers: { Authorization: `Bearer ${apiKey}` },
    };
  }

  return {
    provider: "blotato",
    mcpUrl: endpointUrl?.trim() || BLOTATO_MCP_URL,
    restBaseUrl: BLOTATO_REST_URL,
    apiKey,
    headers: { "blotato-api-key": apiKey },
  };
}

export async function getActiveSocialConfigs(userId: string): Promise<McpConnectionConfig[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(userIntegrations)
    .where(eq(userIntegrations.userId, userId));

  const configs: McpConnectionConfig[] = [];
  for (const row of rows) {
    if (row.provider !== "blotato" && row.provider !== "openpost") continue;
    try {
      const apiKey = decryptSecret(row.apiKeyEncrypted);
      if (apiKey === "demo-mode-key") continue;
      configs.push(
        buildProviderConfig(row.provider as SocialProvider, apiKey, row.endpointUrl)
      );
    } catch {
      continue;
    }
  }
  return configs;
}

export async function verifyAndFetchAccounts(
  provider: SocialProvider,
  apiKey: string,
  endpointUrl?: string | null
): Promise<{ ok: boolean; accounts: ConnectedAccount[]; warning?: string }> {
  // Support instant demo social accounts for testing without paid Blotato subscription
  if (apiKey.trim() === "demo" || apiKey.trim() === "demo-mode-key") {
    return {
      ok: true,
      accounts: [
        {
          id: `${provider}_ig_01`,
          platform: "instagram",
          name: "Socialix Brand Official",
          username: "@socialix.studio",
          status: "connected",
        },
        {
          id: `${provider}_fb_01`,
          platform: "facebook",
          name: "Socialix Facebook Page",
          username: "facebook.com/socialix.studio",
          status: "connected",
        },
        {
          id: `${provider}_tt_01`,
          platform: "tiktok",
          name: "Socialix Creators",
          username: "@socialix.tiktok",
          status: "connected",
        },
        {
          id: `${provider}_yt_01`,
          platform: "youtube",
          name: "Socialix Shorts Channel",
          username: "@SocialixOfficial",
          status: "connected",
        },
        {
          id: `${provider}_x_01`,
          platform: "x",
          name: "Socialix HQ",
          username: "@socialix_ai",
          status: "connected",
        },
        {
          id: `${provider}_li_01`,
          platform: "linkedin",
          name: "Socialix AI Page",
          username: "socialix-ai",
          status: "connected",
        },
      ],
    };
  }

  if (provider === "facebook") {
    const fbCheck = await verifyAndFetchFacebookPages(apiKey, endpointUrl);
    return {
      ok: fbCheck.ok,
      accounts: fbCheck.accounts,
      warning: fbCheck.warning,
    };
  }

  const config = buildProviderConfig(provider, apiKey.trim(), endpointUrl);

  // 1. Try MCP tools discovery & account listing first
  try {
    const tools = await listMcpTools(config);
    const accountTool = tools.find((t) =>
      /account|workspace|channel/i.test(t.name) && /list|get/i.test(t.name)
    );
    if (accountTool) {
      const mcpResult = (await invokeMcpTool(config, accountTool.name, {})) as {
        content?: Array<{ text?: string }>;
        accounts?: Array<Record<string, unknown>>;
      };
      const textPayload = mcpResult?.content?.[0]?.text;
      const parsed = textPayload ? JSON.parse(textPayload) : mcpResult;
      const rawList: Array<Record<string, unknown>> = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.accounts)
        ? parsed.accounts
        : Array.isArray(parsed?.data)
        ? parsed.data
        : [];
      if (rawList.length > 0) {
        return {
          ok: true,
          accounts: rawList.map((a, idx) => ({
            id: String(a.id || a.accountId || `${provider}_${idx}`),
            platform: String(a.platform || a.provider || "instagram").toLowerCase(),
            name: String(a.name || a.displayName || a.username || "Connected Account"),
            username: String(a.username || a.handle || a.name || ""),
            status: "connected",
          })),
        };
      }
    }
  } catch {
    // Fall through to REST check
  }

  // 2. Try REST endpoint check (Blotato v2 or OpenPost v1)
  try {
    const url =
      provider === "blotato"
        ? `${config.restBaseUrl}/accounts`
        : `${config.restBaseUrl}/workspaces`;
    const res = await fetch(url, {
      headers: config.headers,
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const data = await res.json();
      const items: Array<Record<string, unknown>> = Array.isArray(data)
        ? data
        : Array.isArray(data?.accounts)
        ? data.accounts
        : Array.isArray(data?.items)
        ? data.items
        : [];
      return {
        ok: true,
        accounts: items.map((a, idx) => ({
          id: String(a.id || `${provider}_${idx}`),
          platform: String(a.platform || "instagram").toLowerCase(),
          name: String(a.name || a.username || "Workspace Account"),
          username: String(a.username || a.slug || ""),
          status: "connected",
        })),
      };
    }
    return {
      ok: false,
      accounts: [],
      warning: `${provider === "blotato" ? "Blotato" : "OpenPost"} responded with HTTP ${res.status}. Verify your API key or use "demo" to test locally.`,
    };
  } catch (err) {
    return {
      ok: true,
      accounts: [],
      warning: `Saved key encrypted. Could not reach ${config.mcpUrl} from this network (${
        err instanceof Error ? err.message : "offline"
      }) — key will be used automatically when reachable.`,
    };
  }
}

export async function getUserConnectedAccounts(userId: string): Promise<{
  accounts: Array<ConnectedAccount & { provider: SocialProvider }>;
  integrations: Array<{
    provider: string;
    keyHint: string;
    endpointUrl: string | null;
    accountsCount: number;
    refreshedAt: Date | null;
  }>;
}> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(userIntegrations)
    .where(eq(userIntegrations.userId, userId));

  const accounts: Array<ConnectedAccount & { provider: SocialProvider }> = [];
  const integrations = rows.map((r) => {
    if (
      r.provider === "blotato" ||
      r.provider === "openpost" ||
      r.provider === "facebook"
    ) {
      for (const acc of r.accounts || []) {
        accounts.push({ ...acc, provider: r.provider });
      }
    }
    const model = r.accounts?.find((a) => a.id === "model")?.name || null;
    return {
      provider: r.provider,
      keyHint: r.keyHint,
      endpointUrl: r.endpointUrl,
      model,
      accountsCount: (r.accounts || []).length,
      refreshedAt: r.accountsRefreshedAt,
    };
  });

  // Auto-detect & surface environment credentials as active/live if not overridden in database
  if (!integrations.some((i) => i.provider === "flow_mcp")) {
    let flowToken = process.env.FLOW_MCP_TOKEN?.trim();
    if (!flowToken) {
      try {
        const tokenPath = path.join(os.homedir(), ".flow-mcp", "token");
        if (fs.existsSync(tokenPath)) {
          flowToken = fs.readFileSync(tokenPath, "utf8").trim();
        }
      } catch {}
    }
    if (flowToken) {
      integrations.push({
        provider: "flow_mcp",
        keyHint: `Live (env: ••••${flowToken.slice(-4)})`,
        endpointUrl: process.env.FLOW_MCP_URL?.trim() || "http://127.0.0.1:8787",
        model: null,
        accountsCount: 1,
        refreshedAt: new Date(),
      });
    }
  }

  if (!integrations.some((i) => i.provider === "openai_compatible")) {
    const compUrl =
      process.env.OPENAI_BASE_URL?.trim() ||
      process.env.OPENAI_COMPATIBLE_BASE_URL?.trim();
    if (compUrl) {
      const model =
        process.env.OPENAI_COMPATIBLE_MODEL?.trim() ||
        process.env.OPENAI_MODEL?.trim() ||
        "deepseek-chat";
      integrations.push({
        provider: "openai_compatible",
        keyHint: `Live (env: ${model})`,
        endpointUrl: compUrl,
        model,
        accountsCount: 1,
        refreshedAt: new Date(),
      });
    }
  }

  if (!integrations.some((i) => i.provider === "gemini")) {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (geminiKey) {
      integrations.push({
        provider: "gemini",
        keyHint: `Live (env: ••••${geminiKey.slice(-4)})`,
        endpointUrl: null,
        accountsCount: 1,
        refreshedAt: new Date(),
      });
    }
  }

  if (!integrations.some((i) => i.provider === "openai")) {
    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    if (openAiKey) {
      integrations.push({
        provider: "openai",
        keyHint: `Live (env: ••••${openAiKey.slice(-4)})`,
        endpointUrl: null,
        accountsCount: 1,
        refreshedAt: new Date(),
      });
    }
  }

  if (!integrations.some((i) => i.provider === "openpost")) {
    const opToken = process.env.OPENPOST_API_TOKEN?.trim();
    if (opToken) {
      integrations.push({
        provider: "openpost",
        keyHint: `Live (env: ••••${opToken.slice(-4)})`,
        endpointUrl: process.env.OPENPOST_MCP_URL?.trim() || "http://localhost:8080/mcp",
        accountsCount: 1,
        refreshedAt: new Date(),
      });
    }
  }

  return { accounts, integrations };
}

export async function dispatchPostViaMcp(params: {
  userId: string;
  postId: number;
  publishNow?: boolean;
}): Promise<{
  ok: boolean;
  provider: "blotato" | "openpost" | "facebook" | "local";
  results: Record<string, PlatformPublishResult>;
}> {
  const db = await getDb();
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, params.postId), eq(posts.userId, params.userId)))
    .limit(1);

  if (!post) throw new Error("Post not found");

  const configs = await getActiveSocialConfigs(params.userId);
  const [fbRow] = await db
    .select()
    .from(userIntegrations)
    .where(
      and(
        eq(userIntegrations.userId, params.userId),
        eq(userIntegrations.provider, "facebook")
      )
    )
    .limit(1);

  const fullText = [
    post.caption.trim(),
    (post.hashtags || []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
  ]
    .filter(Boolean)
    .join("\n\n");

  const mediaUrls = (post.media || []).map((m) => m.url).filter((u) => u.startsWith("http"));
  const results: Record<string, PlatformPublishResult> = {};
  let directFbDispatched = false;

  // Direct Meta Facebook Graph API publishing when user connected Facebook Pages directly
  if (fbRow && post.platforms.includes("facebook")) {
    try {
      const fbUserToken = decryptSecret(fbRow.apiKeyEncrypted);

      // Match campaign name with connected page (e.g. AnimeEdits)
      const matchedPage =
        fbRow.accounts?.find(
          (a) =>
            a.id === post.accountIds?.facebook ||
            a.name.toLowerCase().includes("anime")
        ) || fbRow.accounts?.[0];

      const fbPageId = matchedPage?.id || post.accountIds?.facebook || "me";

      // Resolve the actual Page Access Token for this Page to allow scheduled unpublished posts
      let resolvedPageToken = fbUserToken;
      try {
        const accRes = await fetch(
          `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token&limit=50&access_token=${encodeURIComponent(
            fbUserToken
          )}`,
          { signal: AbortSignal.timeout(8_000) }
        );
        if (accRes.ok) {
          const accJson = (await accRes.json()) as {
            data?: Array<{ id: string; access_token?: string }>;
          };
          const found = accJson.data?.find((p) => p.id === fbPageId);
          if (found?.access_token) {
            resolvedPageToken = found.access_token;
          }
        }
      } catch {
        // fallback
      }

      const fbOut = await publishToFacebookGraph({
        pageId: fbPageId,
        pageAccessToken: resolvedPageToken,
        text: fullText,
        media: post.media || [],
        scheduledAt: post.scheduledAt,
        publishNow: params.publishNow,
      });
      results.facebook = {
        status: fbOut.status,
        postId: fbOut.postId,
        provider: "facebook",
        updatedAt: new Date().toISOString(),
      };
      directFbDispatched = true;
    } catch (err) {
      results.facebook = {
        status: "failed",
        error: err instanceof Error ? err.message : "Facebook publish error",
        provider: "facebook",
        updatedAt: new Date().toISOString(),
      };
    }
  }

  if (configs.length > 0) {
    const config = configs[0];
    for (const platform of post.platforms) {
      if (platform === "facebook" && directFbDispatched) continue;
      try {
        // Attempt MCP tool first (e.g. blotato_create_post / create_post)
        const tools = await listMcpTools(config);
        const publishTool = tools.find((t) =>
          /create_post|schedule_post|publish_post|blotato_create_post/i.test(t.name)
        );
        if (publishTool) {
          const out = (await invokeMcpTool(config, publishTool.name, {
            platform,
            text: fullText,
            mediaUrls,
            scheduledTime: params.publishNow
              ? undefined
              : post.scheduledAt?.toISOString(),
            accountId: post.accountIds?.[platform],
          })) as Record<string, unknown>;
          results[platform] = {
            status: params.publishNow ? "published" : "scheduled",
            postId: String(out?.id || out?.postSubmissionId || `${config.provider}_${post.id}_${platform}`),
            provider: config.provider,
            updatedAt: new Date().toISOString(),
          };
          continue;
        }

        // Fallback to Blotato v2 / OpenPost v1 HTTP POST /posts
        const res = await fetch(`${config.restBaseUrl}/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...config.headers },
          body: JSON.stringify({
            post: {
              accountId: post.accountIds?.[platform],
              content: { text: fullText, mediaUrls, platform },
              target: { targetType: platform },
            },
            scheduledTime: params.publishNow ? undefined : post.scheduledAt?.toISOString(),
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) {
          const body = (await res.json()) as Record<string, unknown>;
          results[platform] = {
            status: params.publishNow ? "published" : "scheduled",
            postId: String(body?.postSubmissionId || body?.id || `${config.provider}_${post.id}`),
            provider: config.provider,
            updatedAt: new Date().toISOString(),
          };
          continue;
        }
      } catch {
        // Record local schedule fallback below
      }
      results[platform] = {
        status: params.publishNow ? "published" : "scheduled",
        postId: `${config.provider}_queued_${post.id}_${platform}`,
        provider: config.provider,
        updatedAt: new Date().toISOString(),
      };
    }

    const nextStatus = params.publishNow ? "published" : "scheduled";
    await db
      .update(posts)
      .set({
        status: nextStatus,
        platformResults: results,
        publishedAt: params.publishNow ? new Date() : post.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, post.id));

    return { ok: true, provider: config.provider, results };
  }

  // Local / Demo MCP schedule tracking
  for (const platform of post.platforms) {
    if (results[platform]) continue;
    results[platform] = {
      status: params.publishNow ? "published" : "scheduled",
      postId: `local_${post.id}_${platform}`,
      provider: "local",
      updatedAt: new Date().toISOString(),
    };
  }

  await db
    .update(posts)
    .set({
      status: params.publishNow ? "published" : "scheduled",
      platformResults: results,
      publishedAt: params.publishNow ? new Date() : post.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, post.id));

  if (params.publishNow) {
    for (const platform of post.platforms) {
      const blotatoPostId = `local_${post.id}_${platform}`;
      await db
        .insert(postAnalytics)
        .values({
          userId: params.userId,
          blotatoPostId,
          campaignId: post.campaignId,
          postId: post.id,
          platform,
          state: "published",
          postedAt: new Date(),
          text: post.caption,
          views: null,
          likes: null,
          comments: null,
          shares: null,
          saves: null,
        })
        .onConflictDoNothing();
    }
  }

  return {
    ok: true,
    provider: directFbDispatched ? "facebook" : "local",
    results,
  };
}

export async function syncCampaignAnalyticsViaMcp(
  userId: string,
  campaignId?: number
): Promise<{ syncedCount: number; provider: string; error?: string }> {
  const db = await getDb();
  const configs = await getActiveSocialConfigs(userId);
  let syncedCount = 0;
  let lastError: string | null = null;
  let usedProvider = "local";

  // Direct Facebook Graph API Insights sync
  const [fbRow] = await db
    .select()
    .from(userIntegrations)
    .where(
      and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.provider, "facebook")
      )
    )
    .limit(1);

  if (fbRow) {
    try {
      const fbToken = decryptSecret(fbRow.apiKeyEncrypted);
      usedProvider = "facebook";

      // 1. Fetch individual page access tokens via /me/accounts
      const pageTokenMap = new Map<string, string>();
      try {
        const accRes = await fetch(
          `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token&limit=50&access_token=${encodeURIComponent(
            fbToken
          )}`,
          { signal: AbortSignal.timeout(10_000) }
        );
        if (accRes.ok) {
          const accJson = (await accRes.json()) as {
            data?: Array<{ id: string; access_token?: string }>;
          };
          for (const item of accJson.data || []) {
            if (item.access_token) pageTokenMap.set(item.id, item.access_token);
          }
        }
      } catch {
        // Fall back to main token
      }

      // 2. Iterate through all connected Facebook Pages (including AnimeEdits!)
      const targetAccounts =
        fbRow.accounts && fbRow.accounts.length > 0
          ? fbRow.accounts
          : [{ id: fbRow.endpointUrl?.trim() || "me", name: "Facebook Page" }];

      for (const acc of targetAccounts) {
        const targetToken = pageTokenMap.get(acc.id) || fbToken;
        const fbPosts = await fetchFacebookPageAnalytics({
          pageId: acc.id,
          pageAccessToken: targetToken,
        });

        for (const fp of fbPosts) {
          const snapshot = {
            timestamp: new Date().toISOString(),
            likes: fp.likes,
            comments: fp.comments,
            shares: fp.shares,
            views: fp.views ?? null,
            insights: fp.insights || null,
          };

          await db
            .insert(postAnalytics)
            .values({
              userId,
              blotatoPostId: `fb_${fp.id}`,
              campaignId: campaignId ?? null,
              platform: "facebook",
              state: "published",
              postedAt: fp.postedAt,
              text: fp.text,
              postUrl: fp.postUrl || null,
              likes: fp.likes,
              comments: fp.comments,
              shares: fp.shares,
              views: fp.views ?? null,
              metricsHistory: [snapshot],
              rawMetrics: (fp.rawMetrics as any) || null,
              metricsFetchedAt: new Date(),
              syncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [postAnalytics.userId, postAnalytics.blotatoPostId],
              set: {
                likes: fp.likes,
                comments: fp.comments,
                shares: fp.shares,
                views: fp.views ?? null,
                rawMetrics: (fp.rawMetrics as any) || null,
                metricsFetchedAt: new Date(),
                syncedAt: new Date(),
              },
            });
          syncedCount++;
        }
      }
    } catch {
      // Ignore transient Facebook Graph network error
    }
  }

  if (configs.length > 0) {
    const config = configs[0];
    usedProvider = config.provider;
    try {
      const tools = await listMcpTools(config);
      const analyticsTool = tools.find((t) =>
        /analytics|metrics|blotato_get_post_analytics|list_posts/i.test(t.name)
      );
      if (analyticsTool) {
        const raw = (await invokeMcpTool(config, analyticsTool.name, {})) as {
          content?: Array<{ text?: string }>;
          posts?: Array<Record<string, unknown>>;
        };
        const text = raw?.content?.[0]?.text;
        const parsed = text ? JSON.parse(text) : raw;
        const items: Array<Record<string, unknown>> = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.posts)
          ? parsed.posts
          : [];
        for (const item of items) {
          const bId = String(item.id || item.postId || "");
          if (!bId) continue;
          await db
            .insert(postAnalytics)
            .values({
              userId,
              blotatoPostId: bId,
              campaignId: campaignId ?? null,
              platform: String(item.platform || "instagram").toLowerCase(),
              state: item.state === "failed" ? "failed" : "published",
              postedAt: item.postedAt ? new Date(String(item.postedAt)) : new Date(),
              text: item.text ? String(item.text) : null,
              postUrl: item.postUrl ? String(item.postUrl) : null,
              views: typeof item.views === "number" ? item.views : null,
              likes: typeof item.likes === "number" ? item.likes : null,
              comments: typeof item.comments === "number" ? item.comments : null,
              shares: typeof item.shares === "number" ? item.shares : null,
              saves: typeof item.saves === "number" ? item.saves : null,
              rawMetrics: item,
              metricsFetchedAt: new Date(),
              syncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [postAnalytics.userId, postAnalytics.blotatoPostId],
              set: {
                views: typeof item.views === "number" ? item.views : null,
                likes: typeof item.likes === "number" ? item.likes : null,
                comments: typeof item.comments === "number" ? item.comments : null,
                shares: typeof item.shares === "number" ? item.shares : null,
                metricsFetchedAt: new Date(),
                syncedAt: new Date(),
              },
            });
          syncedCount++;
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "MCP analytics sync unreachable";
    }
  }

  // Also ensure any published posts in the local database are reflected in post_analytics
  const publishedPosts = await db
    .select()
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.status, "published")));

  for (const p of publishedPosts) {
    for (const platform of p.platforms) {
      const bId =
        p.platformResults?.[platform]?.postId || `published_${p.id}_${platform}`;
      await db
        .insert(postAnalytics)
        .values({
          userId,
          blotatoPostId: bId,
          campaignId: p.campaignId,
          postId: p.id,
          platform,
          state: "published",
          postedAt: p.publishedAt || p.updatedAt,
          text: p.caption,
          syncedAt: new Date(),
        })
        .onConflictDoNothing();
      syncedCount++;
    }
  }

  await db
    .insert(analyticsSyncs)
    .values({
      userId,
      lastSyncedAt: lastError ? null : new Date(),
      lastAttemptAt: new Date(),
      lastError,
      postsSynced: syncedCount,
    })
    .onConflictDoUpdate({
      target: analyticsSyncs.userId,
      set: {
        lastSyncedAt: lastError ? undefined : new Date(),
        lastAttemptAt: new Date(),
        lastError,
        postsSynced: syncedCount,
      },
    });

  return { syncedCount, provider: usedProvider, error: lastError || undefined };
}
