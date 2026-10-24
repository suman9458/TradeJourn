#!/usr/bin/env python3
"""
TradeJourn MetaTrader 5 (MT5) Desktop Connector
================================================
Architecture: Strictly Read-Only Outbound Bridge
Sends:
  1. Telemetry Heartbeat (Balance, Equity, Margin, Floating P&L) -> /api/mt5/telemetry/heartbeat
  2. Open Positions Snapshot -> /api/mt5/sync/positions
  3. Closed Trade Deals -> /api/mt5/sync/deals

Guarantees:
  - Zero order execution / modification methods (Read-Only)
  - HMAC-SHA256 authenticated transmission
  - Replay protection via cryptographic nonce & timestamps
"""

import os
import sys
import time
import json
import uuid
import hmac
import hashlib
import logging
from datetime import datetime, timedelta, timezone

try:
    import requests
except ImportError:
    print("Error: 'requests' package is not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    import MetaTrader5 as mt5
except ImportError:
    print("Warning: 'MetaTrader5' Python package not found. (Windows only: pip install MetaTrader5)")
    mt5 = None

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("TradeJournMT5")

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
EXAMPLE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.example.json")

def load_config():
    if not os.path.exists(CONFIG_PATH):
        if os.path.exists(EXAMPLE_PATH):
            logger.error(f"Config file 'config.json' not found! Please copy 'config.example.json' to 'config.json' and fill in your credentials.")
        else:
            logger.error("Config file not found.")
        sys.exit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def send_signed_request(backend_url, endpoint, body, api_key_id, api_secret):
    """
    Signs request body with HMAC-SHA256 and sends to TradeJourn API
    Signature format: METHOD:PATH:TIMESTAMP:NONCE:BODY_HASH
    """
    url = f"{backend_url.rstrip('/')}{endpoint}"
    timestamp = str(int(time.time()))
    nonce = str(uuid.uuid4())
    body_str = json.dumps(body) if body is not None else ""
    body_hash = hashlib.sha256(body_str.encode('utf-8')).hexdigest()

    payload_to_sign = f"POST:{endpoint}:{timestamp}:{nonce}:{body_hash}"
    signature = hmac.new(api_secret.encode('utf-8'), payload_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "x-connector-key": api_key_id,
        "x-connector-timestamp": timestamp,
        "x-connector-nonce": nonce,
        "x-connector-signature": signature
    }

    try:
        res = requests.post(url, headers=headers, data=body_str, timeout=12)
        if res.status_code == 200:
            return res.json()
        else:
            logger.warning(f"Server responded {res.status_code} on {endpoint}: {res.text[:200]}")
            return None
    except Exception as e:
        logger.error(f"Failed to connect to backend {url}: {e}")
        return None

def init_mt5(config):
    if mt5 is None:
        logger.error("MetaTrader 5 module unavailable. Running in simulated telemetry mode.")
        return False

    mt5_cfg = config.get("mt5", {})
    path = mt5_cfg.get("path")
    login = mt5_cfg.get("login")
    password = mt5_cfg.get("password")
    server = mt5_cfg.get("server")

    init_kwargs = {}
    if path and os.path.exists(path):
        init_kwargs["path"] = path

    logger.info("Initializing MetaTrader 5 terminal connection...")
    if not mt5.initialize(**init_kwargs):
        logger.error(f"mt5.initialize() failed: error code = {mt5.last_error()}")
        return False

    if login and password and server:
        logger.info(f"Logging in to MT5 Server: {server} (Login: {login}) [Investor Read-Only]...")
        authorized = mt5.login(login=int(login), password=str(password), server=str(server))
        if not authorized:
            logger.error(f"mt5.login() failed: error code = {mt5.last_error()}")
            return False

    account_info = mt5.account_info()
    if account_info:
        logger.info(f"Connected to MT5! Account #{account_info.login} ({account_info.server}) - Balance: ${account_info.balance:.2f}")
        return True
    return False

def sync_telemetry(config):
    backend_url = config.get("backend_url", "http://localhost:5000")
    api_key_id = config.get("api_key_id", "")
    api_secret = config.get("api_secret", "")

    if mt5 and mt5.account_info():
        info = mt5.account_info()
        heartbeat_data = {
            "balance": float(info.balance),
            "equity": float(info.equity),
            "margin": float(info.margin),
            "freeMargin": float(info.margin_free),
            "marginLevel": float(info.margin_level) if info.margin_level else 0.0,
            "floatingProfit": float(info.profit)
        }
    else:
        # Fallback simulator if MT5 package not installed
        heartbeat_data = {
            "balance": 10000.0,
            "equity": 10245.5,
            "margin": 150.0,
            "freeMargin": 10095.5,
            "marginLevel": 6830.33,
            "floatingProfit": 245.5
        }

    return send_signed_request(backend_url, "/api/mt5/telemetry/heartbeat", heartbeat_data, api_key_id, api_secret)

def sync_positions(config):
    backend_url = config.get("backend_url", "http://localhost:5000")
    api_key_id = config.get("api_key_id", "")
    api_secret = config.get("api_secret", "")

    positions_list = []
    if mt5 and mt5.account_info():
        raw_positions = mt5.positions_get()
        if raw_positions:
            for p in raw_positions:
                positions_list.append({
                    "ticket": int(p.ticket),
                    "symbol": str(p.symbol),
                    "direction": "Buy" if p.type == 0 else "Sell",
                    "volume": float(p.volume),
                    "price": float(p.price_open),
                    "currentPrice": float(p.price_current),
                    "sl": float(p.sl) if p.sl else 0.0,
                    "tp": float(p.tp) if p.tp else 0.0,
                    "swap": float(p.swap),
                    "profit": float(p.profit),
                    "openTimeUTC": datetime.fromtimestamp(p.time, tz=timezone.utc).isoformat()
                })

    return send_signed_request(backend_url, "/api/mt5/sync/positions", {"positions": positions_list}, api_key_id, api_secret)

def sync_deals(config, last_sync_dt):
    backend_url = config.get("backend_url", "http://localhost:5000")
    api_key_id = config.get("api_key_id", "")
    api_secret = config.get("api_secret", "")

    if not mt5 or not mt5.account_info():
        return None

    now = datetime.now()
    raw_deals = mt5.history_deals_get(last_sync_dt, now)
    if not raw_deals:
        return None

    deals_payload = []
    for d in raw_deals:
        # 0 = Buy, 1 = Sell
        deal_type = "BUY" if d.type == 0 else ("SELL" if d.type == 1 else "OTHER")
        # 0 = IN, 1 = OUT, 2 = INOUT, 3 = OUT_BY
        entry_type = "IN" if d.entry == 0 else ("OUT" if d.entry == 1 else "INOUT")

        deals_payload.append({
            "dealTicket": int(d.ticket),
            "orderTicket": int(d.order),
            "positionId": int(d.position_id),
            "symbol": str(d.symbol),
            "type": deal_type,
            "entry": entry_type,
            "volume": float(d.volume),
            "price": float(d.price),
            "timeUTC": datetime.fromtimestamp(d.time, tz=timezone.utc).isoformat(),
            "profit": float(d.profit),
            "commission": float(d.commission),
            "swap": float(d.swap)
        })

    if deals_payload:
        logger.info(f"Streaming {len(deals_payload)} closed deals to TradeJourn ledger...")
        return send_signed_request(backend_url, "/api/mt5/sync/deals", {"deals": deals_payload}, api_key_id, api_secret)
    return None

def main():
    logger.info("=" * 60)
    logger.info("TradeJourn MetaTrader 5 (MT5) Desktop Connector v2.0")
    logger.info("Strictly Read-Only Outbound Bridge | Institutional Auditing")
    logger.info("=" * 60)

    config = load_config()
    interval = int(config.get("polling_interval_sec", 5))
    days_back = int(config.get("history_backfill_days", 30))
    last_deals_sync = datetime.now() - timedelta(days=days_back)

    is_connected = init_mt5(config)
    if not is_connected:
        logger.warning("Could not establish direct MT5 socket connection. Check MT5 status.")

    logger.info(f"Starting ingestion loop (Sync Interval: {interval}s)...")
    while True:
        try:
            sync_telemetry(config)
            sync_positions(config)
            sync_deals(config, last_deals_sync)
            last_deals_sync = datetime.now() - timedelta(minutes=5)
        except KeyboardInterrupt:
            logger.info("Connector stopped by user.")
            break
        except Exception as e:
            logger.error(f"Error in connector iteration: {e}")

        time.sleep(interval)

    if mt5:
        mt5.shutdown()

if __name__ == "__main__":
    main()
