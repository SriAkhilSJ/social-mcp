import { chromium } from "../flow-mcp-runtime/node_modules/playwright-core/index.mjs";

async function main() {
  console.log("Connecting to Chrome CDP on 9333...");
  const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const pages = b.contexts()[0].pages();
  const flowPage = pages.find((p) => p.url().includes("flow.google.com/project"));

  if (!flowPage) {
    console.error("Flow project page not found!");
    process.exit(1);
  }

  await flowPage.bringToFront();
  console.log("Current page title:", await flowPage.title());

  // Look for the Nano Banana model button
  const modelBtn = flowPage.locator('button:has-text("Nano Banana"), button:has-text("Banana")').first();
  if (await modelBtn.isVisible().catch(() => false)) {
    console.log("Found Nano Banana button, clicking to open model dropdown...");
    await modelBtn.click();
    await flowPage.waitForTimeout(1000);

    // Look for Veo option in the dropdown
    const veoOption = flowPage.locator('button:has-text("Veo"), [role="option"]:has-text("Veo"), [role="menuitem"]:has-text("Veo"), div:has-text("Veo 3.1"), div:has-text("Veo 2")').first();
    if (await veoOption.isVisible().catch(() => false)) {
      console.log("Found Veo video option, clicking...");
      await veoOption.click();
      console.log("Successfully switched model to Veo Video!");
    } else {
      console.log("Available popup texts:", await flowPage.locator('[role="menu"], [role="listbox"], .popup, .dropdown').allInnerTexts().catch(() => []));
    }
  } else {
    console.log("Nano Banana button not visible directly. Checking all buttons...");
    const allBtns = await flowPage.locator('button').allInnerTexts();
    console.log("All buttons:", allBtns);
  }

  // Also check aspect ratio button
  const aspectBtn = flowPage.locator('button:has-text("crop"), button:has-text("16:9"), button:has-text("9:16")').first();
  if (await aspectBtn.isVisible().catch(() => false)) {
    console.log("Found aspect button:", await aspectBtn.innerText());
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
