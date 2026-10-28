import { chromium } from '../flow-mcp-runtime/node_modules/playwright-core/index.mjs';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts()[0].pages().find(p => p.url().includes('flow.google.com/project'));
  if (!page) {
    console.error('Page not found');
    process.exit(1);
  }

  console.log('Finding Approve or Always approve button...');
  const alwaysApproveBtn = page.getByRole('button', { name: /Always approve/i });
  const approveBtn = page.getByRole('button', { name: /^Approve$/i });

  if (await alwaysApproveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Clicking "Always approve"...');
    await alwaysApproveBtn.click();
    console.log('Clicked "Always approve"!');
  } else if (await approveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Clicking "Approve"...');
    await approveBtn.click();
    console.log('Clicked "Approve"!');
  } else {
    // Look for button containing text Approve
    const anyBtn = page.locator('button:has-text("Approve")').first();
    if (await anyBtn.isVisible()) {
      console.log('Clicking button with text "Approve"...');
      await anyBtn.click();
    } else {
      console.log('No approve button visible.');
    }
  }

  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'C:/Users/Administrator/.gemini/antigravity/brain/926a5305-999b-4cf1-ae5a-c7460b808e46/flow-generation-running.png' });
  console.log('Screenshot saved to flow-generation-running.png');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
