import { NextResponse } from "next/server";
import { getOrBootstrapWorkspaceUser } from "@/lib/auth";
import {
  generateFlowVideo,
  getFlowMcpStatus,
  type FlowVideoModelId,
  type VideoAspect,
  type VideoDuration,
} from "@/lib/video/flow-mcp";

export async function GET() {
  const user = await getOrBootstrapWorkspaceUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await getFlowMcpStatus(user.id);
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const user = await getOrBootstrapWorkspaceUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      prompt?: string;
      model?: FlowVideoModelId;
      aspect?: VideoAspect;
      duration?: VideoDuration;
      maxCredits?: number;
      project?: string;
    };

    const prompt = String(body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json(
        { error: "Video prompt is required" },
        { status: 400 }
      );
    }

    const generated = await generateFlowVideo({
      userId: user.id,
      prompt,
      model: body.model || "Veo 3.1 - Fast",
      aspect: body.aspect === "16:9" ? "16:9" : "9:16",
      duration: body.duration || 8,
      maxCredits: body.maxCredits ?? 30,
      project: body.project || "Socialix",
    });

    return NextResponse.json({ ok: true, ...generated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Video generation failed" },
      { status: 500 }
    );
  }
}
