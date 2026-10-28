import pkg from '../flow-mcp-runtime/node_modules/playwright-core/index.js';
const { chromium } = pkg;

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('flow.google.com')) || context.pages()[0];
  
  // Find the tile for Blind man wearing suit
  const tile = page.locator('div, [role="gridcell"], article').filter({ hasText: 'Blind' }).first();
  console.log('Tile found:', await tile.isVisible().catch(() => false));
  await tile.hover();
  await page.waitForTimeout(1000);
  
  const buttonsOnTile = await tile.locator('button, [role="button"]').all();
  console.log('Buttons on tile:', buttonsOnTile.length);
  for (const b of buttonsOnTile) {
    console.log('Tile button:', await b.innerText().catch(() => ''), await b.getAttribute('aria-label').catch(() => ''));
  }
}

main().catch(console.error);
