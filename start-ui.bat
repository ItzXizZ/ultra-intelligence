@echo off
echo Starting UltraIntelligence System...
echo.
echo Starting API Server (Port 3001)...
start "API Server" cmd /k "npm run server"
echo.
echo Waiting 3 seconds for API server to start...
timeout /t 3 /nobreak >nul
echo.
echo Starting React UI (Port 3000)...
start "React UI" cmd /k "cd ui && npm start"
echo.
echo Both servers are starting...
echo API Server: http://localhost:3001
echo React UI: http://localhost:3000
echo.
echo The React UI is now powered by your actual AI system from index.js!
echo.
echo Press any key to close this window...
pause >nul
