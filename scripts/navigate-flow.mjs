import { chromium } from '../flow-mcp-runtime/node_modules/playwright-core/index.mjs';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('flow.google.com/project'));
  if (!page) {
    console.error('Flow page not found');
    return;
  }
  console.log('Current URL:', page.url());
  if (page.url().includes('/tools')) {
    console.log('Navigating to root project grid...');
    await page.goto('https://flow.google.com/project/448bf0d7-8320-4626-b049-e4921c9e3079', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }
  console.log('Page URL now:', page.url());
  await page.screenshot({ path: 'C:/Users/Administrator/.gemini/antigravity/brain/926a5305-999b-4cf1-ae5a-c7460b808e46/flow-current-view3.png' });
  console.log('Screenshot saved to flow-current-view3.png');
}

main().catch(console.error);
