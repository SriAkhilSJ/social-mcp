@echo off
:: Start Cloudflare quick tunnel (no account needed)
echo Starting Cloudflare tunnel...
:: Use cmd /c to avoid bash syntax issues with paths containing spaces
cmd /c "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8080
echo Tunnel started - checking URL...
timeout /t 8 /nobreak >nul
:: Try the URL we got earlier - it may take a moment to be reachable
curl -s --max-time 10 https://holiday-bone-agriculture-london.trycloudflare.com/api/v1/ready && echo Tunnel is working! || echo Tunnel may still be initializing - wait a moment and re-run this bat