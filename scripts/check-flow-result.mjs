import { chromium } from '../flow-mcp-runtime/node_modules/playwright-core/index.mjs';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts()[0].pages().find(p => p.url().includes('flow.google.com/project'));
  if (!page) {
    console.error('Page not found');
    process.exit(1);
  }

  const chatBubbles = await page.$$eval('[class*="bubble"], [class*="message"], flow-chat-bubble, p', els => els.map(e => e.innerText?.trim()).filter(Boolean));
  console.log('Chat bubbles:', chatBubbles.slice(-8));

  const videos = await page.$$eval('video', els => els.map(v => ({ src: v.src, currentSrc: v.currentSrc, duration: v.duration })));
  console.log('Videos on page:', JSON.stringify(videos, null, 2));

  // Check tile containers
  const tiles = await page.$$eval('flow-grid-tile-container, [data-media-id]', els => els.map(e => ({
    ariaLabel: e.getAttribute('aria-label'),
    mediaId: e.getAttribute('data-media-id'),
    tag: e.tagName
  })));
  console.log('Tiles found:', tiles.slice(-8));

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
