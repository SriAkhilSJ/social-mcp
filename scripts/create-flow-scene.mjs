import { chromium } from "../flow-mcp-runtime/node_modules/playwright-core/index.mjs";

async function main() {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const pages = b.contexts()[0].pages();
  const flowPage = pages.find((p) => p.url().includes("flow.google.com/project"));

  if (!flowPage) {
    console.log("No Flow page found!");
    process.exit(1);
  }

  await flowPage.bringToFront();
  console.log("Current URL:", flowPage.url());

  // Click the "Add media menu" button first
  const addBtn = flowPage.locator('button[aria-label="Add media menu"], button:has-text("add")').first();
  await addBtn.click();
  await flowPage.waitForTimeout(1000);

  // Click "New scene" in the menu!
  const newSceneBtn = flowPage.locator('text="New scene"').first();
  if (await newSceneBtn.isVisible().catch(() => false)) {
    console.log("Found 'New scene' button! Clicking it...");
    await newSceneBtn.click();
    await flowPage.waitForTimeout(3000);
    console.log("New Scene page loaded! New URL:", flowPage.url());

    // Check what elements are in this Scene
    const sceneBody = await flowPage.locator('body').innerText();
    console.log("Scene body snippet:", sceneBody.slice(0, 400));
  } else {
    console.log("New scene button not visible in menu");
  }

  process.exit(0);
}

main().catch(console.error);
