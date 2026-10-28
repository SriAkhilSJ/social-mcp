# Socialix One-Click Master Launcher
$ErrorActionPreference = "SilentlyContinue"
$projectRoot = "C:\Users\Administrator\Downloads\openpost"
Set-Location $projectRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🚀 Launching Socialix AI Studio Suite" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Flow MCP Daemon (Port 8787)
$flowPort = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if (-not $flowPort) {
    Write-Host "⚙️ Starting Google Flow MCP Daemon on port 8787..." -ForegroundColor Yellow
    Start-Process -FilePath "node" -ArgumentList "dist/studio.js" -WorkingDirectory "$projectRoot\flow-mcp-runtime" -WindowStyle Hidden
} else {
    Write-Host "✅ Google Flow MCP is already running (Port 8787)" -ForegroundColor Green
}

# 2. Socialix Web Server (Port 3000)
$socialixPort = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $socialixPort) {
    Write-Host "⚙️ Starting Socialix Dev Server on port 3000..." -ForegroundColor Yellow
    $startCmd = "`$env:NODE_OPTIONS='--max-old-space-size=4096'; npx next dev --hostname 0.0.0.0 --port 3000"
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-WindowStyle", "Hidden", "-Command", $startCmd -WorkingDirectory $projectRoot -WindowStyle Hidden
} else {
    Write-Host "✅ Socialix Dev Server is already running (Port 3000)" -ForegroundColor Green
}

# 3. 24/7 Autopilot Daemon
$autopilotRunning = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "autopilot-daemon.mjs"
}
if (-not $autopilotRunning) {
    Write-Host "⚙️ Starting 24/7 Autopilot Daemon (DDGS + Analytics)..." -ForegroundColor Yellow
    Start-Process -FilePath "node" -ArgumentList "scripts/autopilot-daemon.mjs" -WorkingDirectory $projectRoot -WindowStyle Hidden
} else {
    Write-Host "✅ 24/7 Autopilot Daemon is already running" -ForegroundColor Green
}

# 4. Wait for Socialix to be ready
Write-Host "⏳ Checking Socialix availability..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 15; $i++) {
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:3000/api/agents/status" -TimeoutSec 2 -UseBasicParsing
        if ($res.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
}

# 5. Open as Native Desktop App Window
Write-Host "🖥️ Opening Socialix Native Desktop App..." -ForegroundColor Green
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if (Test-Path $chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList "--app=http://localhost:3000", "--user-data-dir=C:\Users\Administrator\.socialix-app-profile"
} elseif (Test-Path $edgePath) {
    Start-Process -FilePath $edgePath -ArgumentList "--app=http://localhost:3000"
} else {
    Start-Process "http://localhost:3000"
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🎉 Socialix is live! All 6 services managed in background." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
