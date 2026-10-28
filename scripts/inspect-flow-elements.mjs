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
  console.log("URL:", flowPage.url());

  const buttons = await flowPage.locator('button, [role="button"], a').evaluateAll((els) =>
    els
      .map((e) => ({
        text: e.innerText?.trim() || "",
        aria: e.getAttribute("aria-label") || "",
        title: e.getAttribute("title") || "",
        id: e.id,
      }))
      .filter((x) => x.text || x.aria || x.title)
  );

  console.log("Buttons found:", JSON.stringify(buttons, null, 2));

  // Check if there is an Add / Plus button or Video option
  const addBtn = flowPage.locator('button:has-text("add"), [aria-label*="Add"], [aria-label*="Create"]').first();
  if (await addBtn.isVisible().catch(() => false)) {
    console.log("Add button found, clicking to see creation menu...");
    await addBtn.click();
    await flowPage.waitForTimeout(1000);
    const popupText = await flowPage.locator('[role="menu"], [role="dialog"], .menu').allInnerTexts().catch(() => []);
    console.log("Creation menu content:", popupText);
  }

  process.exit(0);
}

main().catch(console.error);
