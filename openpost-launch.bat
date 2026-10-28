@echo off
:: ==========================================
:: OpenPost + Cloudflare Launcher (Single .bat)
:: Starts OpenPost Docker + Cloudflare tunnel, verifies health
:: ==========================================

echo.
echo [1] Starting OpenPost...
cd openpost
docker compose up -d >nul 2>&1
echo OpenPost started.

echo.
echo [2] Starting Cloudflare tunnel (quick, no account)...
timeout /t 3 /nobreak >nul
cmd /c "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8080 >nul &
echo Tunnel launching in background.

echo.
echo [3] Verifying health checks...

:: Check localhost
echo.
echo OpenPost at localhost:5080...
curl -s --max-time 8 http://localhost:8080/api/v1/ready 2>&1 | find "ready" && echo   OK: OpenPost healthy || echo   WARN: OpenPost may still be starting

:: Check public URL (from earlier session)
echo.
echo Public URL (trycloudflare):
curl -s --max-time 8 https://holiday-bone-agriculture-london.trycloudflare.com/api/v1/ready 2>&1 | find "ready" && echo   OK: Public HTTPS reachable || echo   INFO: Tunnel still initializing - re-run this bat

echo.
echo ==========================================
echo Launch complete.
echo ==========================================
echo.
echo To use:
echo   - OpenPost:       http://localhost:8080
echo   - Public URL:     https://holiday-bone-agriculture-london.trycloudflare.com
echo   - MCP token:      Get from OpenPost Settings → Personal → Developer
echo.
pause