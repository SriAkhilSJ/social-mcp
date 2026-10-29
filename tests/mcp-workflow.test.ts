import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(res.status, 200, "MCP HTTP response should be 200");
  const json = await res.json();
  const text = json.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : json;
}

describe("Phase 3: Live MCP Workflow Verification", () => {
  let createdDraftId: number | null = null;

  it("1. list_workspaces: retrieves workspace and connection status", async () => {
    const res = await callMcp("list_workspaces");
    assert.ok(res.workspace, "Should return workspace object");
    assert.ok(Array.isArray(res.connectedAccounts), "Should return connected accounts array");
  });

  it("2. get_analytics: retrieves overall authentic channel analytics", async () => {
    const res = await callMcp("get_analytics");
    assert.equal(res.platform, "facebook");
    assert.equal(res.facebookPage?.pageName, "AnimeEdits");
    assert.equal(res.facebookPage?.pageId, "1316616991525561");
    assert.ok(res.facebookPage?.followers >= 22000);
    assert.ok(res.facebookPage?.pageLikes >= 22000);
    assert.ok(res.facebookPage?.recentPostsAnalyzed > 0);
    assert.ok(Array.isArray(res.facebookPage?.topPerformingVideos));
  });

  it("3. get_analytics: isolates specific post by videoId (Trailer Reel)", async () => {
    const res = await callMcp("get_analytics", { postId: "1593302406155143" });
    assert.equal(res.success, true);
    assert.equal(res.isFilteredByPostId, true);
    assert.equal(res.post?.videoId, "1593302406155143");
    assert.ok(typeof res.post?.views === "number");
    assert.ok(res.post?.views >= 400);
    assert.ok(res.post?.retention !== undefined);
  });

  it("4. list_posts: inspects draft review queue", async () => {
    const res = await callMcp("list_posts");
    assert.ok(res.openPostDraftQueue !== undefined);
    assert.ok(Array.isArray(res.openPostDraftQueue.posts));
  });

  it("5. create_post: creates temporary draft in draft status", async () => {
    const res = await callMcp("create_post", {
      title: "[INTEGRATION_TEST_TEMP] Autopilot Safety Check",
      caption: "Temporary test draft created for phase 3 verification.",
    });
    assert.equal(res.success, true);
    assert.equal(res.status, "draft");
    assert.ok(typeof res.postId === "number");
    createdDraftId = res.postId;
  });

  it("6. update_post: updates the temporary test draft", async () => {
    assert.ok(createdDraftId, "Draft ID must be known");
    const res = await callMcp("update_post", {
      postId: createdDraftId,
      caption: "Updated caption for integration test verification.",
    });
    assert.equal(res.success, true);
    assert.equal(res.postId, createdDraftId);
  });

  it("7. generate_media: attaches media without publishing", async () => {
    assert.ok(createdDraftId, "Draft ID must be known");
    const res = await callMcp("generate_media", {
      draftId: createdDraftId,
      prompt: "Anime noir cyberpunk neon aesthetic, vertical 9:16",
    });
    assert.equal(res.success, true);
    assert.ok(res.mediaUrl.endsWith(".mp4"));
    assert.equal(res.attachedToDraftId, createdDraftId);
  });

  it("8. publish_post: safety lock blocks publication when confirmed: false", async () => {
    assert.ok(createdDraftId, "Draft ID must be known");
    const res = await callMcp("publish_post", {
      postId: createdDraftId,
      confirmed: false,
    });
    assert.equal(res.error, "ConfirmationRequired");
    assert.equal(res.humanInTheLoopProtection, true);
  });

  it("9. delete_post: cleans up only the temporary test draft", async () => {
    assert.ok(createdDraftId, "Draft ID must be known");
    const res = await callMcp("delete_post", {
      postId: createdDraftId,
    });
    assert.equal(res.success, true);
    assert.equal(res.deletedId, createdDraftId);

    // Verify draft is removed
    const list = await callMcp("list_posts");
    const found = list.openPostDraftQueue?.posts?.some((p: any) => p.id === createdDraftId);
    assert.equal(found, false, "Temporary test draft must be deleted");
  });
});
