import fs from "fs";
import path from "path";

/**
 * Options for Coding Agent Video Generation:
 * 1. "coding_agent": (Recommended) Video generation by coding agents directly via SDK/API (Gemini Veo API or Studio motion).
 *    STRICT RULE: The coding agent NEVER uses Google Flow (no browser automation).
 * 2. "flow_path": Browser-automated Google Flow path via Chrome CDP in Creator Studio.
 */
export type VideoEngineMode = "coding_agent" | "flow_path";

export function getVideoEngineMode(): VideoEngineMode {
  try {
    const configPath = path.join(process.cwd(), ".data", "video-engine-mode.json");
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (data.mode === "coding_agent") return "coding_agent";
    }
  } catch {
    // Default
  }
  return "flow_path"; // Option 2 (Google Flow) is the primary video path
}

export function setVideoEngineMode(mode: VideoEngineMode): void {
  const dataDir = path.join(process.cwd(), ".data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(dataDir, "video-engine-mode.json"),
    JSON.stringify({
      mode,
      description:
        mode === "coding_agent"
          ? "Option 1: Video generation by coding agents (Recommended) - Flow browser is strictly bypassed by coding agents."
          : "Option 2: Flow path - Automated Google Flow browser session via Chrome CDP.",
      updatedAt: new Date().toISOString(),
    })
  );
}
