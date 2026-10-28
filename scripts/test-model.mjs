const apiKey = 'AQ.Ab8RN6I4lq-PmZMF68sI8Wr_p9pfgltF4b_YaULP5QlCc9S6kg';

async function test(model) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }),
      signal: AbortSignal.timeout(6000)
    });
    const d = await res.json();
    console.log(`Model ${model}:`, d.candidates ? 'SUCCESS' : d.error?.message || d);
  } catch (err) {
    console.log(`Model ${model} error:`, err.message);
  }
}

async function main() {
  await test('gemini-3.5-flash-lite');
  await test('gemini-3.5-flash');
  await test('gemini-flash-latest');
}

main();
