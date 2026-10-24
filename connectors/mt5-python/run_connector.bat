@echo on
title TradeJourn MT5 Desktop Connector
echo =====================================================================
echo  TradeJourn MetaTrader 5 (MT5) Desktop Connector Launcher
echo =====================================================================
echo.

if not exist config.json (
    echo [!] config.json not found! Copying from config.example.json...
    copy config.example.json config.json
    echo [i] Please edit config.json with your API Key, Secret and MT5 details.
    notepad config.json
    pause
)

echo [*] Checking Python dependencies...
python -m pip install -r requirements.txt

echo.
echo [*] Launching MT5 Connector...
python connector.py
pause
