import { chromium } from "../flow-mcp-runtime/node_modules/playwright-core/index.mjs";

async function main() {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const pages = b.contexts()[0].pages();
  const page = pages.find((p) => p.url().includes("/scene/"));
  if (!page) {
    console.log("No scene page found");
    return;
  }

  // Look for prompt input box on the scene timeline
  const promptBox = page.locator('textarea, [contenteditable="true"], [role="combobox"], [placeholder*="prompt"], [placeholder*="Describe"], [placeholder*="clip"]').first();
  const visible = await promptBox.isVisible().catch(() => false);
  console.log("Prompt box visible:", visible);

  if (visible) {
    console.log("Found prompt box! Typing video prompt...");
    await promptBox.click();
    await promptBox.fill("Cinematic dark anime scene, an intelligent blind gangster in dark charcoal suit adjusting black sunglasses calmly in the rain at night, neon lights reflections, 24fps high quality anime motion");
    await page.waitForTimeout(1000);

    const generateBtn = page.locator('button[aria-label*="Generate"], button:has-text("arrow_forward"), button:has-text("Create")').first();
    if (await generateBtn.isVisible().catch(() => false)) {
      console.log("Clicking Generate button on Flow Scene...");
      await generateBtn.click();
      console.log("Video generation triggered on Google Flow timeline!");
    } else {
      await page.keyboard.press("Enter");
      console.log("Pressed Enter to generate video!");
    }
  } else {
    // Let's see what is clickable in the bottom generation area
    const bottomElements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("button, [role='button'], textarea, input")).map((e) => ({
        text: e.innerText?.trim() || "",
        aria: e.getAttribute("aria-label") || "",
        placeholder: e.getAttribute("placeholder") || "",
      })).filter((x) => x.text || x.aria || x.placeholder);
    });
    console.log("Bottom interactive elements:", bottomElements);
  }

  process.exit(0);
}

main().catch(console.error);
