import { chromium } from '../flow-mcp-runtime/node_modules/playwright-core/index.mjs';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const contexts = browser.contexts();
  const page = contexts[0].pages().find(p => p.url().includes('flow.google.com/project'));
  if (!page) {
    console.error('Flow page not found');
    process.exit(1);
  }

  console.log('Found page:', page.url());
  await page.bringToFront();

  // Find the chat/agent input in the side panel
  const chatInput = page.locator('textarea[placeholder*="What do you want to create"], input[placeholder*="What do you want to create"], [contenteditable="true"]').last();
  const isChatVisible = await chatInput.isVisible({ timeout: 4000 }).catch(() => false);
  console.log('Chat input visible:', isChatVisible);

  const promptText = "Create an 8-second cinematic anime noir video reel (9:16 vertical): Ren Kurokawa, the blind gangster in a tailored charcoal suit and dark round sunglasses, standing in a rain-soaked Tokyo alley. A raindrop splashes on his dark sunglasses reflecting a drawn blade in slow motion, then he raises his ebony cane with lightning reflex to parry an assassin's strike with sharp sparks. Authentic MAPPA/Ufotable Japanese dark anime aesthetic, hand-drawn ink shadows, dramatic cinematic lighting.";

  if (isChatVisible) {
    console.log('Clicking and filling chat input...');
    await chatInput.click();
    await chatInput.fill('');
    await chatInput.fill(promptText);
    await page.waitForTimeout(500);

    // Look for the submit arrow button next to the input
    const submitBtn = page.locator('button:has(svg), button[aria-label*="Send"], button[aria-label*="Submit"]').last();
    console.log('Pressing Enter to submit...');
    await page.keyboard.press('Enter');
    console.log('Submitted prompt via Enter!');
    
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'C:/Users/Administrator/.gemini/antigravity/brain/926a5305-999b-4cf1-ae5a-c7460b808e46/flow-after-submit.png' });
    console.log('Saved screenshot to flow-after-submit.png');
  } else {
    console.log('Chat input not visible, searching for composer input...');
    const composerInput = page.locator('textarea, input[type="text"]').first();
    console.log('Composer input visible:', await composerInput.isVisible());
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
