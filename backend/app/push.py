"""Web Push: chaves VAPID, subscriptions salvas e envio via pywebpush."""

from __future__ import annotations

import base64
import json
import secrets
import time
from typing import Any

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from pywebpush import WebPushException, webpush

from app.store import load, update

VAPID_CLAIMS_SUB = "mailto:vigia@localhost"


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _generate_vapid_keys() -> tuple[str, str]:
    """Gera um par EC P-256 e devolve (public_b64url, private_b64url) — o formato
    cru que py_vapid/pywebpush aceitam como string e que o browser espera em
    `applicationServerKey` (ponto não comprimido, 65 bytes, base64url)."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_raw = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_raw = private_key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return _b64url(public_raw), _b64url(private_raw)


def get_or_create_vapid() -> tuple[str, str]:
    cfg = load()
    push = cfg.get("push") or {}
    public_key = str(push.get("vapid_public_key") or "")
    private_key = str(push.get("vapid_private_key") or "")
    if public_key and private_key:
        return public_key, private_key

    public_key, private_key = _generate_vapid_keys()

    def mut(c: dict[str, Any]) -> None:
        c["push"]["vapid_public_key"] = public_key
        c["push"]["vapid_private_key"] = private_key

    update(mut)
    return public_key, private_key


def add_subscription(endpoint: str, p256dh: str, auth: str, ua: str) -> str:
    cfg = load()
    existing = next((s for s in cfg["push"]["subscriptions"] if s["endpoint"] == endpoint), None)
    sub_id = existing["id"] if existing else secrets.token_hex(4)

    def mut(c: dict[str, Any]) -> None:
        subs = [s for s in c["push"]["subscriptions"] if s["endpoint"] != endpoint]
        subs.append(
            {
                "id": sub_id,
                "endpoint": endpoint,
                "p256dh": p256dh,
                "auth": auth,
                "ua": ua,
                "created_at": str(int(time.time())),
            }
        )
        c["push"]["subscriptions"] = subs

    update(mut)
    return sub_id


def remove_subscription(endpoint: str) -> None:
    def mut(c: dict[str, Any]) -> None:
        c["push"]["subscriptions"] = [s for s in c["push"]["subscriptions"] if s["endpoint"] != endpoint]

    update(mut)


def broadcast(title: str, body: str, tag: str, url: str = "/display") -> int:
    cfg = load()
    subscriptions = list(cfg["push"]["subscriptions"])
    if not subscriptions:
        return 0
    _public_key, private_key = get_or_create_vapid()
    data = json.dumps({"title": title, "body": body, "tag": tag, "url": url})
    sent = 0
    dead: list[str] = []
    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub["endpoint"],
            "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=data,
                vapid_private_key=private_key,
                vapid_claims={"sub": VAPID_CLAIMS_SUB},
            )
            sent += 1
        except WebPushException as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 410):
                dead.append(sub["endpoint"])
            else:
                print(f"[push] falha ao enviar ({status}): {exc}")
    if dead:
        def mut(c: dict[str, Any]) -> None:
            c["push"]["subscriptions"] = [s for s in c["push"]["subscriptions"] if s["endpoint"] not in dead]

        update(mut)
    return sent
