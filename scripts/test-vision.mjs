import fs from 'fs';

const apiKey = 'AQ.Ab8RN6I4lq-PmZMF68sI8Wr_p9pfgltF4b_YaULP5QlCc9S6kg';
const imgBuf = fs.readFileSync('.data/verified_frame_5s.jpg');
const base64 = imgBuf.toString('base64');

async function run() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: 'You are the Executive Quality Director for an anime studio. Evaluate if this image features Ren Kurokawa: a mid-30s Japanese man with sleek black combed-back hair, dark round sunglasses, a tailored charcoal suit, and a mahogany cane sword. Respond in pure JSON format: { "match": boolean, "score": number, "detected": string[], "missing": string[], "reason": string }'
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await res.json();
  if (data.candidates) {
    console.log('Gemini Native Result:\n', data.candidates[0].content.parts[0].text);
  } else {
    console.log('Gemini Error:\n', JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
