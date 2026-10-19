# TradeJourn MT5 Connector — Windows VPS Setup & Security Guide

This connector streams account telemetry, open positions, and closed deal history from your MetaTrader 5 terminal to your TradeJourn journal.

---

## 🔒 1. Security Architecture & Hardening

### A. Investor Password Only (Strictly Enforced)
- **Always use your broker's INVESTOR (read-only) password**, never your master/trading password.
- The connector is programmatically read-only; it does not contain any code to place, modify, or close trades (`order_send` is strictly absent).
- MT5 login credentials are saved **only locally on your VPS** in `config.json`. They are **never sent to TradeJourn cloud servers or the browser frontend**.

### B. Outbound HTTPS Only (Zero Inbound Ports)
- The connector initiates standard outbound HTTPS (Port 443) requests to the TradeJourn API.
- **You do NOT need to open any incoming firewall ports on your VPS**.
- In Windows Defender Firewall, you can restrict inbound connections to block all external access.

### C. Windows VPS & RDP Hardening Tips
1. **Change Default RDP Port**: Switch Remote Desktop from port `3389` to a custom port (e.g. `49152+`) in Windows Registry.
2. **Network Level Authentication (NLA)**: Ensure NLA is enabled for Remote Desktop.
3. **Dedicated Windows Account**: Run the connector under a standard or dedicated service account rather than the primary Administrator account.
4. **Disable Inbound Port Openings**: Ensure your cloud VPS provider (Hetzner, Contabo, AWS Lightsail) has all inbound ports closed except your secured RDP port.

---

## 🚀 2. Quick Setup Instructions

### Step 1: Install MetaTrader 5 & Python on VPS
1. Download and install your broker's official MetaTrader 5 terminal (64-bit).
2. Log into your MT5 account using your **Investor Password**.
3. Install **Python 3.10+ (64-bit)** from [python.org](https://www.python.org/downloads/). Ensure you check `"Add Python to PATH"`.

### Step 2: Configure TradeJourn Connector
1. Copy this `connectors/mt5-python` folder to your VPS (e.g. `C:\TradeJournConnector\`).
2. Open TradeJourn in your browser, go to **MT5 Integration**, and click **"Generate Pairing Code"**.
3. Copy `config.example.json` to `config.json` and fill in:
   - `backend_url`: Your TradeJourn web URL (e.g., `https://tradejourn.com` or local dev `http://localhost:5000`)
   - `pairing_code`: The 6-character code from the TradeJourn UI
   - `mt5.login`: Your MT5 account number
   - `mt5.password`: Your **Investor Password**
   - `mt5.server`: Exact broker server name (e.g., `ICMarketsSC-Demo` or `FTMO-Demo`)
   - `mt5.path`: Path to `terminal64.exe` (usually `C:\Program Files\MetaTrader 5\terminal64.exe`)

### Step 3: Run Setup Script
Right-click `install_service.bat` and select **"Run as Administrator"**.
This script will:
- Install Python requirements (`pip install -r requirements.txt`)
- Test the terminal connection
- Set up auto-start on Windows boot via Task Scheduler

---

## 🛠️ 3. Running as a Permanent Windows Service (NSSM)

For 24/7 high-availability prop firm / institutional tracking:
1. Download [NSSM (Non-Sucking Service Manager)](https://nssm.cc/download).
2. Extract `nssm.exe` to `C:\Windows\System32\`.
3. Open an Administrator Command Prompt and run:
   ```cmd
   nssm install TradeJournMT5 "C:\Python311\python.exe" "C:\TradeJournConnector\connector.py"
   nssm set TradeJournMT5 AppDirectory "C:\TradeJournConnector"
   nssm set TradeJournMT5 AppRestartDelay 5000
   nssm start TradeJournMT5
   ```

---

## 🔍 4. Troubleshooting & Common Errors

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| `mt5.initialize() failed: (-10003)` | MT5 terminal path incorrect | Set exact `path` to `terminal64.exe` in `config.json`. |
| `mt5.login() failed: (10005)` | Invalid server name or password | Double-check exact broker server name in MT5 login window (`File -> Login to Trade Account`). |
| `clock drift of Xs exceeds allowed limit` | VPS system clock out of sync | In Windows Settings, click **"Sync Now"** under Date & Time to synchronize with `time.windows.com`. |
| `Connector Status: Stale` | Connector process stopped or sleeping | Verify Python process is running; check `mt5_connector.log`. |

---

## 📝 5. Log Files & Monitoring

The connector outputs structured JSON logs to `mt5_connector.log`. Log rotation prevents disk saturation (automatically capped at 10 MB per file, 5 rotated backups).
