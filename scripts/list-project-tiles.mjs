import { chromium } from '../flow-mcp-runtime/node_modules/playwright-core/index.mjs';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts()[0].pages().find(p => p.url().includes('flow.google.com/project'));
  if (!page) {
    console.log('No page found');
    process.exit(1);
  }

  const tiles = await page.$$eval('flow-grid-tile-container, [data-media-id]', els => els.map(e => ({
    ariaLabel: e.getAttribute('aria-label'),
    mediaId: e.getAttribute('data-media-id'),
    tag: e.tagName,
    text: e.innerText?.trim()?.slice(0, 80)
  })));
  console.log('Project tiles count:', tiles.length);
  console.log('Tiles:', JSON.stringify(tiles, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
