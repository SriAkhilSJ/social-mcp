const apiKey = 'AQ.Ab8RN6I4lq-PmZMF68sI8Wr_p9pfgltF4b_YaULP5QlCc9S6kg';

async function test(model) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'respond with pong' }] }] }),
      signal: AbortSignal.timeout(6000)
    });
    const d = await res.json();
    console.log(`Model ${model}:`, d.candidates ? 'READY' : d.error?.code + ' ' + d.error?.status);
  } catch (err) {
    console.log(`Model ${model} timeout/error:`, err.message);
  }
}

async function main() {
  await test('gemini-3.6-flash');
  await test('gemini-3.7-flash');
  await test('gemini-3-flash-preview');
  await test('gemini-3.1-pro-preview');
}

main();
