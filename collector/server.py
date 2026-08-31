#!/usr/bin/env python3
"""Coletor de cotas Claude + Cursor. Serve GET /usage para a ESP32."""

from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from shutil import copy2
from claude_oauth import load_claude_oauth

CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
CLAUDE_BETA = "oauth-2025-04-20"
CURSOR_USAGE_URL = (
    "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage"
)
CURSOR_AUTH_USAGE_URL = "https://api2.cursor.sh/auth/usage"

_cache_lock = threading.Lock()
_cache: dict[str, Any] = {"ts": 0.0, "payload": None}
_fx_lock = threading.Lock()
_fx: dict[str, Any] = {"ts": 0.0, "usd_brl": 5.5}


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and val:
            os.environ[key] = val
        elif key and key not in os.environ:
            os.environ[key] = val


BRT = ZoneInfo("America/Sao_Paulo")


def iso_brt(dt: datetime | None = None) -> str:
    if dt is None:
        dt = datetime.now(BRT)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc).astimezone(BRT)
    else:
        dt = dt.astimezone(BRT)
    off = dt.strftime("%z")
    return dt.strftime("%Y-%m-%dT%H:%M:%S") + f"{off[:3]}:{off[3:]}"


def tela_brt(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(BRT).strftime("%d/%m %Hh%M")


def utc_now() -> str:
    return iso_brt()


def as_percent(value: Any) -> float | None:
    if value is None:
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n < 0:
        n = 0.0
    if 0 <= n <= 1.5:
        n = n * 100.0
    if n > 100:
        n = 100.0
    return round(n, 1)


def iso_or_none(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        if s.isdigit():
            value = int(s)
        elif s.replace(".", "", 1).isdigit():
            value = float(s)
        else:
            try:
                raw = s.replace("Z", "+00:00")
                return tela_brt(datetime.fromisoformat(raw))
            except ValueError:
                if "/" in s:
                    return s
                return s
    if isinstance(value, (int, float)) and value > 1e11:
        return tela_brt(datetime.fromtimestamp(value / 1000.0, tz=timezone.utc))
    if isinstance(value, (int, float)) and value > 1e9:
        return tela_brt(datetime.fromtimestamp(float(value), tz=timezone.utc))
    s = str(value).strip()
    return s or None


def money_cents(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return int(round(n))


def http_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    timeout: float = 20.0,
) -> Any:
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"HTTP {exc.code} {url}: {err_body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"rede {url}: {exc.reason}") from exc
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSON inválido de {url}: {exc}") from exc


USD_BRL_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL"


def usd_brl_rate() -> float:
    env = (os.environ.get("USD_BRL") or "").strip()
    if env:
        try:
            n = float(env.replace(",", "."))
            if n > 0:
                return n
        except ValueError:
            pass
    now = time.time()
    with _fx_lock:
        if now - float(_fx["ts"]) < 3600 and float(_fx["usd_brl"]) > 0:
            return float(_fx["usd_brl"])
    try:
        data = http_json(USD_BRL_URL, timeout=8.0)
        bid = float((data.get("USDBRL") or {}).get("bid"))
        if bid <= 0:
            raise RuntimeError("cotacao vazia")
        with _fx_lock:
            _fx["ts"] = now
            _fx["usd_brl"] = bid
        print(f"USD/BRL {bid:.4f}")
        return bid
    except Exception as exc:  # noqa: BLE001
        with _fx_lock:
            fallback = float(_fx["usd_brl"] or 5.5)
        print(f"USD/BRL fallback {fallback:.4f} ({exc})")
        return fallback


def cursor_values_brl(cursor: dict[str, Any]) -> dict[str, Any]:
    out = dict(cursor)
    rate = usd_brl_rate()
    for key in ("used_cents", "limit_cents", "bonus_cents"):
        if out.get(key) is not None:
            out[key] = int(round(int(out[key]) * rate))
    out["currency"] = "BRL"
    return out


def claude_token_and_expiry() -> tuple[str | None, int | None, str | None]:
    return load_claude_oauth()


def parse_claude_payload(data: dict[str, Any]) -> dict[str, Any]:
    session_pct = session_reset = weekly_pct = weekly_reset = None

    five = data.get("five_hour") or data.get("fiveHour") or {}
    seven = data.get("seven_day") or data.get("sevenDay") or {}
    if isinstance(five, dict):
        session_pct = as_percent(five.get("utilization") or five.get("percent"))
        session_reset = iso_or_none(five.get("resets_at") or five.get("resetsAt"))
    if isinstance(seven, dict):
        weekly_pct = as_percent(seven.get("utilization") or seven.get("percent"))
        weekly_reset = iso_or_none(seven.get("resets_at") or seven.get("resetsAt"))

    limits = data.get("limits")
    if isinstance(limits, list):
        for item in limits:
            if not isinstance(item, dict):
                continue
            kind = str(item.get("kind") or "").lower()
            pct = as_percent(item.get("percent") or item.get("utilization"))
            reset = iso_or_none(item.get("resets_at") or item.get("resetsAt"))
            if kind in ("session", "five_hour", "5h") and session_pct is None:
                session_pct, session_reset = pct, reset
            if kind in ("weekly_all", "seven_day", "weekly", "7d") and weekly_pct is None:
                weekly_pct, weekly_reset = pct, reset

    return {
        "ok": session_pct is not None or weekly_pct is not None,
        "error": None
        if (session_pct is not None or weekly_pct is not None)
        else "resposta Claude sem janelas de cota",
        "session_percent": session_pct,
        "session_resets_at": session_reset,
        "weekly_percent": weekly_pct,
        "weekly_resets_at": weekly_reset,
    }


def fetch_claude() -> dict[str, Any]:
    token, exp_ms, err = claude_token_and_expiry()
    if err:
        return _claude_fail(err)
    if exp_ms and exp_ms < int(time.time() * 1000):
        return _claude_fail("OAuth expirado; abra o Claude Code neste Mac")
    if not token:
        return _claude_fail("sem token Claude")
    data = http_json(
        CLAUDE_USAGE_URL,
        headers={
            "Authorization": f"Bearer {token}",
            "anthropic-beta": CLAUDE_BETA,
            "Accept": "application/json",
        },
    )
    if not isinstance(data, dict):
        return _claude_fail("resposta Claude inesperada")
    parsed = parse_claude_payload(data)
    return parsed


def _claude_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "session_percent": None,
        "session_resets_at": None,
        "weekly_percent": None,
        "weekly_resets_at": None,
    }


def cursor_state_db_path() -> Path:
    override = os.environ.get("CURSOR_STATE_DB", "").strip()
    if override:
        return Path(override).expanduser()
    home = Path.home()
    candidates = [
        home / "Library/Application Support/Cursor/User/globalStorage/state.vscdb",
        home / ".config/Cursor/User/globalStorage/state.vscdb",
    ]
    appdata = os.environ.get("APPDATA")
    if appdata:
        candidates.append(Path(appdata) / "Cursor/User/globalStorage/state.vscdb")
    for p in candidates:
        if p.is_file():
            return p
    return candidates[0]


def read_cursor_item(db_path: Path, key: str) -> str | None:
    if not db_path.is_file():
        return None
    fd, tmp = tempfile.mkstemp(suffix=".vscdb")
    os.close(fd)
    try:
        copy2(db_path, tmp)
        con = sqlite3.connect(tmp)
        try:
            row = con.execute(
                "SELECT value FROM ItemTable WHERE key = ?", (key,)
            ).fetchone()
        finally:
            con.close()
    except sqlite3.Error:
        return None
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    if not row or row[0] is None:
        return None
    val = row[0]
    if isinstance(val, bytes):
        val = val.decode("utf-8", errors="replace")
    s = str(val).strip().strip('"')
    return s or None


def cursor_token_and_plan() -> tuple[str | None, str | None, str | None]:
    env_tok = os.environ.get("CURSOR_ACCESS_TOKEN", "").strip()
    db = cursor_state_db_path()
    if env_tok:
        plan = read_cursor_item(db, "cursorAuth/stripeMembershipType")
        return env_tok, plan, None
    token = read_cursor_item(db, "cursorAuth/accessToken")
    plan = read_cursor_item(db, "cursorAuth/stripeMembershipType")
    if not token:
        return None, None, f"sem JWT Cursor (abra o Cursor neste Mac): {db}"
    return token, plan, None


def parse_cursor_dashboard(data: dict[str, Any], plan: str | None) -> dict[str, Any] | None:
    usage = data.get("planUsage") or data.get("plan_usage") or {}
    if not isinstance(usage, dict):
        usage = {}
    percent = as_percent(
        usage.get("totalPercentUsed")
        or usage.get("autoPercentUsed")
        or usage.get("includedPercentUsed")
    )
    included = money_cents(usage.get("includedSpend"))
    limit = money_cents(usage.get("limit") or usage.get("includedLimit"))
    bonus = money_cents(usage.get("bonusSpend"))
    total = money_cents(usage.get("totalSpend"))
    used_cents = included if included is not None else total
    cycle_end = iso_or_none(
        data.get("billingCycleEnd") or data.get("billing_cycle_end") or usage.get("endDate")
    )
    if percent is None and used_cents is not None and limit:
        percent = as_percent((used_cents / limit) * 100.0)
    if percent is None and used_cents is None and not cycle_end and not usage:
        return None
    return {
        "ok": percent is not None or used_cents is not None,
        "error": None
        if (percent is not None or used_cents is not None)
        else "planUsage sem números",
        "percent": percent,
        "used_cents": used_cents,
        "limit_cents": limit,
        "bonus_cents": bonus,
        "cycle_end": cycle_end,
        "plan": (plan or data.get("membershipType") or "").strip() or None,
    }


def parse_cursor_auth_usage(data: dict[str, Any], plan: str | None) -> dict[str, Any]:
    # Formato legado: { "gpt-4": { "numRequests": n, "maxRequestUsage": m }, ... }
    best_pct = None
    used = limit = None
    if isinstance(data, dict):
        for _key, bucket in data.items():
            if not isinstance(bucket, dict):
                continue
            n = bucket.get("numRequests")
            m = bucket.get("maxRequestUsage") or bucket.get("maxRequests")
            try:
                n_i, m_i = int(n), int(m) if m is not None else 0
            except (TypeError, ValueError):
                continue
            if m_i <= 0:
                continue
            pct = as_percent((n_i / m_i) * 100.0)
            if best_pct is None or (pct is not None and pct > best_pct):
                best_pct, used, limit = pct, n_i, m_i
    ok = best_pct is not None
    return {
        "ok": ok,
        "error": None if ok else "auth/usage sem buckets",
        "percent": best_pct,
        "used_cents": None,
        "limit_cents": None,
        "bonus_cents": None,
        "cycle_end": None,
        "plan": plan,
        "requests_used": used,
        "requests_limit": limit,
    }


def _cursor_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "percent": None,
        "used_cents": None,
        "limit_cents": None,
        "bonus_cents": None,
        "cycle_end": None,
        "plan": None,
    }


