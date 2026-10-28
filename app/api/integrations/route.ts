import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userIntegrations } from "@/db/schema";
import { getOrBootstrapWorkspaceUser } from "@/lib/auth";
import { decryptSecret, encryptSecret, makeKeyHint } from "@/lib/crypto/secrets";
import {
  getUserConnectedAccounts,
  verifyAndFetchAccounts,
  type SocialProvider,
} from "@/lib/mcp/client";
import { verifyAndFetchFacebookPages } from "@/lib/social/facebook";

export async function GET() {
  const user = await getOrBootstrapWorkspaceUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getUserConnectedAccounts(user.id);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const user = await getOrBootstrapWorkspaceUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const body = (await req.json()) as {
    action: "connect" | "refresh" | "disconnect" | "connect-demo";
    provider?: string;
    apiKey?: string;
    endpointUrl?: string;
  };

  if (body.action === "connect-demo") {
    const provider: SocialProvider =
      body.provider === "openpost"
        ? "openpost"
        : body.provider === "facebook"
        ? "facebook"
        : "blotato";
    const demoCheck =
      provider === "facebook"
        ? await verifyAndFetchFacebookPages("demo-mode-key", body.endpointUrl)
        : await verifyAndFetchAccounts(provider, "demo-mode-key");
    const enc = encryptSecret("demo-mode-key");

    await db
      .insert(userIntegrations)
      .values({
        userId: user.id,
        provider,
        apiKeyEncrypted: enc,
        endpointUrl:
          provider === "openpost"
            ? body.endpointUrl || "http://localhost:8080/mcp"
            : provider === "facebook"
            ? body.endpointUrl || "fb_page_demo_01"
            : "https://mcp.blotato.com/mcp",
        keyHint: "••••demo",
        accounts: demoCheck.accounts,
        accountsRefreshedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userIntegrations.userId, userIntegrations.provider],
        set: {
          apiKeyEncrypted: enc,
          keyHint: "••••demo",
          accounts: demoCheck.accounts,
          accountsRefreshedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    const updated = await getUserConnectedAccounts(user.id);
    return NextResponse.json({ ok: true, ...updated });
  }

  if (body.action === "connect") {
    const provider = String(body.provider || "blotato");
    const apiKey = String(body.apiKey || "").trim();
    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    const encrypted = encryptSecret(apiKey);
    const hint = makeKeyHint(apiKey);
    let accounts = [] as Awaited<ReturnType<typeof verifyAndFetchAccounts>>["accounts"];
    let warning: string | undefined;

    if (
      provider === "blotato" ||
      provider === "openpost" ||
      provider === "facebook"
    ) {
      const check = await verifyAndFetchAccounts(
        provider,
        apiKey,
        body.endpointUrl || null
      );
      if (!check.ok) {
        return NextResponse.json(
          { error: check.warning || "Could not verify API key" },
          { status: 400 }
        );
      }
      accounts = check.accounts;
      warning = check.warning;
    } else if ((body as Record<string, unknown>).model) {
      accounts = [
        {
          id: "model",
          name: String((body as Record<string, unknown>).model).trim(),
          username: String((body as Record<string, unknown>).model).trim(),
          platform: provider,
          status: "connected",
        },
      ];
    }

    await db
      .insert(userIntegrations)
      .values({
        userId: user.id,
        provider,
        apiKeyEncrypted: encrypted,
        endpointUrl: body.endpointUrl || null,
        keyHint: hint,
        accounts,
        accountsRefreshedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userIntegrations.userId, userIntegrations.provider],
        set: {
          apiKeyEncrypted: encrypted,
          endpointUrl: body.endpointUrl || null,
          keyHint: hint,
          accounts,
          accountsRefreshedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    const updated = await getUserConnectedAccounts(user.id);
    return NextResponse.json({ ok: true, warning, ...updated });
  }

  if (body.action === "refresh") {
    const rows = await db
      .select()
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, user.id));

    for (const r of rows) {
      if (
        r.provider !== "blotato" &&
        r.provider !== "openpost" &&
        r.provider !== "facebook"
      )
        continue;
      try {
        const plain = decryptSecret(r.apiKeyEncrypted);
        const check = await verifyAndFetchAccounts(
          r.provider as SocialProvider,
          plain,
          r.endpointUrl
        );
        if (check.ok && check.accounts.length > 0) {
          await db
            .update(userIntegrations)
            .set({
              accounts: check.accounts,
              accountsRefreshedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(userIntegrations.id, r.id));
        }
      } catch {
        continue;
      }
    }

    const updated = await getUserConnectedAccounts(user.id);
    return NextResponse.json({ ok: true, ...updated });
  }

  if (body.action === "disconnect" && body.provider) {
    await db
      .delete(userIntegrations)
      .where(
        and(
          eq(userIntegrations.userId, user.id),
          eq(userIntegrations.provider, body.provider)
        )
      );
    const updated = await getUserConnectedAccounts(user.id);
    return NextResponse.json({ ok: true, ...updated });
  }

  return NextResponse.json({ error: "Invalid integration action" }, { status: 400 });
}
