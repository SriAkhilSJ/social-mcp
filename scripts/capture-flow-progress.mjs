import { chromium } from '../flow-mcp-runtime/node_modules/playwright-core/index.mjs';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts()[0].pages().find(p => p.url().includes('flow.google.com/project'));
  if (!page) {
    console.error('Page not found');
    process.exit(1);
  }

  // Wait 15 seconds to let Flow generate
  console.log('Waiting for Flow generation...');
  await page.waitForTimeout(15000);

  const shotPath = 'C:/Users/Administrator/.gemini/antigravity/brain/926a5305-999b-4cf1-ae5a-c7460b808e46/flow-progress-1.png';
  await page.screenshot({ path: shotPath });
  console.log('Progress screenshot saved to', shotPath);

  // Read latest agent chat text
  const agentTexts = await page.$$eval('[class*="message"], [class*="chat"], flow-chat-bubble, p', els => els.map(e => e.innerText?.trim()).filter(Boolean));
  console.log('Recent messages:', agentTexts.slice(-6));

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
