import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

const MIME_MAP: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
};

import { parseByteRange, type ParsedByteRange } from "@/lib/media/byte-range";

export async function GET(
  req: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const safeName = path.basename(filename);

  // Search storage locations in order of priority
  const candidatePaths = [
    path.join(process.cwd(), ".data", "media", safeName),
    path.join(process.cwd(), ".data", "media", "frames", safeName),
    path.join(process.cwd(), "public", "media", safeName),
    path.join(process.cwd(), "public", "media", "frames", safeName),
    path.join(process.cwd(), ".next", "standalone", "public", "media", safeName),
    path.join(process.cwd(), ".next", "standalone", "public", "media", "frames", safeName),
    path.join(process.cwd(), ".next", "standalone", ".data", "media", safeName),
    path.join(process.cwd(), ".next", "standalone", ".data", "media", "frames", safeName),
  ];

  const fullPath = candidatePaths.find((p) => fs.existsSync(p));

  if (!fullPath) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = path.extname(safeName).toLowerCase();
  const mime = MIME_MAP[ext] || "application/octet-stream";

  let stat: fs.Stats;
  try {
    stat = fs.statSync(fullPath);
  } catch {
    return new NextResponse("Failed to read media metadata", { status: 500 });
  }

  const totalSize = stat.size;
  const rangeHeader = req.headers.get("range");

  // If a range header is supplied for media content
  if (rangeHeader) {
    const parsed = parseByteRange(rangeHeader, totalSize);

    if (parsed.status === 416) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${totalSize}`,
          "Content-Type": mime,
          "Accept-Ranges": "bytes",
        },
      });
    }

    if (parsed.status === 206) {
      const { start, end, chunkSize } = parsed.range;
      const fileStream = fs.createReadStream(fullPath, { start, end });
      const webStream = Readable.toWeb(fileStream);

      return new Response(webStream as unknown as BodyInit, {
        status: 206,
        headers: {
          "Content-Type": mime,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Content-Length": String(chunkSize),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  // Stream full file (HTTP 200) without buffering entire file in memory
  const fileStream = fs.createReadStream(fullPath);
  const webStream = Readable.toWeb(fileStream);

  return new Response(webStream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Content-Length": String(totalSize),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
