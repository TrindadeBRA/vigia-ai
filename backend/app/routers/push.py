"""Rotas de Web Push: chave pública VAPID e assinaturas do navegador.

Só funciona em contexto seguro (HTTPS ou http://127.0.0.1) — pelo IP da LAN o
navegador bloqueia `pushManager.subscribe()`. Ver docs/NOTIFICACOES.md.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.push import add_subscription, broadcast, get_or_create_vapid, remove_subscription
from app.schemas import OkResult, PushSubscriptionBody, PushUnsubscribeBody, VapidPublicKey

router = APIRouter(prefix="/api/push", tags=["push"])


@router.get(
    "/vapid-public-key",
    response_model=VapidPublicKey,
    summary="Chave pública VAPID (applicationServerKey do navegador)",
)
def vapid_public_key() -> VapidPublicKey:
    public_key, _private_key = get_or_create_vapid()
    return VapidPublicKey(public_key=public_key)


@router.post(
    "/subscribe",
    response_model=OkResult,
    summary="Salva a subscription do navegador",
)
def subscribe(body: PushSubscriptionBody) -> OkResult:
    add_subscription(body.endpoint, body.p256dh, body.auth, body.ua)
    return OkResult(ok=True)


@router.post(
    "/unsubscribe",
    response_model=OkResult,
    summary="Remove a subscription do navegador",
)
def unsubscribe(body: PushUnsubscribeBody) -> OkResult:
    if not body.endpoint:
        return OkResult(ok=False, error="endpoint vazio")
    remove_subscription(body.endpoint)
    return OkResult(ok=True)


@router.post(
    "/test",
    response_model=OkResult,
    summary="Envia uma notificação de teste para todas as assinaturas salvas",
)
def test() -> OkResult:
    sent = broadcast("Vigia AI", "Notificação de teste", tag="test")
    if sent == 0:
        raise HTTPException(400, "nenhuma assinatura de push salva — ative as notificações primeiro")
    return OkResult(ok=True)
