@echo off
echo 🚀 Starting UltraIntelligence Student Counselor System...
echo.
echo 📱 This will start both the backend API and frontend UI
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: npm is not installed or not in PATH
    pause
    exit /b 1
)

echo ✅ Node.js and npm found
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing backend dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install backend dependencies
        pause
        exit /b 1
    )
)

if not exist "frontend\node_modules" (
    echo 📦 Installing frontend dependencies...
    cd frontend
    npm install
    cd ..
    if %errorlevel% neq 0 (
        echo ❌ Failed to install frontend dependencies
        pause
        exit /b 1
    )
)

echo.
echo 🎯 Starting the system...
echo.
echo 📊 Backend will run on: http://localhost:3001
echo 🌐 Frontend will run on: http://localhost:3000
echo.
echo 💡 Keep this window open while using the system
echo 🚪 Close this window to stop the system
echo.

REM Start both backend and frontend
start "UltraIntelligence Backend" cmd /k "npm run server"
timeout /t 3 /nobreak >nul
start "UltraIntelligence Frontend" cmd /k "cd frontend && npm start"

echo.
echo 🎉 System started successfully!
echo.
echo 📱 Open your browser to: http://localhost:3000
echo.
pause
