import { chromium } from "../flow-mcp-runtime/node_modules/playwright-core/index.mjs";
import fs from "fs";
import path from "path";

const OUT_PATH = path.join(process.cwd(), ".data", "flow-preview.jpg");
const DATA_DIR = path.join(process.cwd(), ".data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Keep event loop alive permanently
setInterval(() => {}, 60000);

process.on("uncaughtException", (err) => {
  console.warn("Uncaught exception in stream daemon:", err?.message || err);
});

process.on("unhandledRejection", (reason) => {
  console.warn("Unhandled rejection in stream daemon:", reason?.message || reason);
});

async function run() {
  console.log("Flow stream daemon starting...");
  let browser = null;
  let page = null;
  let client = null;

  while (true) {
    try {
      if (!browser || !page || page.isClosed()) {
        if (browser) {
          try { await browser.close(); } catch (_) {}
        }
        browser = null;
        page = null;
        client = null;

        browser = await chromium.connectOverCDP("http://127.0.0.1:9333", { timeout: 5000 }).catch(() => null);
        if (browser) {
          browser.on("disconnected", () => {
            console.log("Browser disconnected, will reconnect...");
            browser = null;
            page = null;
            client = null;
          });

          const pages = browser.contexts()[0]?.pages() || [];
          page = pages.find((p) => p.url().includes("flow.google.com"));
          if (page) {
            client = await page.context().newCDPSession(page);
            console.log("Connected to Google Flow tab:", await page.title().catch(() => "Google Flow"));
          }
        }
      }

      if (client && page && !page.isClosed()) {
        const shot = await client.send("Page.captureScreenshot", {
          format: "jpeg",
          quality: 65,
        }).catch((e) => {
          console.warn("Screenshot error:", e.message);
          client = null;
          page = null;
          return null;
        });

        if (shot?.data) {
          fs.writeFileSync(OUT_PATH, Buffer.from(shot.data, "base64"));
        }
      }
    } catch (err) {
      console.warn("Stream tick error:", err.message);
      client = null;
      page = null;
    }

    await new Promise((r) => setTimeout(r, 1500));
  }
}

run();
