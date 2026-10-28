import { chromium } from "../flow-mcp-runtime/node_modules/playwright-core/index.mjs";

async function main() {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const pages = b.contexts()[0].pages();
  const flowPage = pages.find((p) => p.url().includes("flow.google.com/project") && p.url().includes("/scene/"));

  if (!flowPage) {
    console.error("No Flow Scene page found!");
    process.exit(1);
  }

  await flowPage.bringToFront();
  console.log("Found Scene URL:", flowPage.url());

  // Check aspect ratio and toggle to 9:16 portrait if available
  const aspectBtn = flowPage.locator('button:has-text("16:9"), button[aria-label*="Aspect"], button[aria-label*="aspect"]').first();
  if (await aspectBtn.isVisible().catch(() => false)) {
    console.log("Current aspect button found:", await aspectBtn.innerText());
    await aspectBtn.click();
    await flowPage.waitForTimeout(600);
    const portraitOption = flowPage.locator('text="9:16", [role="option"]:has-text("9:16"), [role="menuitem"]:has-text("9:16"), button:has-text("9:16")').first();
    if (await portraitOption.isVisible().catch(() => false)) {
      console.log("Switching aspect ratio to 9:16 vertical portrait...");
      await portraitOption.click();
    }
  }

  // Find the prompt input textarea / contenteditable
  const promptInput = flowPage.locator('textarea, [contenteditable="true"]').first();
  if (!(await promptInput.isVisible().catch(() => false))) {
    console.error("Prompt input not visible on Scene editor!");
    process.exit(1);
  }

  const videoPrompt = "In a single unbroken continuous shot: Cinematic dark anime scene, an intelligent blind gangster in a tailored charcoal suit and obsidian sunglasses standing calmly in the rain at night, rain splashing on his shoulders, neon reflections in his dark glasses, fluid character motion, 24fps cinematic animation";
  console.log("Typing video prompt into Flow Scene editor...");
  await promptInput.click();
  await promptInput.fill(videoPrompt);

  await flowPage.waitForTimeout(500);

  // Click arrow_forward (generate button)
  const generateBtn = flowPage.locator('button[aria-label="Start generation"], button:has-text("arrow_forward")').first();
  if (await generateBtn.isVisible().catch(() => false)) {
    console.log("Clicking Start Generation button...");
    await generateBtn.click();
    console.log("Generation started! Google Flow Omni/Veo video rendering is now active!");
  } else {
    console.log("Generate button not found, pressing Enter...");
    await promptInput.press("Enter");
  }

  process.exit(0);
}

main().catch(console.error);
