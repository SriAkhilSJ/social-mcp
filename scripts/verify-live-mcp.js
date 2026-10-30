const BASE_URL = 'https://social-mcp-agent.onrender.com/api/mcp';

async function callMcp(name, args = {}) {
  const payload = {
    jsonrpc: '2.0',
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    method: 'tools/call',
    params: {
      name,
      arguments: args
    }
  };
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

async function verifyAll() {
  console.log('=== VERIFYING LIVE OPENPOST MCP ENDPOINTS ===\n');

  // 1. Target Reel 1593302406155143
  console.log('--- 1. Testing Reel Analytics: 1593302406155143 ---');
  const reelRes = await callMcp('get_analytics', { postId: '1593302406155143' });
  const reelText = reelRes.result?.content?.[0]?.text;
  console.log('Reel 1593302406155143 response:', reelText ? JSON.parse(reelText) : reelRes);

  // 2. Draft ID 9
  console.log('\n--- 2. Testing Draft ID 9 Verification ---');
  const draftRes = await callMcp('get_analytics', { postId: '9' });
  const draftText = draftRes.result?.content?.[0]?.text;
  console.log('Draft 9 response:', draftText ? JSON.parse(draftText) : draftRes);

  // 2b. List Posts (draft queue)
  console.log('\n--- 2b. Testing list_posts (draft queue) ---');
  const listRes = await callMcp('list_posts', {});
  const listText = listRes.result?.content?.[0]?.text;
  console.log('list_posts response:', listText ? JSON.parse(listText) : listRes);
}

verifyAll().catch(console.error);
