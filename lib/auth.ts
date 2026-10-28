import "server-only";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cookies, headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

const SESSION_COOKIE = "socialix_session";

function getSessionFilePath(): string {
  const dir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "active-session.json");
}

function writeLocalPreviewSession(token: string | null, signedOut = false): void {
  try {
    fs.writeFileSync(
      getSessionFilePath(),
      JSON.stringify({ token, signedOut, updatedAt: Date.now() }),
      "utf8"
    );
  } catch {
    // Ignore filesystem errors in read-only serverless environments
  }
}

function readLocalPreviewSession(): { token: string | null; signedOut: boolean } | null {
  try {
    const file = getSessionFilePath();
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as {
      token: string | null;
      signedOut: boolean;
    };
  } catch {
    return null;
  }
}

function getSessionSecret(): string {
  return (
    process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim() ||
    "socialix-session-signing-secret-key-2026"
  );
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .pbkdf2Sync(password, salt, 100_000, 64, "sha512")
    .toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, expected] = stored.split(":");
  const actual = crypto
    .pbkdf2Sync(password, salt, 100_000, 64, "sha512")
    .toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(actual, "hex"),
    Buffer.from(expected, "hex")
  );
}

export function signToken(userId: string): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig)))
    return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as {
      uid?: string;
      exp?: number;
    };
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

export async function createSessionCookie(userId: string): Promise<string> {
  const token = signToken(userId);
  writeLocalPreviewSession(token, false);

  try {
    const hdrs = await headers();
    const proto = hdrs.get("x-forwarded-proto") || "";
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
    const isHttps =
      proto.includes("https") ||
      host.endsWith(".e2b.app") ||
      host.endsWith(".vercel.app");

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      ...(isHttps ? { partitioned: true } : {}),
    });
  } catch {
    // Ignore cookie mutation errors if called outside mutable context
  }

  return token;
}

export async function clearSessionCookie(): Promise<void> {
  writeLocalPreviewSession(null, true);

  try {
    const hdrs = await headers();
    const proto = hdrs.get("x-forwarded-proto") || "";
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
    const isHttps =
      proto.includes("https") ||
      host.endsWith(".e2b.app") ||
      host.endsWith(".vercel.app");

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      ...(isHttps ? { partitioned: true } : {}),
    });
  } catch {
    // Ignore
  }
}

export async function getCurrentUser() {
  try {
    let token: string | null = null;

    // 1. Check standard / CHIPS partitioned cookie
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE)?.value || null;

    // 2. Check iframe-safe header token (x-socialix-token or Authorization: Bearer)
    if (!token) {
      const hdrs = await headers();
      const customHdr = hdrs.get("x-socialix-token")?.trim();
      const authHdr = hdrs.get("authorization")?.trim();
      if (customHdr) {
        token = customHdr;
      } else if (authHdr?.toLowerCase().startsWith("bearer ")) {
        token = authHdr.slice(7).trim();
      }
    }

    // 3. Check local preview session fallback when 3rd-party cookies are blocked in iframes
    if (!token && process.env.ENFORCE_STRICT_AUTH !== "true") {
      const fallback = readLocalPreviewSession();
      if (fallback && !fallback.signedOut && fallback.token) {
        token = fallback.token;
      }
    }

    const db = await getDb();

    if (token) {
      const userId = verifyToken(token);
      if (userId) {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (user) return user;
      }
    }

    // 4. If user already created an account in this sandbox DB and didn't explicitly sign out,
    // seamlessly recover their session when embedded in a cookie-blocking iframe
    if (process.env.ENFORCE_STRICT_AUTH !== "true") {
      const fallback = readLocalPreviewSession();
      if (!fallback?.signedOut) {
        const [latestUser] = await db
          .select()
          .from(users)
          .orderBy(desc(users.createdAt))
          .limit(1);
        if (latestUser) {
          return latestUser;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function getOrBootstrapWorkspaceUser() {
  const existing = await getCurrentUser();
  if (existing) return existing;

  const db = await getDb();
  const [firstUser] = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(1);
  if (firstUser) {
    await createSessionCookie(firstUser.id);
    return firstUser;
  }

  const [created] = await db
    .insert(users)
    .values({
      email: "creator@socialix.studio",
      name: "Socialix Creator",
      provider: "demo",
    })
    .returning();
  await createSessionCookie(created.id);
  return created;
}
