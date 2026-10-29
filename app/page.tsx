import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  Image as ImageIcon,
  Monitor,
  Sparkles,
  Zap,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db";
import { campaigns } from "@/db/schema";

export default async function LandingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("socialix_session")?.value;
  if (token) {
    const user = await getCurrentUser();
    if (user) {
      const db = await getDb();
      const list = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.userId, user.id))
        .orderBy(desc(campaigns.createdAt))
        .limit(1);
      redirect(list.length > 0 ? "/dashboard" : "/create-campaign");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-blue-50/40 text-slate-900">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Socialix
          </span>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            AI Agent Team
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-10 pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1.5 text-xs font-semibold text-blue-700">
              <Zap className="h-3.5 w-3.5" />
              Autonomous 5-Agent Social Media Studio + MCP Automation
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl leading-[1.12]">
              Your Entire Social Media Team.{" "}
              <span className="text-blue-600">None of Them Human.</span>
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed">
              Give one simple instruction to your <strong>Master Agent</strong>. Watch{" "}
              <strong>Research</strong>, <strong>Creator</strong>,{" "}
              <strong>Scheduler</strong>, and <strong>Analytics</strong> collaborate inside
              your virtual AI office — researching trends, generating studio visuals, and
              scheduling posts across Instagram, TikTok, YouTube &amp; LinkedIn via MCP.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/sign-in?demo=1"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition"
              >
                Launch Instant Workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Create Account
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Master + 4 Specialized Agents</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Blotato &amp; OpenPost MCP</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Gemini + ImageKit AI Studio</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span>E2B Cloud Desktops &amp; Calendar</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-3 shadow-2xl shadow-blue-950/10">
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src="/offices/wooden-office.webp"
                  alt="Socialix Isometric AI Agent Office"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md border border-slate-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Virtual AI Agent Office
                </div>
                <div className="absolute bottom-3 inset-x-3 grid grid-cols-4 gap-2">
                  {[
                    { emoji: "🔍", name: "Research", role: "Trends" },
                    { emoji: "🎨", name: "Creator", role: "Visuals & Copy" },
                    { emoji: "📅", name: "Scheduler", role: "MCP Publish" },
                    { emoji: "📊", name: "Analytics", role: "Metrics" },
                  ].map((a) => (
                    <div
                      key={a.name}
                      className="rounded-xl bg-white/95 backdrop-blur px-2.5 py-2 shadow-sm border border-slate-200/80 text-center"
                    >
                      <div className="text-xs font-bold text-slate-900">
                        {a.emoji} {a.name}
                      </div>
                      <div className="text-[11px] text-slate-500">{a.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Bot,
              color: "bg-blue-50 text-blue-600",
              title: "Master Agent Orchestration",
              desc: "One prompt creates a structured multi-agent plan with task dependencies and live review.",
            },
            {
              icon: Monitor,
              color: "bg-violet-50 text-violet-600",
              title: "E2B Cloud Desktops",
              desc: "Research and Creator agents get dedicated Linux cloud browsers you can watch or take over.",
            },
            {
              icon: ImageIcon,
              color: "bg-pink-50 text-pink-600",
              title: "ImageKit + Gemini Studio",
              desc: "Generate visuals with AI, remove backgrounds, upscale, retouch, and preview live per platform.",
            },
            {
              icon: Calendar,
              color: "bg-emerald-50 text-emerald-600",
              title: "Drag & Drop + MCP Sync",
              desc: "Reschedule posts on Month/Week calendars and auto-publish through Blotato or OpenPost MCP.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
            >
              <div
                className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${f.color}`}
              >
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
