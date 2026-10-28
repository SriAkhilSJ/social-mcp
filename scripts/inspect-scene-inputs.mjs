import { chromium } from "../flow-mcp-runtime/node_modules/playwright-core/index.mjs";

async function main() {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const pages = b.contexts()[0].pages();
  const flowPage = pages.find((p) => p.url().includes("/scene/"));
  if (!flowPage) {
    console.log("No scene page");
    return;
  }
  const inputs = await flowPage.locator('input, textarea, [contenteditable="true"], [role="textbox"]').evaluateAll((els) =>
    els.map((e) => ({
      tag: e.tagName,
      placeholder: e.getAttribute("placeholder") || "",
      aria: e.getAttribute("aria-label") || "",
      visible: e.offsetParent !== null,
    }))
  );
  console.log("Inputs found:", inputs);

  // Check all buttons
  const btns = await flowPage.locator('button').evaluateAll((els) =>
    els.map((e) => ({
      text: e.innerText?.trim() || "",
      aria: e.getAttribute("aria-label") || "",
    })).filter((x) => x.text || x.aria)
  );
  console.log("Buttons in scene:", btns.slice(0, 25));

  process.exit(0);
}

main().catch(console.error);
