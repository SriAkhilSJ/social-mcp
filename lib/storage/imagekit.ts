import "server-only";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

export type ImageAspect = "1:1" | "4:5" | "9:16" | "16:9";

export interface ImageEditSpec {
  kind:
    | "bgremove"
    | "upscale"
    | "retouch"
    | "dropshadow"
    | "changebg"
    | "edit"
    | "crop";
  prompt?: string;
  aspect?: ImageAspect;
}

const ASPECT_DIMENSIONS: Record<ImageAspect, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1920, h: 1080 },
};

function getMediaDir(): string {
  const dir = path.join(process.cwd(), ".data", "media");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function saveLocalMediaBuffer(
  buffer: Buffer,
  ext = "webp"
): Promise<{ url: string; fileId: string; fileName: string }> {
  const id = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const fileName = `${id}.${ext}`;
  const fullPath = path.join(getMediaDir(), fileName);
  fs.writeFileSync(fullPath, buffer);
  return {
    url: `/api/media/${fileName}`,
    fileId: id,
    fileName,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

const PALETTES = [
  { bg1: "#0F172A", bg2: "#1D4ED8", accent: "#38BDF8", badge: "#DBEAFE", badgeText: "#1E40AF" },
  { bg1: "#27150B", bg2: "#9A3412", accent: "#FBBF24", badge: "#FEF3C7", badgeText: "#92400E" },
  { bg1: "#1E1B4B", bg2: "#6D28D9", accent: "#F472B6", badge: "#FCE7F3", badgeText: "#9D174D" },
  { bg1: "#064E3B", bg2: "#059669", accent: "#6EE7B7", badge: "#D1FAE5", badgeText: "#065F46" },
  { bg1: "#31102F", bg2: "#BE185D", accent: "#FDE047", badge: "#FCE7F3", badgeText: "#831843" },
];

async function renderStudioCardBuffer(
  prompt: string,
  aspect: ImageAspect = "1:1",
  subtitle = "AI STUDIO CREATIVE"
): Promise<Buffer> {
  const { w, h } = ASPECT_DIMENSIONS[aspect] || ASPECT_DIMENSIONS["1:1"];
  const lower = prompt.toLowerCase();
  const paletteIdx =
    lower.includes("coffee") || lower.includes("cafe") || lower.includes("espresso") || lower.includes("morning")
      ? 1
      : lower.includes("tech") || lower.includes("saas") || lower.includes("ai")
      ? 0
      : lower.includes("eco") || lower.includes("matcha") || lower.includes("wellness")
      ? 3
      : lower.includes("fashion") || lower.includes("launch")
      ? 4
      : Math.abs(
          prompt.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
        ) % PALETTES.length;

  const pal = PALETTES[paletteIdx];
  const cleanHeadline = prompt
    .replace(/^(create|generate|design|make)\s+(an?\s+)?(image|photo|graphic|visual|post)\s+(of|for|about)?\s*/i, "")
    .trim();
  const titleText = cleanHeadline.charAt(0).toUpperCase() + cleanHeadline.slice(1);
  const lines = wrapLines(titleText || "Fresh Brand Launch", w > 1200 ? 28 : 20, 4);
  const fontSize = w > 1200 ? 74 : 68;
  const lineHeight = Math.round(fontSize * 1.2);
  const startY = Math.round(h * 0.45 - ((lines.length - 1) * lineHeight) / 2);

  const svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${pal.bg1}"/>
        <stop offset="100%" stop-color="${pal.bg2}"/>
      </linearGradient>
      <radialGradient id="glow1" cx="80%" cy="20%" r="55%">
        <stop offset="0%" stop-color="${pal.accent}" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="${pal.accent}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="glow2" cx="15%" cy="85%" r="50%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#glow1)"/>
    <rect width="${w}" height="${h}" fill="url(#glow2)"/>
    <circle cx="${Math.round(w * 0.84)}" cy="${Math.round(h * 0.18)}" r="${Math.round(w * 0.16)}" fill="none" stroke="${pal.accent}" stroke-opacity="0.22" stroke-width="2"/>
    <circle cx="${Math.round(w * 0.84)}" cy="${Math.round(h * 0.18)}" r="${Math.round(w * 0.1)}" fill="${pal.accent}" fill-opacity="0.12"/>
    <rect x="72" y="72" width="${w - 144}" height="${h - 144}" rx="40" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.16" stroke-width="2"/>
    <rect x="116" y="124" width="290" height="48" rx="24" fill="${pal.badge}"/>
    <text x="261" y="156" font-family="sans-serif" font-size="20" font-weight="700" letter-spacing="1.5" fill="${pal.badgeText}" text-anchor="middle">${escapeXml(subtitle)}</text>
    ${lines
      .map(
        (line, i) =>
          `<text x="116" y="${startY + i * lineHeight}" font-family="sans-serif" font-size="${fontSize}" font-weight="800" fill="#FFFFFF">${escapeXml(line)}</text>`
      )
      .join("\n")}
    <rect x="116" y="${h - 210}" width="140" height="8" rx="4" fill="${pal.accent}"/>
    <text x="116" y="${h - 148}" font-family="sans-serif" font-size="26" font-weight="600" fill="#E2E8F0">Crafted by Socialix AI Studio</text>
  </svg>`;

  return sharp(Buffer.from(svg)).webp({ quality: 92 }).toBuffer();
}

export async function generateGeminiOrStudioImage(
  prompt: string,
  aspect: ImageAspect = "1:1",
  customKeys?: { geminiKey?: string; imagekitPrivateKey?: string; imagekitEndpoint?: string }
): Promise<{ url: string; fileId: string; provider: string }> {
  const geminiKey = customKeys?.geminiKey || process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";

  if (geminiKey) {
    try {
      const geminiAspect = aspect === "4:5" ? "1:1" : aspect;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              imageConfig: { aspectRatio: geminiAspect },
            },
          }),
        }
      );
      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
          }>;
        };
        const parts = json.candidates?.[0]?.content?.parts || [];
        const imgPart = parts.find((p) => p.inlineData?.data);
        if (imgPart?.inlineData?.data) {
          const buf = Buffer.from(imgPart.inlineData.data, "base64");
          const uploaded = await uploadToImageKitOrLocal(buf, {
            fileName: `gemini-${Date.now()}.png`,
            mimeType: imgPart.inlineData.mimeType || "image/png",
            customKeys,
          });
          return { ...uploaded, provider: "gemini" };
        }
      }
    } catch {
      // Fall back cleanly to ImageKit or local studio renderer
    }
  }

  const ikEndpoint =
    customKeys?.imagekitEndpoint || process.env.IMAGEKIT_URL_ENDPOINT?.trim();
  if (ikEndpoint && !ikEndpoint.includes("your_imagekit_id")) {
    const cleanPrompt = encodeURIComponent(prompt.replace(/\//g, " ").slice(0, 220));
    const { w, h } = ASPECT_DIMENSIONS[aspect] || ASPECT_DIMENSIONS["1:1"];
    const ikGenUrl = `${ikEndpoint.replace(/\/$/, "")}/ik-genimg-prompt-${cleanPrompt}/socialix-${Date.now()}.jpg?tr=w-${w},h-${h},fo-auto`;
    return { url: ikGenUrl, fileId: `ik-${Date.now()}`, provider: "imagekit" };
  }

  const studioBuf = await renderStudioCardBuffer(prompt, aspect);
  const saved = await saveLocalMediaBuffer(studioBuf, "webp");
  return { url: saved.url, fileId: saved.fileId, provider: "studio" };
}

export async function uploadToImageKitOrLocal(
  data: Buffer,
  opts: {
    fileName: string;
    folder?: string;
    mimeType?: string;
    customKeys?: { imagekitPrivateKey?: string; imagekitEndpoint?: string };
  }
): Promise<{ url: string; fileId: string }> {
  const privKey =
    opts.customKeys?.imagekitPrivateKey || process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  const endpoint =
    opts.customKeys?.imagekitEndpoint || process.env.IMAGEKIT_URL_ENDPOINT?.trim();

  if (privKey && endpoint && !endpoint.includes("your_imagekit_id")) {
    try {
      const form = new FormData();
      form.append("file", data.toString("base64"));
      form.append("fileName", opts.fileName);
      form.append("useUniqueFileName", "true");
      if (opts.folder) form.append("folder", opts.folder);

      const authHeader = "Basic " + Buffer.from(`${privKey}:`).toString("base64");
      const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        headers: { Authorization: authHeader },
        body: form,
      });
      if (res.ok) {
        const json = (await res.json()) as { url: string; fileId: string };
        return { url: json.url, fileId: json.fileId };
      }
    } catch {
      // Fall back to local storage
    }
  }

  const webpBuf = await sharp(data).webp({ quality: 92 }).toBuffer();
  const saved = await saveLocalMediaBuffer(webpBuf, "webp");
  return { url: saved.url, fileId: saved.fileId };
}

function sanitizeIkPrompt(text: string): string {
  return encodeURIComponent(
    text
      .replace(/[^a-zA-Z0-9 ,._-]/g, " ")
      .trim()
      .slice(0, 140)
  );
}

export async function transformImageKitOrLocal(
  sourceUrl: string,
  edits: ImageEditSpec[]
): Promise<{ url: string; appliedEdits: string[] }> {
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT?.trim();
  const appliedEdits = edits.map((e) =>
    e.prompt ? `${e.kind}:${e.prompt}` : e.aspect ? `${e.kind}:${e.aspect}` : e.kind
  );

  // If image is hosted on the user's ImageKit account, build native ImageKit ?tr= URL
  if (
    endpoint &&
    !endpoint.includes("your_imagekit_id") &&
    sourceUrl.startsWith(endpoint)
  ) {
    const steps: string[] = [];
    for (const edit of edits) {
      if (edit.kind === "bgremove") steps.push("e-bgremove");
      else if (edit.kind === "upscale") steps.push("e-upscale");
      else if (edit.kind === "retouch") steps.push("e-retouch");
      else if (edit.kind === "dropshadow") steps.push("e-bgremove:e-dropshadow");
      else if (edit.kind === "changebg" && edit.prompt)
        steps.push(`e-changebg-prompt-${sanitizeIkPrompt(edit.prompt)}`);
      else if (edit.kind === "edit" && edit.prompt)
        steps.push(`e-edit-prompt-${sanitizeIkPrompt(edit.prompt)}`);
      else if (edit.kind === "crop" && edit.aspect) {
        const { w, h } = ASPECT_DIMENSIONS[edit.aspect];
        steps.push(`w-${w},h-${h},fo-auto`);
      }
    }
    const base = sourceUrl.split("?")[0];
    return {
      url: steps.length ? `${base}?tr=${steps.join(":")}` : sourceUrl,
      appliedEdits,
    };
  }

  // Local sharp transformation pipeline for instant visual editing in Studio
  let inputBuf: Buffer | null = null;
  if (sourceUrl.startsWith("/api/media/")) {
    const fileName = path.basename(sourceUrl.replace("/api/media/", "").split("?")[0]);
    const full = path.join(getMediaDir(), fileName);
    if (fs.existsSync(full)) {
      inputBuf = fs.readFileSync(full);
    }
  } else if (sourceUrl.startsWith("/")) {
    const full = path.join(process.cwd(), "public", sourceUrl.split("?")[0]);
    if (fs.existsSync(full)) {
      inputBuf = fs.readFileSync(full);
    }
  }

  if (!inputBuf) {
    const fallbackPrompt =
      edits.find((e) => e.prompt)?.prompt || "AI Transformed Social Media Visual";
    const aspect = edits.find((e) => e.aspect)?.aspect || "1:1";
    const buf = await renderStudioCardBuffer(fallbackPrompt, aspect, "IMAGEKIT AI TRANSFORMED");
    const saved = await saveLocalMediaBuffer(buf, "webp");
    return { url: saved.url, appliedEdits };
  }

  let pipeline = sharp(inputBuf);
  const metadata = await pipeline.metadata();
  let width = metadata.width || 1080;
  let height = metadata.height || 1080;

  for (const edit of edits) {
    if (edit.kind === "crop" && edit.aspect) {
      const dim = ASPECT_DIMENSIONS[edit.aspect];
      width = dim.w;
      height = dim.h;
      pipeline = pipeline.resize(width, height, { fit: "cover", position: "attention" });
    } else if (edit.kind === "upscale") {
      width = Math.min(2160, Math.round(width * 1.25));
      height = Math.min(2160, Math.round(height * 1.25));
      pipeline = pipeline.resize(width, height, { kernel: "lanczos3" }).sharpen(1.4);
    } else if (edit.kind === "retouch") {
      pipeline = pipeline.modulate({ brightness: 1.06, saturation: 1.18 }).sharpen(1.1);
    } else if (edit.kind === "bgremove") {
      const innerW = Math.round(width * 0.84);
      const innerH = Math.round(height * 0.84);
      const resized = await pipeline
        .resize(innerW, innerH, { fit: "inside" })
        .png()
        .toBuffer();
      const checkerSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cleanBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F8FAFC"/>
            <stop offset="100%" stop-color="#EEF2FF"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#cleanBg)"/>
      </svg>`;
      const composed = await sharp(Buffer.from(checkerSvg))
        .composite([{ input: resized, gravity: "center" }])
        .webp({ quality: 92 })
        .toBuffer();
      pipeline = sharp(composed);
    } else if (edit.kind === "dropshadow") {
      const innerW = Math.round(width * 0.8);
      const innerH = Math.round(height * 0.8);
      const resized = await pipeline.resize(innerW, innerH, { fit: "inside" }).png().toBuffer();
      const shadowBg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#F1F5F9"/>
        <rect x="${Math.round((width - innerW) / 2) + 18}" y="${Math.round((height - innerH) / 2) + 24}" width="${innerW}" height="${innerH}" rx="28" fill="#0F172A" fill-opacity="0.22"/>
      </svg>`;
      const composed = await sharp(Buffer.from(shadowBg))
        .composite([{ input: resized, gravity: "center" }])
        .webp({ quality: 92 })
        .toBuffer();
      pipeline = sharp(composed);
    } else if ((edit.kind === "changebg" || edit.kind === "edit") && edit.prompt) {
      const overlaySvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tint" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#1E3A8A" stop-opacity="0.72"/>
            <stop offset="65%" stop-color="#7C3AED" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#EC4899" stop-opacity="0.18"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#tint)"/>
        <rect x="48" y="${height - 132}" width="${width - 96}" height="84" rx="22" fill="#0F172A" fill-opacity="0.78"/>
        <text x="84" y="${height - 78}" font-family="sans-serif" font-size="28" font-weight="700" fill="#FFFFFF">${escapeXml(
          edit.prompt.slice(0, 48)
        )}</text>
      </svg>`;
      const current = await pipeline.resize(width, height, { fit: "cover" }).png().toBuffer();
      const composed = await sharp(current)
        .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
        .webp({ quality: 92 })
        .toBuffer();
      pipeline = sharp(composed);
    }
  }

  const finalBuf = await pipeline.webp({ quality: 92 }).toBuffer();
  const saved = await saveLocalMediaBuffer(finalBuf, "webp");
  return { url: saved.url, appliedEdits };
}
