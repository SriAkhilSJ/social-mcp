import { chromium } from '../flow-mcp-runtime/node_modules/playwright-core/index.mjs';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts()[0].pages().find(p => p.url().includes('flow.google.com/project'));
  if (!page) {
    console.error('Page not found');
    process.exit(1);
  }

  console.log('Locating element with text "Always approve" or "Approve"...');
  const alwaysApproveEl = page.locator('text=Always approve').first();
  const approveEl = page.locator('text=Approve').first();

  if (await alwaysApproveEl.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Found "Always approve" element. Clicking...');
    await alwaysApproveEl.click();
    console.log('Successfully clicked "Always approve"!');
  } else if (await approveEl.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Found "Approve" element. Clicking...');
    await approveEl.click();
    console.log('Successfully clicked "Approve"!');
  } else {
    console.log('Neither found by text selector. Dumping elements with approve in text:');
    const dump = await page.$$eval('*', els => els.filter(e => e.innerText && e.innerText.includes('Approve') && e.children.length === 0).map(e => ({ tag: e.tagName, text: e.innerText, class: e.className })));
    console.log(dump);
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/Administrator/.gemini/antigravity/brain/926a5305-999b-4cf1-ae5a-c7460b808e46/flow-generation-active.png' });
  console.log('Screenshot saved to flow-generation-active.png');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
