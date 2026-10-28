const { chromium } = require('./flow-mcp-runtime/node_modules/playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('flow.google.com')) || context.pages()[0];
  console.log('Flow page URL:', page.url());
  console.log('Flow page title:', await page.title());
  await page.screenshot({ path: '.data/flow-screen-now.png' });
  console.log('Screenshot saved to .data/flow-screen-now.png');
  
  const tiles = await page.evaluate(() => {
    const list = [];
    document.querySelectorAll('[role="gridcell"], [data-asset-id], [aria-label]').forEach(el => {
      const label = el.getAttribute('aria-label') || el.innerText;
      if (label && label.trim()) list.push(label.trim());
    });
    return list;
  });
  console.log('Tiles/elements count:', tiles.length);
  console.log('Sample tiles:', tiles.slice(0, 20));
})();
