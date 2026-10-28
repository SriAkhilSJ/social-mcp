import { chromium } from "../flow-mcp-runtime/node_modules/playwright-core/index.mjs";

async function main() {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const pages = b.contexts()[0].pages();
  const flowPage = pages.find((p) => p.url().includes("flow.google.com/project"));
  if (!flowPage) {
    console.log("No Flow page found");
    return;
  }
  const btn = flowPage.locator('button:has-text("Nano Banana"), [aria-label*="model"], span:has-text("arrow_drop_down")').first();
  await btn.click({ force: true });
  await flowPage.waitForTimeout(1500);

  const menuItems = await flowPage.locator('[role="menuitem"], [role="option"], mat-option, .mat-mdc-menu-item').allInnerTexts().catch(() => []);
  console.log("Menu items found:", menuItems);

  process.exit(0);
}

main().catch(console.error);
