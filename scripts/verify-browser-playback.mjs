import pkg from '../flow-mcp-runtime/node_modules/playwright-core/index.js';
const { chromium } = pkg;
import path from 'path';

async function main() {
  console.log('Connecting to Chrome CDP...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = await context.newPage();
  
  const videoUrl = 'http://localhost:3000/media/ren_kurokawa_blind_gangster_official.mp4';
  console.log('Navigating to:', videoUrl);
  await page.goto(videoUrl, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: '.data/browser_playing_verified_video.png' });
  console.log('Captured screenshot of browser playing verified video!');
  await page.close();
}

main().catch(console.error);
