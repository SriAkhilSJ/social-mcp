@echo off
echo ==========================================
echo OpenPost + Cloudflare Tunnel Verification
echo ==========================================

echo.
echo 1. OpenPost health (localhost):
curl -s --max-time 10 http://localhost:8080/api/v1/ready | find "ready" && echo   PASS: OpenPost healthy || echo   FAIL: OpenPost not responding

echo.
echo 2. Public URL via Cloudflare tunnel:
curl -s --max-time 10 https://holiday-bone-agriculture-london.trycloudflare.com/api/v1/ready | find "ready" && echo   PASS: Public URL reachable || echo   FAIL: Public URL not reachable (tunnel may need restart)

echo.
echo 3. MCP endpoint (needs token from OpenPost UI):
curl -s --max-time 10 https://holiday-bone-agriculture-london.trycloudflare.com/mcp | find /i "token" && echo   PASS: MCP responsive || echo   INFO: MCP empty (expected without token) - get token at: OpenPost Settings → Personal → Developer → create mcp:read token

echo.
echo ==========================================
echo Done.
echo ==========================================