import { spawn } from "child_process";
import fs from "fs";

function startTunnel(name, localUrl, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const args = ["tunnel", "--url", localUrl, ...extraArgs];
    console.log(`[${name}] Launching: cloudflared ${args.join(" ")}`);
    const proc = spawn("cloudflared", args, { stdio: ["ignore", "pipe", "pipe"], detached: true });
    
    let resolved = false;
    let logBuffer = "";

    function checkOutput(data) {
      const text = data.toString();
      logBuffer += text;
      // Look for trycloudflare.com link
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        resolve({ url: match[0], pid: proc.pid, proc });
      }
    }

    proc.stdout.on("data", checkOutput);
    proc.stderr.on("data", checkOutput);

    proc.on("error", (err) => {
      if (!resolved) reject(err);
    });

    proc.on("exit", (code) => {
      if (!resolved) reject(new Error(`[${name}] Process exited with code ${code}\n${logBuffer}`));
    });

    // Timeout after 20s
    setTimeout(() => {
      if (!resolved) {
        reject(new Error(`[${name}] Timeout waiting for tunnel URL.\nLogs:\n${logBuffer.slice(-1000)}`));
      }
    }, 20000);
  });
}

async function main() {
  console.log("Starting Cloudflare Tunnels for OpenPost and Google Flow...");

  // 1. OpenPost on port 3000
  const openpostTunnel = await startTunnel("OpenPost", "http://127.0.0.1:3000");
  console.log(`✅ OpenPost Public URL: ${openpostTunnel.url}`);

  // 2. Google Flow on port 8787 (with host header rewrite)
  const flowTunnel = await startTunnel("Google Flow", "http://127.0.0.1:8787", ["--http-host-header", "127.0.0.1:8787"]);
  console.log(`✅ Google Flow Public URL: ${flowTunnel.url}`);

  const token = fs.readFileSync("C:\\Users\\Administrator\\.flow-mcp\\token", "utf8").trim();

  const manifest = {
    openpost: {
      url: openpostTunnel.url,
      mcpEndpoint: `${openpostTunnel.url}/api/mcp`,
      apiBase: `${openpostTunnel.url}/api`,
      dashboard: openpostTunnel.url
    },
    googleFlow: {
      url: flowTunnel.url,
      studio: `${flowTunnel.url}/`,
      apiBase: `${flowTunnel.url}/api`,
      token: token,
      authenticatedStudio: `${flowTunnel.url}/?token=${token}`
    },
    startedAt: new Date().toISOString()
  };

  fs.writeFileSync(".data/tunnel-manifest.json", JSON.stringify(manifest, null, 2), "utf8");
  console.log("Saved tunnel manifest to .data/tunnel-manifest.json");

  // Keep processes alive
  openpostTunnel.proc.unref();
  flowTunnel.proc.unref();
}

main().catch(err => {
  console.error("Tunnel Startup Error:", err);
  process.exit(1);
});