def fetch_cursor() -> dict[str, Any]:
    token, plan, err = cursor_token_and_plan()
    if err:
        return _cursor_fail(err)
    assert token
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
        "Accept": "application/json",
    }
    dash_err = "GetCurrentPeriodUsage vazio"
    try:
        data = http_json(
            CURSOR_USAGE_URL,
            method="POST",
            headers=headers,
            body=b"{}",
        )
        if isinstance(data, dict):
            parsed = parse_cursor_dashboard(data, plan)
            if parsed and parsed.get("ok"):
                return parsed
            if parsed and parsed.get("error"):
                dash_err = str(parsed["error"])
    except RuntimeError as exc:
        dash_err = str(exc)

    try:
        data = http_json(
            CURSOR_AUTH_USAGE_URL,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        )
        if isinstance(data, dict):
            parsed = parse_cursor_auth_usage(data, plan)
            if parsed.get("ok"):
                return parsed
            return _cursor_fail(f"{dash_err}; {parsed.get('error')}")
    except RuntimeError as exc:
        return _cursor_fail(f"{dash_err}; fallback: {exc}")
    return _cursor_fail(dash_err)


def mock_payload() -> dict[str, Any]:
    return {
        "updated_at": utc_now(),
        "claude": {
            "ok": True,
            "error": None,
            "session_percent": 42.0,
            "session_resets_at": utc_now(),
            "weekly_percent": 18.0,
            "weekly_resets_at": utc_now(),
        },
        "cursor": {
            "ok": True,
            "error": None,
            "percent": 35.0,
            "used_cents": 700,
            "limit_cents": 2000,
            "bonus_cents": 0,
            "cycle_end": utc_now(),
            "plan": "pro",
        },
    }


