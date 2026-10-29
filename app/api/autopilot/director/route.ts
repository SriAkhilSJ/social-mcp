import { NextResponse } from "next/server";
import { getRequestScope } from "@/lib/request-scope";
import {
  analyzeChannelPerformance,
  executeContentDirectorCycle,
  generateAndRankIdeas,
} from "@/lib/director/content-director";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const analysis = await analyzeChannelPerformance({
    userId: scope.userId,
    campaignId: scope.campaignId,
  });

  const rankedIdeas = generateAndRankIdeas(analysis);

  return NextResponse.json({
    ok: true,
    campaignId: scope.campaignId,
    analysis,
    rankedIdeas,
    topIdea: rankedIdeas[0],
  });
}

export async function POST(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    idempotencyKey?: string;
  };

  try {
    const result = await executeContentDirectorCycle({
      userId: scope.userId,
      campaignId: scope.campaignId,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to execute Content Director cycle" },
      { status: 500 }
    );
  }
}
