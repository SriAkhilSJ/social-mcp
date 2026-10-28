import { chromium } from "../google-flow-browser-mcp/node_modules/playwright-core/index.js";
import fs from "fs";
import path from "path";

async function main() {
  let promptText = process.env.FLOW_USER_PROMPT;
  let targetRatio = process.env.FLOW_ASPECT_RATIO || "9:16";
  if (!promptText) {
    try {
      const saved = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".data", "flow-instruction.json"), "utf8"));
      promptText = saved.prompt;
      if (saved.aspectRatio) targetRatio = saved.aspectRatio;
    } catch {
      // fallback
    }
  }

  if (!promptText) {
    console.error("No prompt provided to submit-flow.mjs");
    process.exit(1);
  }

  console.log("Connecting to Chrome CDP on 9333...");
  const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const contexts = b.contexts();
  const page = contexts[0].pages().find(p => p.url().includes("flow.google.com/project") || p.url().includes("flow.google.com"));

  if (!page) {
    console.error("Google Flow project page not found!");
    process.exit(1);
  }

  await page.bringToFront();
  console.log("Found page:", await page.title());

  // Dismiss any open modal overlay if present
  try {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } catch {}

  // Find the ProseMirror input field
  const promptInput = page.locator('.ProseMirror[contenteditable="true"]:visible, textarea:visible, [contenteditable="true"]:visible').first();
  if (!(await promptInput.isVisible().catch(() => false))) {
    console.error("Prompt input not visible");
    process.exit(1);
  }

  console.log(`Directing Flow with prompt: "${promptText.slice(0, 60)}..."`);
  await promptInput.click();
  // Clear existing content in ProseMirror
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(150);

  // Type the prompt into ProseMirror
  await promptInput.fill(promptText).catch(async () => {
    await page.keyboard.type(promptText, { delay: 15 });
  });
  await page.waitForTimeout(400);

  // Click start generation button
  const generateBtn = page.locator('button.generate-icon-button, button[aria-label*="Start generation"], button:has-text("arrow_forward")').first();
  if (await generateBtn.isVisible().catch(() => false)) {
    console.log("Clicking Start Generation button...");
    await generateBtn.click({ force: true });
  } else {
    console.log("Pressing Enter to submit...");
    await page.keyboard.press("Enter");
  }

  console.log("Prompt successfully dispatched to Google Flow canvas!");

  // Poll for completion (up to 45s) and capture output media
  const mediaDir = path.join(process.cwd(), ".data", "media");
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  let completed = false;
  for (let i = 0; i < 9; i++) {
    await page.waitForTimeout(4000);
    const mediaList = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("img, video"));
      return els.map(e => ({
        tag: e.tagName.toLowerCase(),
        src: e.src,
        width: e.offsetWidth,
        height: e.offsetHeight
      })).filter(e => e.width > 200 && (
        e.src.includes("flow-content.google") ||
        e.src.includes("flow.google.com/asb") ||
        e.src.startsWith("blob:") ||
        e.src.includes("googleusercontent.com")
      ));
    }).catch(() => []);

    if (mediaList.length > 0) {
      console.log(`Found ${mediaList.length} generated media items on page`);
      for (const item of mediaList.slice(0, 2)) {
        try {
          if (item.src.startsWith("http")) {
            const res = await page.request.get(item.src);
            if (res.ok()) {
              const buffer = await res.body();
              const ext = item.tag === "video" ? "mp4" : "webp";
              const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
              const outPath = path.join(mediaDir, filename);
              fs.writeFileSync(outPath, buffer);
              console.log(`Saved generated asset to ${filename} (${buffer.length} bytes)`);
              completed = true;
            }
          }
        } catch (downloadErr) {
          console.warn("Could not download asset:", downloadErr.message);
        }
      }
    }

    if (completed) break;
  }

  await b.close();
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal Flow error:", err);
  process.exit(1);
});

  process.exit(0);
}

main().catch(err => {
  console.error("Error directing Flow:", err);
  process.exit(1);
});