def build_payload() -> dict[str, Any]:
    if os.environ.get("COLLECTOR_MOCK", "").strip() in ("1", "true", "yes"):
        payload = mock_payload()
        payload["cursor"] = cursor_values_brl(payload["cursor"])
        return payload
    claude: dict[str, Any]
    cursor: dict[str, Any]
    try:
        claude = fetch_claude()
    except Exception as exc:  # noqa: BLE001 — isolar provedor
        claude = _claude_fail(str(exc))
    try:
        cursor = fetch_cursor()
    except Exception as exc:  # noqa: BLE001
        cursor = _cursor_fail(str(exc))
    return {"updated_at": utc_now(), "claude": claude, "cursor": cursor_values_brl(cursor)}


def cached_payload() -> dict[str, Any]:
    ttl = float(os.environ.get("CACHE_TTL_SECONDS") or 300)
    now = time.time()
    with _cache_lock:
        if _cache["payload"] is not None and now - _cache["ts"] < ttl:
            return _cache["payload"]
        payload = build_payload()
        _cache["ts"] = now
        _cache["payload"] = payload
        return payload


class Handler(BaseHTTPRequestHandler):
    # HTTP/1.0 + Connection: close — o HTTPClient da ESP32 (Wokwi) abre TCP e
    # às vezes reseta keep-alive 1.1 antes de ler o body.
    protocol_version = "HTTP/1.0"
    timeout = 20

    def handle(self) -> None:
        try:
            super().handle()
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, TimeoutError):
            return

    def handle_one_request(self) -> None:
        try:
            super().handle_one_request()
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, TimeoutError):
            self.close_connection = True

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[{utc_now()}] {self.address_string()} {fmt % args}")

    def _send(self, code: int, obj: Any) -> None:
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Connection", "close")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path in ("/health", "/"):
            self._send(200, {"ok": True})
            return
        if path == "/usage":
            self._send(200, cached_payload())
            return
        self._send(404, {"ok": False, "error": "not found"})


class CollectorServer(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request: Any, client_address: Any) -> None:
        err = sys.exc_info()[1]
        if isinstance(
            err, (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, TimeoutError)
        ):
            return
        super().handle_error(request, client_address)


def main() -> None:
    here = Path(__file__).resolve().parent
    for name in (".env", ".env.claude", ".env.cursor"):
        load_dotenv(here / name)
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT") or 8787)
    print(f"coletor em http://{host}:{port}/usage")
    print(f"repo {_repo_root()}")
    CollectorServer.allow_reuse_address = True
    try:
        httpd = CollectorServer((host, port), Handler)
    except OSError as exc:
        if getattr(exc, "errno", None) == 48:
            print(f"porta {port} ocupada. Feche o outro python3 server.py ou: lsof -nP -iTCP:{port}")
            raise SystemExit(1) from exc
        raise
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nencerrando")
        httpd.server_close()


if __name__ == "__main__":
    main()
