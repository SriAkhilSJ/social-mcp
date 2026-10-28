import { chromium } from "../flow-mcp-runtime/node_modules/playwright-core/index.mjs";

async function main() {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const pages = b.contexts()[0].pages();
  const page = pages.find((p) => p.url().includes("/scene/"));
  if (!page) {
    console.log("No scene page found");
    return;
  }

  // Find the generate button
  const genBtn = page.locator('button[aria-label="Start generation"]').first();
  console.log("Gen button found, looking for parent prompt container...");

  // Evaluate the prompt input container in the DOM
  const promptSelector = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Start generation"]');
    if (!btn) return "No gen btn";
    // Find the enclosing bar or parent
    const container = btn.closest(".prompt-box, form, [class*='prompt'], [class*='input'], div");
    // Find any editable or text input inside or nearby
    const el = document.querySelector('[contenteditable="true"], textarea, [role="textbox"], input[type="text"]');
    if (el) {
      return { tag: el.tagName, class: el.className, text: el.textContent };
    }
    // Check all contenteditables
    return "No editable found";
  });
  console.log("Prompt input evaluation:", promptSelector);

  // Let's try typing into whatever contenteditable or text input exists
  const editable = page.locator('[contenteditable="true"]').first();
  if (await editable.isVisible().catch(() => false)) {
    console.log("Found contenteditable! Clicking and typing...");
    await editable.click();
    await page.keyboard.type("Cinematic anime, an intelligent blind gangster in dark suit and sunglasses standing in rain at night, 24fps fluid motion");
    await page.waitForTimeout(1000);
    console.log("Clicking Start Generation button...");
    await genBtn.click();
    console.log("SUCCESS! Video generation triggered on Google Flow timeline!");
  } else {
    // Click 'Select a clip to edit' or 'Add clip'
    console.log("Trying to click 'add: Add clip' button...");
    const addClipBtn = page.locator('button[aria-label="Add clip"]').first();
    await addClipBtn.click();
    await page.waitForTimeout(1000);
    const newEditable = page.locator('[contenteditable="true"], textarea').first();
    console.log("New editable visible:", await newEditable.isVisible().catch(() => false));
    if (await newEditable.isVisible().catch(() => false)) {
      await newEditable.click();
      await page.keyboard.type("Cinematic anime, an intelligent blind gangster in dark suit and sunglasses standing in rain at night, 24fps fluid motion");
      await page.waitForTimeout(500);
      await genBtn.click();
      console.log("SUCCESS! Added clip and triggered video generation!");
    }
  }

  process.exit(0);
}

main().catch(console.error);
