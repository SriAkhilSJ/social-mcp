import pkg from '../flow-mcp-runtime/node_modules/playwright-core/index.js';
const { chromium } = pkg;

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('flow.google.com')) || context.pages()[0];
  
  // Find all elements with text 'close'
  const closeElements = await page.locator('button, [role="button"]').all();
  for (const el of closeElements) {
    const text = (await el.innerText().catch(() => '')).trim();
    const label = (await el.getAttribute('aria-label').catch(() => '')) || '';
    if (text === 'close' || label.toLowerCase() === 'close' || label.toLowerCase().includes('close panel')) {
      console.log('Clicking close element:', text, label);
      await el.click().catch(() => {});
    }
  }
  await page.waitForTimeout(1000);
  console.log('Done closing panels');
}

main().catch(console.error);
