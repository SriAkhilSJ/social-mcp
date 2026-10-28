import pkg from '../flow-mcp-runtime/node_modules/playwright-core/index.js';
const { chromium } = pkg;

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('flow.google.com')) || context.pages()[0];
  
  // Find textarea or input for prompt
  const input = page.locator('textarea, [contenteditable="true"], input[placeholder*="create"]').first();
  console.log('Input found:', await input.isVisible().catch(() => false));
  
  const promptText = 'Cinematic vertical anime reel: Ren Kurokawa slowly walks forward tapping his cane on the wet asphalt under neon signs, dark rain reflections, dark round sunglasses, cold calm syndicate boss presence.';
  await input.fill(promptText);
  await page.waitForTimeout(500);
  
  // Click Start generation button (arrow_forward)
  const submitBtn = page.getByRole('button', { name: 'Start generation' }).or(page.locator('button:has-text("arrow_forward")'));
  console.log('Submitting generation...');
  await submitBtn.first().click();
  await page.waitForTimeout(3000);
  console.log('Submitted successfully!');
}

main().catch(console.error);
