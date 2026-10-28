import { chromium } from "../flow-mcp-runtime/node_modules/playwright-core/index.mjs";

async function main() {
  console.log("Connecting to live Chrome on CDP port 9333...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const contexts = browser.contexts();
  const pages = contexts[0].pages();
  const page = pages.find(p => p.url().includes("flow.google.com/project"));

  if (!page) {
    console.error("No open Flow project page found!");
    process.exit(1);
  }

  await page.bringToFront();
  console.log("Active page URL:", page.url(), "Title:", await page.title());

  // Check inputs and buttons in the composer
  const promptInput = page.locator('textarea:visible, [contenteditable="true"]:visible').first();
  const isInputVisible = await promptInput.isVisible().catch(() => false);
  console.log("Prompt input visible:", isInputVisible);

  if (isInputVisible) {
    const promptText = "Cinematic anime style, an intelligent blind gangster wearing dark sunglasses and a tailored charcoal suit standing calmly in the rain under neon city lights, 8k resolution, cinematic lighting";
    console.log("Typing prompt into Google Flow composer...");
    await promptInput.click();
    await promptInput.fill("");
    await promptInput.fill(promptText);

    // Look for generate button
    const genBtn = page.locator('button:has-text("Generate"), button:has-text("Start"), button[aria-label*="Generate"], button[aria-label*="Create"]').first();
    const isGenVisible = await genBtn.isVisible().catch(() => false);
    console.log("Generate button visible:", isGenVisible);

    if (isGenVisible) {
      console.log("Clicking Generate button...");
      await genBtn.click();
      console.log("SUCCESS: Video generation submitted to Google Flow!");
    } else {
      // Check all visible buttons
      const buttons = await page.$$eval("button", btns => btns.map(b => (b.innerText || b.getAttribute("aria-label") || "").trim()).filter(t => t.length > 0));
      console.log("All visible buttons:", buttons.slice(0, 15));
    }
  } else {
    const allInputs = await page.$$eval("textarea, input, [contenteditable]", els => els.map(e => ({ tag: e.tagName, type: e.type, placeholder: e.placeholder, visible: e.offsetWidth > 0 })));
    console.log("Inputs found:", allInputs);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
