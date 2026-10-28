import fs from 'fs';
import path from 'path';
import os from 'os';

const token = fs.readFileSync(path.join(os.homedir(), '.flow-mcp', 'token'), 'utf8').trim();

async function main() {
  console.log('Sending generate request to Flow MCP with character anchor reference...');
  const res = await fetch('http://127.0.0.1:8787/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-flow-token': token
    },
    body: JSON.stringify({
      project: 'Socialix',
      scenes: [
        {
          prompt: 'Cinematic 9:16 vertical anime reel: Ren Kurokawa, a blind syndicate boss in dark charcoal suit and dark round sunglasses, taps his carved mahogany cane on rain-slicked asphalt under neon lights. High contrast anime noir.',
          type: 'video',
          model: 'Veo 3.1 - Fast',
          aspect_ratio: '9:16',
          reference_images: ['asset:Blind man wearing suit'],
          max_credits: 30
        }
      ]
    })
  });
  const data = await res.json();
  console.log('Generate response:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
