import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  let commitSha = process.env.RENDER_GIT_COMMIT || "";
  let builtAt = "";
  let deployId = process.env.RENDER_DEPLOY_ID || null;

  const candidates = [
    path.join(process.cwd(), "public", "build-info.json"),
    path.join(process.cwd(), ".next", "standalone", "public", "build-info.json"),
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        const info = JSON.parse(fs.readFileSync(c, "utf-8"));
        if (info.commitSha) commitSha = info.commitSha;
        if (info.builtAt) builtAt = info.builtAt;
        if (info.renderDeployId) deployId = info.renderDeployId;
        break;
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({
    status: "ok",
    commitSha: commitSha || "unknown",
    builtAt: builtAt || new Date().toISOString(),
    renderDeployId: deployId,
    serviceId: "srv-dbh689mc6qcc7380j32g",
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
  });
}
