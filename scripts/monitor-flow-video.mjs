import { chromium } from '../flow-mcp-runtime/node_modules/playwright-core/index.mjs';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts()[0].pages().find(p => p.url().includes('flow.google.com/project'));
  if (!page) {
    console.error('Page not found');
    process.exit(1);
  }

  console.log('Monitoring Flow video generation in progress...');
  let finished = false;

  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(6000);
    // Check if three dots are gone or stop button changed to send arrow
    const sendArrow = page.locator('button:has(svg):has-text(""), button[aria-label*="Send"], button[aria-label*="Submit"]').last();
    const dots = page.locator('text=•••, [class*="typing"], [class*="loading"], [class*="spinner"]').first();
    const hasDots = await dots.isVisible().catch(() => false);

    console.log(`Check ${i + 1}/15: Loading indicator visible: ${hasDots}`);

    // Check if new video tile or new media appeared in the grid or in chat
    const videoElements = await page.$$eval('video, [data-media-id], flow-grid-tile-container, flow-chat-bubble video', els => els.length);
    console.log(`Media elements count: ${videoElements}`);

    if (!hasDots && i > 3) {
      finished = true;
      break;
    }
  }

  const shotPath = 'C:/Users/Administrator/.gemini/antigravity/brain/926a5305-999b-4cf1-ae5a-c7460b808e46/flow-generation-result.png';
  await page.screenshot({ path: shotPath });
  console.log('Screenshot saved to', shotPath);

  // Check recent chat text
  const msgs = await page.$$eval('[class*="chat"], flow-chat-bubble, p', els => els.map(e => e.innerText?.trim()).filter(Boolean));
  console.log('Latest messages:', msgs.slice(-5));

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
