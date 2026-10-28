import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, users } from "@/db/schema";
import {
  clearSessionCookie,
  createSessionCookie,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null, campaigns: [] });
  }
  const db = await getDb();
  const userCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.userId, user.id))
    .orderBy(desc(campaigns.createdAt));

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
      activeCampaignId: user.activeCampaignId,
    },
    campaigns: userCampaigns,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action: "sign-in" | "sign-up" | "google" | "demo" | "sign-out";
      email?: string;
      password?: string;
      name?: string;
    };

    if (body.action === "sign-out") {
      await clearSessionCookie();
      return NextResponse.json({ ok: true, signedOut: true });
    }

    const db = await getDb();

    if (body.action === "demo" || body.action === "google") {
      const email =
        body.email?.trim().toLowerCase() ||
        (body.action === "google" ? "creator@socialix.studio" : "demo@socialix.studio");
      const name =
        body.name?.trim() ||
        (body.action === "google" ? "Alex Rivera" : "TubeGuruji Creator");

      let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        [user] = await db
          .insert(users)
          .values({
            email,
            name,
            provider: body.action,
          })
          .returning();
      }
      const token = await createSessionCookie(user.id);
      const userCampaigns = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.userId, user.id));

      return NextResponse.json({
        ok: true,
        token,
        hasCampaign: userCampaigns.length > 0,
        redirectTo: userCampaigns.length > 0 ? "/dashboard" : "/create-campaign",
      });
    }

    const email = body.email?.trim().toLowerCase();
    const password = body.password || "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (body.action === "sign-up") {
      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 }
        );
      }
      const name = body.name?.trim() || email.split("@")[0];
      const [created] = await db
        .insert(users)
        .values({
          email,
          name,
          passwordHash: hashPassword(password),
          provider: "email",
        })
        .returning();

      const token = await createSessionCookie(created.id);
      return NextResponse.json({
        ok: true,
        token,
        hasCampaign: false,
        redirectTo: "/create-campaign",
      });
    }

    if (body.action === "sign-in") {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return NextResponse.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }
      const token = await createSessionCookie(user.id);
      const userCampaigns = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.userId, user.id));

      return NextResponse.json({
        ok: true,
        token,
        hasCampaign: userCampaigns.length > 0,
        redirectTo: userCampaigns.length > 0 ? "/dashboard" : "/create-campaign",
      });
    }

    return NextResponse.json({ error: "Unsupported auth action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Authentication failed" },
      { status: 500 }
    );
  }
}
