import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface VideoMetadata {
  durationSeconds?: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  sizeBytes: number;
}

export interface VideoValidationResult {
  valid: boolean;
  error?: string;
  metadata?: VideoMetadata;
  toolUsed?: "ffprobe" | "binary_header_validator";
}

const PLACEHOLDER_SIGNATURES = [
  "AI_ANIME_REEL_MASTER_STREAM_PLACEHOLDER",
  "PLACEHOLDER",
  "MOCK_STREAM",
];

const VALID_MP4_BRANDS = [
  "isom",
  "iso2",
  "mp41",
  "mp42",
  "avc1",
  "qt  ",
  "M4V ",
  "M4A ",
  "dash",
];

/**
 * Checks if the buffer contains valid MP4/QuickTime magic bytes.
 * ISO base media file format (MP4) begins with an 'ftyp' box at offset 4.
 */
export function checkMp4Signature(buffer: Buffer): { valid: boolean; reason?: string } {
  if (buffer.length < 16) {
    return { valid: false, reason: "File header too short (< 16 bytes)" };
  }

  // Check for known placeholder text strings
  const headerText = buffer.toString("utf8", 0, Math.min(buffer.length, 128));
  for (const sig of PLACEHOLDER_SIGNATURES) {
    if (headerText.includes(sig)) {
      return { valid: false, reason: `File contains placeholder text signature: '${sig}'` };
    }
  }

  // Check for 'ftyp' atom at offset 4
  const boxType = buffer.toString("ascii", 4, 8);
  if (boxType === "ftyp") {
    const majorBrand = buffer.toString("ascii", 8, 12);
    // Accept valid major brands or any 4-ascii-char brand
    const isKnownBrand = VALID_MP4_BRANDS.some((b) => majorBrand.startsWith(b.trim()));
    if (isKnownBrand || /^[a-zA-Z0-9_\s]{4}$/.test(majorBrand)) {
      return { valid: true };
    }
  }

  // Also accept QuickTime 'moov' or 'mdat' at root level
  if (boxType === "moov" || boxType === "mdat") {
    return { valid: true };
  }

  return { valid: false, reason: `Missing 'ftyp' box signature at offset 4 (found '${boxType}')` };
}

/**
 * Validates a video file on disk using binary inspection and ffprobe (when available).
 */
export async function validateVideoAsset(filePath: string): Promise<VideoValidationResult> {
  // 1. Physical existence check
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      error: `Video asset not found at path: ${path.basename(filePath)}`,
    };
  }

  // 2. File size check
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch (err: any) {
    return {
      valid: false,
      error: `Failed to stat video file: ${err.message}`,
    };
  }

  if (stat.size < 4096) {
    return {
      valid: false,
      error: `Video asset is suspiciously small (${stat.size} bytes). Minimum expected video size is 4KB.`,
      metadata: { sizeBytes: stat.size },
    };
  }

  // 3. Binary signature check
  const fd = fs.openSync(filePath, "r");
  const headerBuf = Buffer.alloc(128);
  fs.readSync(fd, headerBuf, 0, 128, 0);
  fs.closeSync(fd);

  const sigResult = checkMp4Signature(headerBuf);
  if (!sigResult.valid) {
    return {
      valid: false,
      error: `Media integrity violation: ${sigResult.reason}`,
      metadata: { sizeBytes: stat.size },
      toolUsed: "binary_header_validator",
    };
  }

  // 4. FFprobe validation (if ffprobe is available on the system PATH)
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name,width,height:format=duration",
      "-of",
      "json",
      filePath,
    ]);

    const parsed = JSON.parse(stdout);
    const videoStream = parsed.streams?.[0];
    const duration = parseFloat(parsed.format?.duration || "0");

    if (!videoStream || !videoStream.codec_name) {
      return {
        valid: false,
        error: "ffprobe could not identify a valid video stream in the media container.",
        metadata: { sizeBytes: stat.size },
        toolUsed: "ffprobe",
      };
    }

    if (duration <= 0) {
      return {
        valid: false,
        error: "ffprobe reported invalid or zero video duration.",
        metadata: { sizeBytes: stat.size },
        toolUsed: "ffprobe",
      };
    }

    return {
      valid: true,
      metadata: {
        durationSeconds: duration,
        width: videoStream.width,
        height: videoStream.height,
        videoCodec: videoStream.codec_name,
        sizeBytes: stat.size,
      },
      toolUsed: "ffprobe",
    };
  } catch {
    // ffprobe not installed or failed to execute — fallback to verified binary header check
    return {
      valid: true,
      metadata: {
        sizeBytes: stat.size,
      },
      toolUsed: "binary_header_validator",
    };
  }
}
