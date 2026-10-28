import { NextResponse } from "next/server";
import { getRequestScope } from "@/lib/request-scope";
import {
  executeAutopilotCycle,
  readAutopilotState,
  writeAutopilotState,
} from "@/lib/autopilot/engine";

export async function GET() {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = readAutopilotState();
  return NextResponse.json({
    ok: true,
    campaignId: scope.campaignId,
    campaignName: scope.campaign.name,
    ...state,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: "tick" | "toggle";
    enabled?: boolean;
  };

  if (body.action === "toggle") {
    const nextEnabled = typeof body.enabled === "boolean" ? body.enabled : !readAutopilotState().enabled;
    writeAutopilotState({ enabled: nextEnabled });
    return NextResponse.json({ ok: true, enabled: nextEnabled });
  }

  // Action: "tick" (execute autopilot run now)
  const result = await executeAutopilotCycle({
    userId: scope.userId,
    campaignId: scope.campaignId,
  });

  const state = readAutopilotState();
  return NextResponse.json({
    ok: true,
    result,
    state,
  });
}
