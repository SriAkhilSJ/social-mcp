@echo off
:: Start OpenPost Docker container
cd openpost
docker compose up -d
echo OpenPost started...

:: Wait and verify health
timeout /t 5 /nobreak >nul
curl -s --max-time 10 http://localhost:8080/api/v1/ready | find "ready" && echo OpenPost is healthy || echo Check logs: docker compose logs --tail 100 openpost