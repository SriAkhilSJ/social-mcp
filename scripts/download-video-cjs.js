const path = require('path');
const pkg = require(path.resolve(__dirname, '../flow-mcp-runtime/node_modules/playwright-core'));
const { chromium } = pkg;
const fs = require('fs');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('flow.google.com')) || context.pages()[0];
  
  const tiles = await page.locator('flow-grid-tile-container, div[role="gridcell"]').all();
  console.log('Total tiles:', tiles.length);
  
  const firstTile = tiles[0];
  console.log('Hovering first tile...');
  await firstTile.hover();
  await page.waitForTimeout(600);
  
  const moreBtn = firstTile.getByRole('button', { name: 'More options' }).or(firstTile.locator('button:has-text("more_vert"), [aria-label*="options"]')).first();
  await moreBtn.click();
  await page.waitForTimeout(1000);
  
  const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
  const downloadItem = page.getByRole('menuitem', { name: 'Download' }).or(page.locator('[role="menuitem"]:has-text("Download")')).first();
  console.log('Clicking Download...');
  await downloadItem.click();
  
  const download = await downloadPromise;
  const targetPath = path.resolve('public/media/ren_kurokawa_verified_video.mp4');
  await download.saveAs(targetPath);
  console.log('SAVED VERIFIED VIDEO TO:', targetPath);
}

main().catch(console.error);
