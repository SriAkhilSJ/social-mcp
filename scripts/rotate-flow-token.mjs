import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

const newToken = crypto.randomBytes(24).toString("hex");
console.log("Generated fresh Flow token:", newToken);

// 1. Write to ~/.flow-mcp/token
const tokenFile = path.join(os.homedir(), ".flow-mcp", "token");
fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
fs.writeFileSync(tokenFile, newToken, "utf8");
console.log("Updated", tokenFile);

// 2. Update .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  let env = fs.readFileSync(envPath, "utf8");
  if (env.includes("FLOW_MCP_TOKEN=")) {
    env = env.replace(/FLOW_MCP_TOKEN=.*/g, `FLOW_MCP_TOKEN=${newToken}`);
  } else {
    env += `\nFLOW_MCP_TOKEN=${newToken}\n`;
  }
  fs.writeFileSync(envPath, env, "utf8");
  console.log("Updated .env.local");
}

console.log("Token rotation complete!");
