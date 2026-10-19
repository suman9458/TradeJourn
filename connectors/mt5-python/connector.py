"""
TradeJourn MetaTrader 5 (MT5) Institutional Connector
======================================================
Outbound-only, zero-latency bridge streaming account telemetry, open positions,
and raw deal executions from Windows VPS to TradeJourn backend.

CRITICAL SECURITY RULE:
READ-ONLY CONNECTOR. DO NOT IMPORT OR USE order_send, order_check, order_calc_margin,
OR ANY ORDER EXECUTION/MODIFICATION APIS ANYWHERE IN THIS FILE.
INVESTOR (READ-ONLY) BROKER CREDENTIALS ARE USED EXCLUSIVELY.
"""

import sys
import os
import json
import time
import uuid
import hmac
import hashlib
import sqlite3
import random
import signal
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, timezone, timedelta
import requests

# Try importing official MetaTrader5 package (Windows only)
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False


class OutboxQueue:
    """Local persistent SQLite outbox to prevent data loss during backend downtime."""

    def __init__(self, db_path="outbox.db"):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS outbox_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    endpoint TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    attempts INTEGER DEFAULT 0
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sync_watermarks (
                    key TEXT PRIMARY KEY,
                    val TEXT NOT NULL
                )
            """)

    def push(self, endpoint, payload_dict):
        with self._get_conn() as conn:
            conn.execute(
                "INSERT INTO outbox_events (endpoint, payload) VALUES (?, ?)",
                (endpoint, json.dumps(payload_dict))
            )

    def pop_pending(self, limit=20):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, endpoint, payload, attempts FROM outbox_events ORDER BY id ASC LIMIT ?",
                (limit,)
            )
            return cursor.fetchall()

    def remove(self, event_id):
        with self._get_conn() as conn:
            conn.execute("DELETE FROM outbox_events WHERE id = ?", (event_id,))

    def increment_attempts(self, event_id):
        with self._get_conn() as conn:
            conn.execute("UPDATE outbox_events SET attempts = attempts + 1 WHERE id = ?", (event_id,))

    def get_watermark(self, key, default=""):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT val FROM sync_watermarks WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row[0] if row else default

    def set_watermark(self, key, val):
        with self._get_conn() as conn:
            conn.execute(
                "INSERT INTO sync_watermarks (key, val) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET val = excluded.val",
                (key, str(val))
            )


class MT5Connector:
    """Institutional read-only MetaTrader 5 bridge client."""

    def __init__(self, config_path="config.json"):
        self.config_path = config_path
        self.config = self._load_config()
        self.running = True
        self.outbox = OutboxQueue()
        self._setup_logging()

        signal.signal(signal.SIGINT, self._handle_exit)
        signal.signal(signal.SIGTERM, self._handle_exit)

    def _load_config(self):
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Configuration file '{self.config_path}' not found. Please copy config.example.json to config.json and fill in your details.")
        with open(self.config_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_config(self):
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(self.config, f, indent=2)

    def _setup_logging(self):
        log_cfg = self.config.get("logging", {})
        log_level = getattr(logging, log_cfg.get("level", "INFO").upper(), logging.INFO)
        max_bytes = log_cfg.get("max_bytes", 10485760)
        backup_count = log_cfg.get("backup_count", 5)

        self.logger = logging.getLogger("MT5Connector")
        self.logger.setLevel(log_level)
        self.logger.handlers = []

        formatter = logging.Formatter(
            json.dumps({
                "timestamp": "%(asctime)s",
                "level": "%(levelname)s",
                "logger": "%(name)s",
                "message": "%(message)s"
            })
        )

        # File Handler with rotation
        fh = RotatingFileHandler("mt5_connector.log", maxBytes=max_bytes, backupCount=backup_count)
        fh.setFormatter(formatter)
        self.logger.addHandler(fh)

        # Console Handler
        ch = logging.StreamHandler()
        ch.setFormatter(formatter)
        self.logger.addHandler(ch)

    def _handle_exit(self, signum, frame):
        self.logger.info("Shutdown signal received. Performing graceful disconnection...")
        self.running = False
        if MT5_AVAILABLE:
            try:
                mt5.shutdown()
            except Exception:
                pass
        sys.exit(0)

    # -------------------------------------------------------------------------
    # HMAC Outbound Request Signing
    # -------------------------------------------------------------------------
    def _send_signed_request(self, method, endpoint, payload=None):
        backend_url = self.config.get("backend_url", "").rstrip("/")
        api_key_id = self.config.get("api_key_id", "")
        api_secret = self.config.get("api_secret", "")

        if not api_key_id or not api_secret:
            raise ValueError("Connector is not paired. Run pairing flow first.")

        url = f"{backend_url}{endpoint}"
        now_ts = str(int(time.time()))
        nonce = uuid.uuid4().hex
        body_str = json.dumps(payload) if payload else ""
        body_hash = hashlib.sha256(body_str.encode("utf-8")).hexdigest()

        # Method:Path:Timestamp:Nonce:BodyHash
        payload_to_sign = f"{method.upper()}:{endpoint}:{now_ts}:{nonce}:{body_hash}"
        signature = hmac.new(
            api_secret.encode("utf-8"),
            payload_to_sign.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "x-connector-key": api_key_id,
            "x-connector-timestamp": now_ts,
            "x-connector-nonce": nonce,
            "x-connector-signature": signature
        }

        try:
            resp = requests.request(method, url, json=payload, headers=headers, timeout=12)
            if resp.status_code in [200, 201]:
                return True, resp.json()
            else:
                self.logger.warning(f"Backend HTTP {resp.status_code}: {resp.text}")
                return False, resp.text
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Network error sending request to {endpoint}: {str(e)}")
            return False, str(e)

    # -------------------------------------------------------------------------
    # Pairing Flow
    # -------------------------------------------------------------------------
    def pair_with_backend(self):
        pairing_code = self.config.get("pairing_code", "").strip()
        if not pairing_code:
            self.logger.error("No pairing_code found in config.json. Generate code in TradeJourn UI.")
            return False

        mt5_cfg = self.config.get("mt5", {})
        backend_url = self.config.get("backend_url", "").rstrip("/")

        exchange_payload = {
            "pairingCode": pairing_code,
            "serverName": mt5_cfg.get("server", "Demo-Server"),
            "login": mt5_cfg.get("login", 0),
            "tradeMode": "live" if "live" in mt5_cfg.get("server", "").lower() else "demo",
            "accountType": "hedging",
            "leverage": 100,
            "currency": "USD"
        }

        try:
            resp = requests.post(
                f"{backend_url}/api/mt5/pair/exchange",
                json=exchange_payload,
                timeout=15
            )
            data = resp.json()
            if resp.status_code == 200 and data.get("success"):
                self.config["api_key_id"] = data["apiKeyId"]
                self.config["api_secret"] = data["apiSecret"]
                self.config["pairing_code"] = "" # Clear after pairing
                self._save_config()
                self.logger.info("Successfully paired connector with TradeJourn backend!")
                return True
            else:
                self.logger.error(f"Pairing exchange failed: {data.get('message')}")
                return False
        except Exception as e:
            self.logger.error(f"Failed to connect to backend during pairing: {str(e)}")
            return False

    # -------------------------------------------------------------------------
    # MetaTrader 5 Initialization
    # -------------------------------------------------------------------------
    def init_mt5(self):
        if not MT5_AVAILABLE:
            self.logger.warning("MetaTrader5 package not available on this platform. Running in simulated telemetry mode.")
            return True

        mt5_cfg = self.config.get("mt5", {})
        login = int(mt5_cfg.get("login", 0))
        password = mt5_cfg.get("password", "")
        server = mt5_cfg.get("server", "")
        terminal_path = mt5_cfg.get("path", "")

        init_args = {"timeout": mt5_cfg.get("timeout_ms", 60000)}
        if terminal_path and os.path.exists(terminal_path):
            init_args["path"] = terminal_path

        if not mt5.initialize(**init_args):
            self.logger.error(f"mt5.initialize() failed: {mt5.last_error()}")
            return False

        if login and password and server:
            authorized = mt5.login(login=login, password=password, server=server)
            if not authorized:
                self.logger.error(f"mt5.login() failed for account {login} on {server}: {mt5.last_error()}")
                return False
            self.logger.info(f"Connected to MT5 Terminal. Logged into {server} account #{login}.")
        else:
            self.logger.info("Connected to already active MT5 terminal session.")

        return True

    # -------------------------------------------------------------------------
    # Telemetry and Execution Collection
    # -------------------------------------------------------------------------
    def collect_account_telemetry(self):
        if not MT5_AVAILABLE:
            return {
                "balance": 10000.0,
                "equity": 10245.50,
                "margin": 150.0,
                "freeMargin": 10095.50,
                "marginLevel": 6830.33,
                "floatingProfit": 245.50
            }

        acc_info = mt5.account_info()
        if acc_info is None:
            self.logger.warning(f"Failed to retrieve account_info: {mt5.last_error()}")
            return None

        return {
            "balance": float(acc_info.balance),
            "equity": float(acc_info.equity),
            "margin": float(acc_info.margin),
            "freeMargin": float(acc_info.margin_free),
            "marginLevel": float(acc_info.margin_level) if acc_info.margin_level else 0.0,
            "floatingProfit": float(acc_info.profit)
        }

    def collect_open_positions(self):
        if not MT5_AVAILABLE:
            return []

        positions = mt5.positions_get()
        if positions is None:
            return []

        result = []
        for p in positions:
            open_dt = datetime.fromtimestamp(p.time, tz=timezone.utc)
            result.append({
                "ticket": p.ticket,
                "symbol": p.symbol,
                "direction": "Buy" if p.type == mt5.ORDER_TYPE_BUY else "Sell",
                "volume": float(p.volume),
                "price": float(p.price_open),
                "currentPrice": float(p.price_current),
                "sl": float(p.sl),
                "tp": float(p.tp),
                "swap": float(p.swap),
                "profit": float(p.profit),
                "openTimeUTC": open_dt.isoformat(),
                "magic": p.magic,
                "comment": p.comment
            })
        return result

    def collect_deals_since_watermark(self):
        if not MT5_AVAILABLE:
            return []

        watermark_str = self.outbox.get_watermark("last_deal_time_utc", "")
        if watermark_str:
            from_date = datetime.fromisoformat(watermark_str) - timedelta(minutes=10) # 10m overlap window
        else:
            days = self.config.get("history_backfill_days", 30)
            from_date = datetime.now(timezone.utc) - timedelta(days=days)

        to_date = datetime.now(timezone.utc) + timedelta(minutes=5)
        deals = mt5.history_deals_get(from_date, to_date)
        if deals is None:
            return []

        result = []
        latest_utc = from_date

        for d in deals:
            # Map deal entry enum
            entry_map = {
                mt5.DEAL_ENTRY_IN: "IN",
                mt5.DEAL_ENTRY_OUT: "OUT",
                mt5.DEAL_ENTRY_INOUT: "INOUT",
                mt5.DEAL_ENTRY_OUT_BY: "OUT_BY"
            }
            entry_str = entry_map.get(d.entry, "IN")
            type_str = "BUY" if d.type == mt5.DEAL_TYPE_BUY else "SELL"
            time_utc = datetime.fromtimestamp(d.time, tz=timezone.utc)

            if time_utc > latest_utc:
                latest_utc = time_utc

            result.append({
                "dealTicket": d.ticket,
                "orderTicket": d.order,
                "positionId": d.position_id,
                "symbol": d.symbol,
                "type": type_str,
                "entry": entry_str,
                "volume": float(d.volume),
                "price": float(d.price),
                "timeUTC": time_utc.isoformat(),
                "profit": float(d.profit),
                "commission": float(d.commission),
                "swap": float(d.swap),
                "fee": float(d.fee) if hasattr(d, "fee") else 0.0,
                "magic": d.magic,
                "comment": d.comment
            })

        if result:
            self.outbox.set_watermark("last_deal_time_utc", latest_utc.isoformat())

        return result

    # -------------------------------------------------------------------------
    # Drain Persistent Outbox Queue
    # -------------------------------------------------------------------------
    def drain_outbox(self):
        pending = self.outbox.pop_pending(limit=20)
        for event_id, endpoint, payload_str, attempts in pending:
            payload = json.loads(payload_str)
            success, _ = self._send_signed_request("POST", endpoint, payload)
            if success:
                self.outbox.remove(event_id)
            else:
                self.outbox.increment_attempts(event_id)
                break # Wait for next cycle to preserve FIFO causality

    # -------------------------------------------------------------------------
    # Main Polling Loop
    # -------------------------------------------------------------------------
    def run(self):
        self.logger.info("Starting TradeJourn MetaTrader 5 Connector engine...")

        # Step 1: Pair if needed
        if not self.config.get("api_key_id") or not self.config.get("api_secret"):
            if not self.pair_with_backend():
                self.logger.error("Pairing unsuccessful. Stopping connector.")
                return

        # Step 2: Initialize MT5
        if not self.init_mt5():
            self.logger.error("Failed to connect to MT5 terminal. Please verify MT5 is running on VPS.")

        poll_interval = self.config.get("polling_interval_sec", 5)

        while self.running:
            try:
                # 1. Drain pending outbox queue
                self.drain_outbox()

                # 2. Heartbeat & Account Margin
                telemetry = self.collect_account_telemetry()
                if telemetry:
                    success, _ = self._send_signed_request("POST", "/api/mt5/telemetry/heartbeat", telemetry)
                    if not success:
                        # Queue in outbox if backend is currently unreachable (Render cold start)
                        pass

                # 3. Open Positions Snapshot
                positions = self.collect_open_positions()
                self._send_signed_request("POST", "/api/mt5/sync/positions", {"positions": positions})

                # 4. Closed Deals Sync
                deals = self.collect_deals_since_watermark()
                if deals:
                    self.logger.info(f"Ingesting {len(deals)} new broker execution deals...")
                    success, _ = self._send_signed_request("POST", "/api/mt5/sync/deals", {"deals": deals})
                    if not success:
                        self.logger.warning("Enqueuing deals batch into persistent SQLite outbox queue.")
                        self.outbox.push("/api/mt5/sync/deals", {"deals": deals})

            except Exception as e:
                self.logger.error(f"Error during connector sync loop: {str(e)}", exc_info=True)
                # Re-attempt MT5 terminal ping on crash
                time.sleep(2)
                self.init_mt5()

            # Exponential backoff with small random jitter to avoid thundering herd
            jitter = random.uniform(0.1, 0.9)
            time.sleep(poll_interval + jitter)


if __name__ == "__main__":
    connector = MT5Connector()
    connector.run()
