import { chromium } from '../flow-mcp-runtime/node_modules/playwright-core/index.mjs';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts()[0].pages().find(p => p.url().includes('flow.google.com'));
  if (!page) {
    console.log('No page found');
    process.exit(1);
  }

  // Get text of all paragraphs and spans in the right sidebar
  const texts = await page.$$eval('aside *, [role="complementary"] *, flow-chat-bubble *', els => els.map(e => e.innerText?.trim()).filter(Boolean));
  const unique = [...new Set(texts)];
  console.log('Unique chat texts:', unique.slice(-15));

  // Check if any video tag or download button is present
  const videos = await page.$$eval('video', els => els.map(v => v.src || v.currentSrc));
  console.log('Videos:', videos);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
