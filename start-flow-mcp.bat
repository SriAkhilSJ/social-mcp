@echo off
setlocal
title Google Flow MCP Bridge (45,000 Credits - Veo 3.1 / Omni Flash)

echo ============================================================================
echo   Socialix x Google Flow Video MCP Launcher (Veo 3.1 ^& Omni 1.1 Flash)
echo   Drives https://flow.google.com directly using your 45,000 Flow credits!
echo ============================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js 22+ is required. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "flow-mcp-runtime" (
  echo [1/3] Cloning GTAI-1/flow-mcp into .\flow-mcp-runtime ...
  git clone --depth 1 https://github.com/GTAI-1/flow-mcp.git flow-mcp-runtime
)

pushd flow-mcp-runtime
if not exist "node_modules" (
  echo [2/3] Installing flow-mcp dependencies ...
  call npm install
)
if not exist "dist\index.js" (
  echo [2/3] Building flow-mcp TypeScript runtime ...
  call npm run build
)

echo.
echo [3/3] Starting Google Flow MCP Studio Server on http://127.0.0.1:8787 ...
echo  - First launch opens a dedicated Chrome window: sign into your Google AI Pro
echo    account at https://flow.google.com ONCE (session persists in %%USERPROFILE%%\.flow-mcp).
echo  - Copy the token printed below (or from %%USERPROFILE%%\.flow-mcp\token) into:
echo    Socialix -^> Settings -^> Integrations -^> Google Flow Video MCP
echo.
if exist "%USERPROFILE%\.flow-mcp\token" (
  echo  Current Flow MCP Token:
  type "%USERPROFILE%\.flow-mcp\token"
  echo.
)

set FLOW_MCP_PORT=8787
node dist/index.js --studio
popd
pause
