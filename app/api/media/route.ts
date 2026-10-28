import { NextResponse } from "next/server";
import { getOrBootstrapWorkspaceUser } from "@/lib/auth";
import {
  generateGeminiOrStudioImage,
  saveLocalMediaBuffer,
  transformImageKitOrLocal,
  uploadToImageKitOrLocal,
  type ImageAspect,
  type ImageEditSpec,
} from "@/lib/storage/imagekit";

export async function POST(req: Request) {
  const user = await getOrBootstrapWorkspaceUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      const isVideo =
        file.type.startsWith("video/") ||
        /\.(mp4|webm|mov)$/i.test(file.name || "");
      const maxBytes = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxBytes) {
        return NextResponse.json(
          { error: `File exceeds ${isVideo ? "100 MB" : "10 MB"} limit` },
          { status: 400 }
        );
      }
      const arrayBuf = await file.arrayBuffer();
      const buf = Buffer.from(arrayBuf);

      if (isVideo) {
        const ext = file.name?.toLowerCase().endsWith(".webm")
          ? "webm"
          : file.name?.toLowerCase().endsWith(".mov")
          ? "mov"
          : "mp4";
        const savedVid = await saveLocalMediaBuffer(buf, ext);
        return NextResponse.json({
          ok: true,
          url: savedVid.url,
          fileId: savedVid.fileId,
          mediaType: "video",
          name: file.name,
        });
      }

      const saved = await uploadToImageKitOrLocal(buf, {
        fileName: file.name || `upload-${Date.now()}.webp`,
        mimeType: file.type || "image/webp",
      });
      return NextResponse.json({
        ok: true,
        url: saved.url,
        fileId: saved.fileId,
        mediaType: "image",
        name: file.name,
      });
    }

    const body = (await req.json()) as {
      action: "generate" | "transform";
      prompt?: string;
      aspect?: ImageAspect;
      url?: string;
      edits?: ImageEditSpec[];
    };

    if (body.action === "generate") {
      const prompt = String(body.prompt || "").trim();
      if (!prompt) {
        return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
      }
      const generated = await generateGeminiOrStudioImage(
        prompt,
        body.aspect || "1:1"
      );
      return NextResponse.json({ ok: true, ...generated });
    }

    if (body.action === "transform") {
      if (!body.url || !Array.isArray(body.edits) || body.edits.length === 0) {
        return NextResponse.json(
          { error: "Source URL and at least one AI transformation required" },
          { status: 400 }
        );
      }
      const transformed = await transformImageKitOrLocal(
        body.url,
        body.edits.slice(0, 5)
      );
      return NextResponse.json({ ok: true, ...transformed });
    }

    return NextResponse.json({ error: "Invalid media action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Media processing failed" },
      { status: 500 }
    );
  }
}
