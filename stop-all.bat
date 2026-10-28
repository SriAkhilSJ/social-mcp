@echo off
echo Stopping OpenPost and Cloudflare tunnel...

echo.
echo Stopping OpenPost Docker container...
cd openpost
docker compose down
echo OpenPost stopped.

echo.
echo Stopping Cloudflare tunnel...
taskkill /f /im cloudflared.exe 2>nul
echo Tunnel stopped.

echo.
echo All stopped.
pause