import { connectToBrowser } from "../src/browser/connect.js";
import { handleFlowStatus } from "../src/tools/flow-status.js";

async function main() {
  console.log("Connecting to live Chrome on CDP port 9333...");
  const conn = await connectToBrowser({ cdpPort: 9333 });
  console.log("Connected! Page title:", await conn.page.title(), "URL:", conn.page.url());
  const status = await handleFlowStatus();
  console.log("Flow status result:", status);
  process.exit(0);
}

main().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
