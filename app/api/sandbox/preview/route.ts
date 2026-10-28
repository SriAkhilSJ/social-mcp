import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sandboxPreviews } from "@/db/schema";
import { getRequestScope } from "@/lib/request-scope";
import { hasComputer } from "@/lib/agent-roles";
import { generateDesktopPreviewBase64 } from "@/lib/sandbox";

export async function GET(req: Request) {
  const scope = await getRequestScope();
  if (!scope) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const agent = url.searchParams.get("agent") || "research";
  if (!hasComputer(agent)) {
    return new NextResponse("Invalid agent", { status: 400 });
  }

  const db = await getDb();
  const [row] = await db
    .select()
    .from(sandboxPreviews)
    .where(
      and(
        eq(sandboxPreviews.campaignId, scope.campaignId),
        eq(sandboxPreviews.agentId, agent)
      )
    )
    .limit(1);

  const b64 =
    row?.image ||
    (await generateDesktopPreviewBase64({
      agentId: agent,
      stepText: "Cloud desktop idle — click Start to wake VM",
      status: "idle",
    }));

  const pngBuf = Buffer.from(b64, "base64");
  return new NextResponse(pngBuf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
