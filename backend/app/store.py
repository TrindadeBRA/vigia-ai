"""Persistência JSON aninhada (`version: 1`) + migração do saco de chaves antigo."""

from __future__ import annotations

import json
import os
import re
import threading
from copy import deepcopy
from pathlib import Path
from typing import Any

from app.config import config_path, data_dir

_LOCK = threading.Lock()

PROVIDERS = ("claude", "gpt", "cursor", "openrouter", "deepseek", "opencode", "fal", "bitcoin")

_EMPTY_PROVIDER: dict[str, Any] = {
    "hidden": False,
    "local_label": "",
    "paste_secret": "",
    "accounts": [],
}

_WEATHER_DEFAULT: dict[str, Any] = {
    "enabled": False,
    "hidden": False,
    "location": {
        "name": "",
        "latitude": None,
        "longitude": None,
        "country": "",
        "country_code": "",
        "timezone": "auto",
        "elevation": None,
    },
    "units": {
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
    },
    "forecast_days": 7,
    "past_days": 0,
    "timezone": "auto",
    "current": [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "weather_code",
        "wind_speed_10m",
        "precipitation",
    ],
    "hourly": [
        "temperature_2m",
        "precipitation_probability",
        "weather_code",
        "wind_speed_10m",
    ],
    "daily": [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "precipitation_probability_max",
        "wind_speed_10m_max",
        "sunrise",
        "sunset",
        "uv_index_max",
    ],
    "display": {
        "show_current": True,
        "show_hourly": True,
        "show_daily": True,
        "hourly_count": 12,
        "daily_count": 7,
        "fields": {
            "temperature": True,
            "feels_like": True,
            "humidity": True,
            "precipitation": True,
            "wind": True,
            "pressure": True,
            "cloud_cover": True,
            "uv_index": True,
            "sunrise_sunset": True,
        },
    },
}


_CURRENCIES_DEFAULT: dict[str, Any] = {
    "enabled": False,
    "hidden": False,
    "base": "BRL",
    "items": [],
}


_WALLPAPER_PROVIDERS_DEFAULT: dict[str, Any] = {
    "pexels_key": "",
    "unsplash_key": "",
    "wallhaven_key": "",
}

_SLIDESHOW_DEFAULT: dict[str, Any] = {
    "enabled": False,
    "interval": 5,
    "order": [],
}


def default_config() -> dict[str, Any]:
    return {
        "version": 1,
        "listen": {"host": "0.0.0.0", "port": 8787},
        "mock": False,
        "paths": {"claude_credentials": "", "cursor_state_db": "", "codex_auth": ""},
        "providers": {name: deepcopy(_EMPTY_PROVIDER) for name in PROVIDERS},
        "push": {"vapid_public_key": "", "vapid_private_key": "", "subscriptions": []},
        "alarms": [],
        "weather": deepcopy(_WEATHER_DEFAULT),
        "currencies": deepcopy(_CURRENCIES_DEFAULT),
        "wallpapers": {
            "providers": deepcopy(_WALLPAPER_PROVIDERS_DEFAULT),
            "slideshow": deepcopy(_SLIDESHOW_DEFAULT),
        },
    }


def _empty_provider() -> dict[str, Any]:
    return deepcopy(_EMPTY_PROVIDER)


def _parse_accounts_blob(raw: Any, secret_field: str) -> list[dict[str, str]]:
    if not raw:
        return []
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return []
    else:
        parsed = raw
    if not isinstance(parsed, list):
        return []
    out: list[dict[str, str]] = []
    for item in parsed:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        secret = str(item.get(secret_field) or item.get("secret") or item.get("token") or item.get("key") or "")
        if not secret:
            continue
        out.append(
            {
                "id": str(item["id"]),
                "label": str(item.get("label") or ""),
                "secret": secret,
            }
        )
    return out


def _flag(raw: Any) -> bool:
    return str(raw or "").strip().lower() in ("1", "true", "yes")


