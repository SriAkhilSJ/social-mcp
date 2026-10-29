import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { synthesizeCharacterVoice, CHARACTER_PROFILES } from "../lib/audio/chatterbox";
import { optimizePostWithOpenSeo } from "../lib/seo/openseo";
import { POST } from "../app/api/mcp/route";

async function callMcp(name: string, args: Record<string, unknown> = {}) {
  const req = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 200, "MCP response status should be 200");
  const json = await res.json();
  const text = json.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : json;
}

describe("Chatterbox Voice & OpenSEO MCP Integration Tests", () => {
  // 1. CHARACTER PROFILES
  it("1. Character Profiles: verified profiles exist with distinct audio anchors", () => {
    assert.ok(CHARACTER_PROFILES.ren_kurokawa);
    assert.equal(CHARACTER_PROFILES.ren_kurokawa.tone, "calm_authoritative");
    assert.ok(CHARACTER_PROFILES.ren_kurokawa.pitchShift < 0, "Ren must have a deep pitch");

    assert.ok(CHARACTER_PROFILES.hana_kurokawa);
    assert.ok(CHARACTER_PROFILES.hana_kurokawa.pitchShift > 0, "Hana must have a higher pitch");

    assert.ok(CHARACTER_PROFILES.cartel_captain);
    assert.ok(CHARACTER_PROFILES.narrator);
  });

  // 2. CHATTERBOX SYNTHESIS DIRECT
  it("2. Chatterbox Voice Synthesis: generates audio file with correct metadata", async () => {
    const res = await synthesizeCharacterVoice({
      characterId: "ren_kurokawa",
      dialogueText: "Close your ears, sweetie. Daddy needs to teach five men how to knock.",
      emotion: "calm",
    });

    assert.equal(res.success, true);
    assert.equal(res.character.characterId, "ren_kurokawa");
    assert.ok(res.durationSeconds > 0);
    assert.ok(res.audioUrl.startsWith("/api/media/audio/"));
    assert.ok(fs.existsSync(res.localPath), "Generated audio file must exist on disk");

    const stat = fs.statSync(res.localPath);
    assert.ok(stat.size > 0, "Audio file must not be empty");
  });

  // 3. OPENSEO DIRECT
  it("3. OpenSEO Engine: optimizes title, keyword density, and 3-tier hashtag matrix", async () => {
    const res = await optimizePostWithOpenSeo({
      currentTitle: "Mafia Boss Dad Episode #31",
      currentCaption: "What if you received a message from tomorrow? Never mess with Ren Kurokawa.",
      autoApply: false,
    });

    assert.equal(res.success, true);
    assert.ok(res.seoScore >= 80, "SEO score should be high");
    assert.ok(res.hookScore >= 75, "Hook score should be evaluated");
    assert.equal(res.hashtagMatrix.length, 3, "Must return 3-tier hashtag matrix");
    assert.ok(res.recommendedHashtags.includes("animereels"));
    assert.ok(res.recommendedHashtags.includes("tokyonoir"));
    assert.ok(res.recommendedHashtags.includes("blindgangster"));
    assert.ok(res.optimizedCaption.includes("Ren Kurokawa"));
  });

  // 4. MCP TOOL: chatterbox_synthesize_voice
  it("4. MCP chatterbox_synthesize_voice: executes cleanly via protocol", async () => {
    const res = await callMcp("chatterbox_synthesize_voice", {
      characterId: "ren_kurokawa",
      dialogueText: "You brought guns into a blind man's house. In the dark... I am the only one who can see.",
      emotion: "whisper",
    });

    assert.equal(res.success, true);
    assert.equal(res.character.characterId, "ren_kurokawa");
    assert.ok(res.durationSeconds >= 2.0);
  });

  // 5. MCP TOOL: openseo_optimize_post
  it("5. MCP openseo_optimize_post: evaluates and returns optimized social packaging", async () => {
    const res = await callMcp("openseo_optimize_post", {
      currentTitle: "Episode #31: Parent-Teacher Conference in Blood",
      currentCaption: "Daddy needs to teach five men how to knock.",
      autoApply: false,
    });

    assert.equal(res.success, true);
    assert.ok(res.seoScore >= 80);
    assert.ok(res.optimizedTitle.includes("Episode #31"));
    assert.ok(res.optimizedCaption.includes("#anime"));
  });

  it("cleanup: exits cleanly", () => {
    setTimeout(() => process.exit(0), 100);
  });
});
