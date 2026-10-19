@echo off
TITLE TradeJourn MT5 Connector - Windows Service Installer
COLOR 0A

echo =====================================================================
echo  TradeJourn MetaTrader 5 (MT5) VPS Connector Setup
echo =====================================================================
echo.

:: Check for Administrative privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This installer must be run as Administrator!
    echo Right-click this file and choose "Run as Administrator".
    pause
    exit /b 1
)

cd /d "%~dp0"

echo [1/4] Checking Python environment...
python --version
if %errorLevel% neq 0 (
    echo [ERROR] Python 3.9+ is not found in PATH.
    echo Please install Python 3.10+ from python.org and check "Add to PATH".
    pause
    exit /b 1
)

echo.
echo [2/4] Installing required Python packages...
pip install -r requirements.txt
if %errorLevel% neq 0 (
    echo [ERROR] Failed to install pip requirements.
    pause
    exit /b 1
)

echo.
echo [3/4] Checking config.json...
if not exist "config.json" (
    echo Creating config.json from config.example.json...
    copy config.example.json config.json
    echo [IMPORTANT] Please edit config.json with your TradeJourn pairing code and MT5 credentials!
    notepad config.json
)

echo.
echo [4/4] Setting up Windows Auto-Start Task...
echo Creating Windows Task Scheduler job "TradeJournMT5Bridge"...
schtasks /create /tn "TradeJournMT5Bridge" /tr "python \"%~dp0connector.py\"" /sc onstart /ru SYSTEM /f

echo.
echo =====================================================================
echo [SUCCESS] TradeJourn MT5 Connector is configured!
echo.
echo To start the connector now in interactive console mode:
echo   python connector.py
echo =====================================================================
pause
