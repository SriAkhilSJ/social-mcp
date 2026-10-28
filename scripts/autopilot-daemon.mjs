/**
 * Socialix 24/7 Autopilot Background Daemon
 * Runs continuously in the background, calling the autopilot endpoint every 15 minutes
 */

import fs from "node:fs";
import path from "node:path";

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function getSessionToken() {
  try {
    const sessionPath = path.join(process.cwd(), ".data", "active-session.json");
    if (!fs.existsSync(sessionPath)) return null;
    const data = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    return data.token || null;
  } catch {
    return null;
  }
}

async function runTick() {
  const token = getSessionToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Cookie"] = `socialix_session=${token}`;
  }

  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] 🤖 Autopilot Daemon checking cycle...`);

  try {
    const res = await fetch(`${BASE_URL}/api/autopilot`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "tick" }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      console.warn(`[${timestamp}] ⚠️ Autopilot endpoint returned status ${res.status}`);
      return;
    }

    const data = await res.json();
    console.log(`[${timestamp}] ✅ Autopilot cycle complete:`, data.result?.message || "OK");
    if (data.result?.trends?.length) {
      console.log(`[${timestamp}] 🌐 Top live anime trends:`, data.result.trends.slice(0, 3));
    }
  } catch (err) {
    console.error(`[${timestamp}] ❌ Autopilot error:`, err.message);
  }
}

async function main() {
  console.log("==================================================");
  console.log("🚀 Socialix 24/7 Autonomous Background Engine");
  console.log(`📡 Target: ${BASE_URL}/api/autopilot`);
  console.log(`⏱️ Interval: Every 15 minutes`);
  console.log("==================================================");

  // Initial immediate tick
  await runTick();

  // Recurring loop
  setInterval(runTick, INTERVAL_MS);
}

main().catch(console.error);
