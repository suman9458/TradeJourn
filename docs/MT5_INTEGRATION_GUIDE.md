# TradeJourn MetaTrader 5 (MT5) Integration Master Guide

> **Version:** 2.0.0 Institutional Release  
> **Architecture:** Outbound-only Python Connector (Windows VPS) -> HMAC-SHA256 Signed Ingestion -> TradeJourn Cloud API (Render / Node.js) -> React Client

---

## 🏛️ 1. Architecture Overview

TradeJourn connects to MetaTrader 5 via an asynchronous, decoupled architecture designed for institutional security and zero VPS attack surface:

```
[ Windows VPS ]
  MetaTrader 5 Terminal (Logged in with Investor Read-Only Password)
       │
       ▼ (Local IPC / Win32 socket)
  Python MT5 Connector (connector.py)
       │
       ▼ (Outbound HTTPS + HMAC-SHA256 Signature)
[ Render Cloud API ]
  TradeJourn Node.js / Express Server
       │
       ▼ (Mongoose ODM with unique compound constraints)
  MongoDB Atlas Database
       │
       ▼ (Polled every 5-6s, "Updated X seconds ago")
[ React SPA Client ]
  MT5 Integration Dashboard, Open Positions, and Pending Journals
```

### Core Security Guarantees:
1. **Investor Password Only:** MT5 credentials live strictly on the VPS in `config.json`. They are never transmitted over the network and never stored in TradeJourn.
2. **Zero Order Execution Code:** The connector is strictly read-only. It contains no implementation of `order_send`, `order_check`, or order modification APIs.
3. **Outbound HTTPS Only:** No inbound ports are opened on the Windows VPS.
4. **HMAC-SHA256 Signatures:** Every connector request is signed using `HMAC-SHA256(secret, method:path:timestamp:nonce:bodyHash)`. Requests are rejected if clock drift > 30 seconds or if a nonce is reused.
5. **Persistent SQLite Outbox:** Network hiccups or Render cold starts enqueue deals into a local SQLite queue (`outbox.db`), which replays automatically with exponential backoff and jitter.

---

## 🚀 2. Step-by-Step Deployment Guide

### A. Deploy TradeJourn Backend (Render)
1. In your Render Dashboard, ensure the following environment variables are set:
   ```env
   MT5_INTEGRATION_ENABLED=true
   MT5_MAX_CLOCK_DRIFT_SEC=30
   MT5_HEARTBEAT_TIMEOUT_SEC=30
   ```
2. Verify that `/api/health` returns status `online`.

### B. Deploy Python Connector on Windows VPS
1. **Download and Install MT5 Terminal:**
   - Install MetaTrader 5 from your broker (e.g. IC Markets, FTMO, Prop firm).
   - Log into your account using your **Investor (read-only) Password**.
2. **Download and Install Python 3.10+ (64-bit):**
   - Ensure you check `"Add Python to PATH"`.