def _parse_subscriptions(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        endpoint = str(item.get("endpoint") or "")
        p256dh = str(item.get("p256dh") or "")
        auth = str(item.get("auth") or "")
        if not endpoint or not p256dh or not auth:
            continue
        out.append(
            {
                "id": str(item.get("id") or ""),
                "endpoint": endpoint,
                "p256dh": p256dh,
                "auth": auth,
                "ua": str(item.get("ua") or ""),
                "created_at": str(item.get("created_at") or ""),
            }
        )
    return out


def _parse_alarms(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict) or not item.get("id") or not item.get("provider") or not item.get("metric"):
            continue
        try:
            threshold = float(item.get("threshold"))
        except (TypeError, ValueError):
            continue
        out.append(
            {
                "id": str(item["id"]),
                "provider": str(item["provider"]),
                "account_id": str(item.get("account_id") or "*"),
                "metric": str(item["metric"]),
                "threshold": threshold,
                "enabled": bool(item.get("enabled", True)),
                "label": str(item.get("label") or ""),
            }
        )
    return out


def migrate_legacy(raw: dict[str, Any]) -> dict[str, Any]:
    """Converte o JSON plano estilo env (`CLAUDE_OAUTH_TOKEN`, …) para `version: 1`."""
    cfg = default_config()
    host = str(raw.get("HOST") or "0.0.0.0").strip() or "0.0.0.0"
    port_s = str(raw.get("PORT") or "8787").strip() or "8787"
    try:
        port = int(port_s)
    except ValueError:
        port = 8787
    cfg["listen"] = {"host": host, "port": port}
    cfg["mock"] = _flag(raw.get("COLLECTOR_MOCK"))
    cfg["paths"]["claude_credentials"] = str(raw.get("CLAUDE_CREDENTIALS_PATH") or "")
    cfg["paths"]["cursor_state_db"] = str(raw.get("CURSOR_STATE_DB") or "")

    claude = cfg["providers"]["claude"]
    claude["hidden"] = _flag(raw.get("CLAUDE_HIDDEN"))
    claude["local_label"] = str(raw.get("CLAUDE_LOCAL_LABEL") or "")
    claude["paste_secret"] = str(raw.get("CLAUDE_OAUTH_TOKEN") or raw.get("CLAUDE_CODE_OAUTH_TOKEN") or "")
    claude["accounts"] = _parse_accounts_blob(raw.get("CLAUDE_ACCOUNTS"), "token")

    gpt = cfg["providers"]["gpt"]
    gpt["hidden"] = _flag(raw.get("GPT_HIDDEN"))
    gpt["local_label"] = str(raw.get("GPT_LOCAL_LABEL") or "")
    gpt["paste_secret"] = str(raw.get("GPT_OAUTH_TOKEN") or raw.get("CODEX_ACCESS_TOKEN") or "")
    gpt["accounts"] = _parse_accounts_blob(raw.get("GPT_ACCOUNTS") or raw.get("CODEX_ACCOUNTS"), "token")

    cursor = cfg["providers"]["cursor"]
    cursor["hidden"] = _flag(raw.get("CURSOR_HIDDEN"))
    cursor["local_label"] = str(raw.get("CURSOR_LOCAL_LABEL") or "")
    cursor["paste_secret"] = str(raw.get("CURSOR_ACCESS_TOKEN") or "")
    cursor["accounts"] = _parse_accounts_blob(raw.get("CURSOR_ACCOUNTS"), "token")

    openrouter = cfg["providers"]["openrouter"]
    openrouter["hidden"] = _flag(raw.get("OPENROUTER_HIDDEN"))
    openrouter["local_label"] = str(raw.get("OPENROUTER_LEGACY_LABEL") or "")
    openrouter["paste_secret"] = str(raw.get("OPENROUTER_API_KEY") or "")
    openrouter["accounts"] = _parse_accounts_blob(raw.get("OPENROUTER_ACCOUNTS"), "key")

    deepseek = cfg["providers"]["deepseek"]
    deepseek["hidden"] = _flag(raw.get("DEEPSEEK_HIDDEN"))
    deepseek["local_label"] = str(raw.get("DEEPSEEK_LEGACY_LABEL") or "")
    deepseek["paste_secret"] = str(raw.get("DEEPSEEK_API_KEY") or "")
    deepseek["accounts"] = _parse_accounts_blob(raw.get("DEEPSEEK_ACCOUNTS"), "key")
    return cfg


def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
    if raw.get("version") != 1 or "providers" not in raw:
        if any(k.startswith("CLAUDE_") or k in ("HOST", "PORT", "COLLECTOR_MOCK") for k in raw):
            return migrate_legacy(raw)
        return default_config()
    cfg = default_config()
    listen = raw.get("listen") if isinstance(raw.get("listen"), dict) else {}
    cfg["listen"]["host"] = str(listen.get("host") or "0.0.0.0")
    try:
        cfg["listen"]["port"] = int(listen.get("port") or 8787)
    except (TypeError, ValueError):
        cfg["listen"]["port"] = 8787
    cfg["mock"] = bool(raw.get("mock"))
    paths = raw.get("paths") if isinstance(raw.get("paths"), dict) else {}
    cfg["paths"]["claude_credentials"] = str(paths.get("claude_credentials") or "")
    cfg["paths"]["cursor_state_db"] = str(paths.get("cursor_state_db") or "")
    cfg["paths"]["codex_auth"] = str(paths.get("codex_auth") or "")
    providers = raw.get("providers") if isinstance(raw.get("providers"), dict) else {}
    for name in PROVIDERS:
        src = providers.get(name) if isinstance(providers.get(name), dict) else {}
        dest = cfg["providers"][name]
        dest["hidden"] = bool(src.get("hidden"))
        dest["local_label"] = str(src.get("local_label") or "")
        dest["paste_secret"] = str(src.get("paste_secret") or "")
        dest["accounts"] = _parse_accounts_blob(src.get("accounts") or [], "secret")
    # Migração: opencode_go/opencode_zen (antigos) → opencode (unificado).
    # Ambos usavam a mesma chave; consolida a primeira chave encontrada.
    if not cfg["providers"]["opencode"]["paste_secret"] and not cfg["providers"]["opencode"]["accounts"]:
        for old in ("opencode_go", "opencode_zen"):
            src = providers.get(old) if isinstance(providers.get(old), dict) else {}
            if not src:
                continue
            dest = cfg["providers"]["opencode"]
            if not dest["paste_secret"]:
                dest["paste_secret"] = str(src.get("paste_secret") or "")
            if not dest["local_label"]:
                dest["local_label"] = str(src.get("local_label") or "")
            dest["hidden"] = dest["hidden"] or bool(src.get("hidden"))
            dest["accounts"] = _parse_accounts_blob(src.get("accounts") or [], "secret")
    push_raw = raw.get("push") if isinstance(raw.get("push"), dict) else {}
    cfg["push"]["vapid_public_key"] = str(push_raw.get("vapid_public_key") or "")
    cfg["push"]["vapid_private_key"] = str(push_raw.get("vapid_private_key") or "")
    cfg["push"]["subscriptions"] = _parse_subscriptions(push_raw.get("subscriptions") or [])
    cfg["alarms"] = _parse_alarms(raw.get("alarms") or [])
    # Weather
    raw_weather = raw.get("weather") if isinstance(raw.get("weather"), dict) else {}
    weather = cfg["weather"]
    weather["enabled"] = bool(raw_weather.get("enabled", weather["enabled"]))
    weather["hidden"] = bool(raw_weather.get("hidden", weather["hidden"]))
    # location
    raw_loc = raw_weather.get("location") if isinstance(raw_weather.get("location"), dict) else {}
    loc = weather["location"]
    loc["name"] = str(raw_loc.get("name") or loc["name"] or "")
    loc["country"] = str(raw_loc.get("country") or loc["country"] or "")
    loc["country_code"] = str(raw_loc.get("country_code") or loc["country_code"] or "")
    loc["timezone"] = str(raw_loc.get("timezone") or loc["timezone"] or "auto")
    try:
        lat = raw_loc.get("latitude")
        loc["latitude"] = float(lat) if lat is not None and str(lat).strip() != "" else None
    except (TypeError, ValueError):
        loc["latitude"] = None
    try:
        lon = raw_loc.get("longitude")
        loc["longitude"] = float(lon) if lon is not None and str(lon).strip() != "" else None
    except (TypeError, ValueError):
        loc["longitude"] = None
    try:
        elev = raw_loc.get("elevation")
        loc["elevation"] = float(elev) if elev is not None and str(elev).strip() != "" else None
    except (TypeError, ValueError):
        loc["elevation"] = None
    # units
    raw_units = raw_weather.get("units") if isinstance(raw_weather.get("units"), dict) else {}
    units = weather["units"]
    for k in ("temperature_unit", "wind_speed_unit", "precipitation_unit"):
        if k in raw_units and isinstance(raw_units[k], str) and raw_units[k].strip():
            units[k] = str(raw_units[k]).strip()
    # forecast_days / past_days / timezone
    try:
        fd = int(raw_weather.get("forecast_days", weather["forecast_days"]))
        weather["forecast_days"] = max(1, min(16, fd))
    except (TypeError, ValueError):
        pass
    try:
        pd = int(raw_weather.get("past_days", weather["past_days"]))
        weather["past_days"] = max(0, min(2, pd))
    except (TypeError, ValueError):
        pass
    if isinstance(raw_weather.get("timezone"), str) and raw_weather["timezone"].strip():
        weather["timezone"] = str(raw_weather["timezone"]).strip()
    # current / hourly / daily arrays
    for key in ("current", "hourly", "daily"):
        raw_list = raw_weather.get(key)
        if isinstance(raw_list, list):
            cleaned = [str(x).strip() for x in raw_list if isinstance(x, str) and str(x).strip()]
            if cleaned:
                weather[key] = cleaned
    # display
    raw_display = raw_weather.get("display") if isinstance(raw_weather.get("display"), dict) else {}
    disp = weather["display"]
    for k in ("show_current", "show_hourly", "show_daily"):
        if k in raw_display:
            disp[k] = bool(raw_display[k])
    for k in ("hourly_count", "daily_count"):
        if k in raw_display:
            try:
                v = int(raw_display[k])
                if k == "hourly_count":
                    disp[k] = max(1, min(48, v))
                else:
                    disp[k] = max(1, min(16, v))
            except (TypeError, ValueError):
                pass
    raw_fields = raw_display.get("fields") if isinstance(raw_display.get("fields"), dict) else {}
    for fk, fv in raw_fields.items():
        if fk in disp["fields"]:
            disp["fields"][fk] = bool(fv)
    # Cotação de moedas (fiat + cripto, lista livre do usuário)
    raw_cur = raw.get("currencies") if isinstance(raw.get("currencies"), dict) else {}
    cur = cfg["currencies"]
    cur["enabled"] = bool(raw_cur.get("enabled", cur["enabled"]))
    cur["hidden"] = bool(raw_cur.get("hidden", cur["hidden"]))
    raw_base = raw_cur.get("base")
    if isinstance(raw_base, str) and re.match(r"^[A-Za-z]{3}$", raw_base.strip()):
        cur["base"] = raw_base.strip().upper()
    raw_items = raw_cur.get("items")
    if isinstance(raw_items, list):
        cleaned_items: list[dict[str, Any]] = []
        for it in raw_items:
            if not isinstance(it, dict) or not it.get("id"):
                continue
            kind = it.get("kind")
            code = str(it.get("code") or "").strip()
            if kind not in ("fiat", "crypto") or not code:
                continue
            cleaned_items.append(
                {
                    "id": str(it["id"]),
                    "kind": kind,
                    "code": code.upper() if kind == "fiat" else code.lower(),
                    "label": str(it.get("label") or ""),
                }
            )
        cur["items"] = cleaned_items
    # Wallpapers / slideshow
    raw_wp = raw.get("wallpapers") if isinstance(raw.get("wallpapers"), dict) else {}
    wp = cfg["wallpapers"]
    raw_prov = raw_wp.get("providers") if isinstance(raw_wp.get("providers"), dict) else {}
    for k in ("pexels_key", "unsplash_key", "wallhaven_key"):
        if k in raw_prov and isinstance(raw_prov[k], str):
            wp["providers"][k] = raw_prov[k].strip()
    raw_sl = raw_wp.get("slideshow") if isinstance(raw_wp.get("slideshow"), dict) else {}
    if "enabled" in raw_sl:
        wp["slideshow"]["enabled"] = bool(raw_sl["enabled"])
    if "interval" in raw_sl:
        try:
            iv = int(raw_sl["interval"])
            wp["slideshow"]["interval"] = max(1, min(120, iv))
        except (TypeError, ValueError):
            pass
    if isinstance(raw_sl.get("order"), list):
        cleaned = [str(x).strip() for x in raw_sl["order"] if isinstance(x, str) and str(x).strip()]
        wp["slideshow"]["order"] = cleaned
    return cfg


def _write(path: Path, cfg: dict[str, Any]) -> None:
    data_dir().mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def load() -> dict[str, Any]:
    path = config_path()
    if not path.is_file():
        return default_config()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default_config()
    if not isinstance(raw, dict):
        return default_config()
    cfg = _normalize(raw)
    if raw.get("version") != 1:
        _write(path, cfg)
    return cfg


def save(cfg: dict[str, Any]) -> dict[str, Any]:
    normalized = _normalize(cfg)
    with _LOCK:
        _write(config_path(), normalized)
    return normalized


def update(mutator: Any) -> dict[str, Any]:
    with _LOCK:
        cfg = load()
        mutator(cfg)
        normalized = _normalize(cfg)
        _write(config_path(), normalized)
        return normalized


def provider(cfg: dict[str, Any], name: str) -> dict[str, Any]:
    return cfg["providers"].get(name) or _empty_provider()
