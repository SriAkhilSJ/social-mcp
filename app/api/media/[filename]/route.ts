import fs from "fs";
import path from "path";
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
};

export async function GET(
  req: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const safeName = path.basename(filename);
  const fullPath = path.join(process.cwd(), ".data", "media", safeName);

  if (!fs.existsSync(fullPath)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = path.extname(safeName).toLowerCase();
  const mime = MIME_MAP[ext] || "application/octet-stream";
  const stat = fs.statSync(fullPath);
  const totalSize = stat.size;
  const rangeHeader = req.headers.get("range");

  if (rangeHeader && mime.startsWith("video/")) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2]
        ? Math.min(parseInt(match[2], 10), totalSize - 1)
        : totalSize - 1;
      const chunkSize = end - start + 1;
      const fd = fs.openSync(fullPath, "r");
      const chunk = Buffer.alloc(chunkSize);
      fs.readSync(fd, chunk, 0, chunkSize, start);
      fs.closeSync(fd);

      return new NextResponse(chunk, {
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

  const buf = fs.readFileSync(fullPath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Content-Length": String(totalSize),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