3. **Copy Connector Files:**
   - Copy the folder `connectors/mt5-python/` to your VPS (e.g. `C:\TradeJournConnector\`).
4. **Generate Pairing Code:**
   - Log into TradeJourn in your browser, navigate to the **MT5 Integration** tab, and click **"Pair MT5 Terminal"**.
   - Copy the 6-character code (e.g. `A9X2K1`).
5. **Configure `config.json`:**
   - Copy `config.example.json` to `config.json` and fill in:
     ```json
     {
       "backend_url": "https://your-tradejourn-app.onrender.com",
       "polling_interval_sec": 5,
       "history_backfill_days": 30,
       "pairing_code": "A9X2K1",
       "mt5": {
         "login": 10023456,
         "password": "YOUR_INVESTOR_PASSWORD",
         "server": "Broker-Demo",
         "path": "C:\\Program Files\\MetaTrader 5\\terminal64.exe"
       }
     }
     ```
6. **Install Service & Launch:**
   - Right-click `install_service.bat` and click **"Run as Administrator"**.
   - To launch manually: `python connector.py`.

---

## 📐 3. Mathematical Formula Definitions

All trade audit calculations are strictly derived from validated, fully closed positions:

| Metric | Formula | Edge Case Handling |
| :--- | :--- | :--- |
| **Realized Win Rate** | `(Winning Trades / Total Closed Trades) * 100` | Defaults to `0.0%` if `Total Trades = 0` |
| **Average Win** | `Sum(Net Profit of WINs) / Count(WINs)` | `0.00` if `Count(WINs) = 0` |
| **Average Loss** | `Sum(Abs(Net Profit of LOSSes)) / Count(LOSSes)` | `0.00` if `Count(LOSSes) = 0` |
| **Profit Factor** | `Gross Wins / Abs(Gross Losses)` | **Safe Zero-Loss Division:** If `Losses = 0`, returns `99.99` if `Wins > 0`, else `0.0` |
| **Mathematical Expectancy** | `(Win Rate * Avg Win) - (Loss Rate * Avg Loss)` | Returns mean expectancy in USD per execution |
| **R-Multiple** | `(Close Price - Open Price) / Abs(Open Price - Initial SL)` | Only calculated when an initial Stop Loss existed on entry |
| **Net Realized P&L** | `Gross Profit + Broker Commission + Swap + Taxes` | Reflects true cash balance change after all broker fees |
| **Pips Generated** | `(Exit Price - Entry Price) / Pip_Factor` | Uses `0.01` for JPY/Gold and `0.0001` for standard forex |

---

## 🛠️ 4. Troubleshooting & Diagnostics

### 1. Connector Reports: `mt5.initialize() failed: (-10003)`
- **Cause:** Terminal 64-bit binary not found at the specified path.
- **Fix:** Verify path in `config.json` (e.g. `C:\\Program Files\\MetaTrader 5\\terminal64.exe`).

### 2. Connector Reports: `mt5.login() failed: (10005)`
- **Cause:** Invalid server name or password.
- **Fix:** In MT5 terminal, click `File -> Login to Trade Account`. Verify server name matches the dropdown exactly. Use the Investor Password.

### 3. Backend Returns: `clock drift of Xs exceeds allowed limit`
- **Cause:** VPS system clock has drifted from UTC.
- **Fix:** In Windows Settings -> Time & Language -> Date & Time, click **"Sync Now"** to synchronize with `time.windows.com`.

### 4. TradeJourn Dashboard shows: `Status: Stale`
- **Cause:** Backend has not received a heartbeat within 30 seconds.
- **Fix:** Check `mt5_connector.log` on the VPS to verify the Python process is alive.

---

## 🧪 5. Demo Account Verification Checklist

Follow this checklist on an MT5 demo account to verify full end-to-end functionality:

- [ ] **Step 1 (Pairing):** Click "Pair MT5 Terminal", paste code into `config.json`, launch `python connector.py`, verify status switches to `CONNECTED`.
- [ ] **Step 2 (Telemetry):** Confirm account balance, equity, and margin metrics match your MT5 terminal.
- [ ] **Step 3 (Open Position):** In MT5, execute a manual trade (e.g., 0.10 lots EURUSD). Within 5 seconds, verify it appears in the **Live Open Positions Table** with correct entry price, current price, and floating P&L.
- [ ] **Step 4 (Partial Close):** Close 0.05 lots in MT5. Verify position volume updates to 0.05 lots remaining, and no premature journal entry is generated.
- [ ] **Step 5 (Full Close):** Close the remaining 0.05 lots. Within 6 seconds, verify:
  - Position disappears from Open Positions table.
  - In-app notification pops up: *"Trade closed on MT5 (#Ticket). Complete your journal entry."*
  - Card appears under **Pending Trade Journals**.
- [ ] **Step 6 (Complete Journal):** Click "Complete Journal", fill in Setup Rating (A+), Strategy notes, paste chart screenshot (`Ctrl+V`), and click **"Submit & Audit Journal"**.
- [ ] **Step 7 (Audit Verification):** Navigate to **Database Ledger** and **Performance Reviews**; confirm trade appears with `[MT5 #Ticket]` badge and feeds into all win rate, expectancy, and psychology audit scores.
- [ ] **Step 8 (Replay & Disconnect):** Stop and restart the connector; verify no duplicate deals or positions are created (idempotency verified).

---

## ⏪ 6. Database Rollback Guide

If you ever need to rollback the MT5 schema:
1. Run rollback locally or on staging:
   ```bash
   npm run migrate:down
   ```
2. Collections `mt5accounts`, `mt5deals`, `mt5positions`, and `mt5auditlogs` will be safely dropped.
3. To disable MT5 without dropping data:
   ```env
   MT5_INTEGRATION_ENABLED=false
   ```
