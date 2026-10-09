@echo off
title TradeJourn MERN Trading Command Center
echo ================================================================
echo   STARTING TRADEJOURN MERN PLATFORM (API Server + React UI)
echo ================================================================
echo.
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your PATH. Please install Node.js.
    pause
    exit /b 1
)

echo Starting Backend API (Port 5000) and Frontend (Port 5173)...
echo Press Ctrl+C in this window anytime to stop both servers.
echo.

call npm.cmd run dev
if errorlevel 1 (
    echo.
    echo [NOTE] npm run dev exited. Launching independent processes...
    start "TradeJourn Backend API (Port 5000)" cmd /k "node server/server.js"
    start "TradeJourn Client UI (Port 5173)" cmd /k "cd client && npm.cmd run dev"
)
pause
