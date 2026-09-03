"""Rotas de alarmes: regra = provedor + métrica + limiar (edge-triggered, ver app/alarms.py)."""

from __future__ import annotations

import secrets
from typing import Any

from fastapi import APIRouter, HTTPException

from app.alarms import catalog_public, metric_kind
from app.schemas import AlarmRule, AlarmRuleBody, AlarmRulePatch, AlarmsPublic, OkResult
from app.store import load, update

router = APIRouter(prefix="/api/alarms", tags=["alarms"])


@router.get(
    "",
    response_model=AlarmsPublic,
    summary="Lista as regras salvas e o catálogo de métricas por provedor",
)
def list_alarms() -> AlarmsPublic:
    cfg = load()
    return AlarmsPublic(rules=[AlarmRule(**r) for r in cfg.get("alarms") or []], metrics=catalog_public())


@router.post(
    "",
    response_model=AlarmRule,
    summary="Cria uma regra de alarme",
    description="Dispara notificação no Telegram quando a métrica cruza o limiar (>= para percentuais, <= para saldo em centavos).",
)
def create_alarm(body: AlarmRuleBody) -> AlarmRule:
    if metric_kind(body.provider, body.metric) is None:
        raise HTTPException(400, f"métrica '{body.metric}' inválida para o provedor '{body.provider}'")
    rule = AlarmRule(
        id=secrets.token_hex(4),
        provider=body.provider,
        metric=body.metric,
        threshold=body.threshold,
        enabled=body.enabled,
        label=body.label,
    )

    def mut(cfg: dict[str, Any]) -> None:
        cfg["alarms"].append(rule.model_dump())

    update(mut)
    return rule


@router.patch(
    "/{rule_id}",
    response_model=OkResult,
    summary="Atualiza limiar, label ou enabled de uma regra",
)
def patch_alarm(rule_id: str, body: AlarmRulePatch) -> OkResult:
    cfg = load()
    if not any(r["id"] == rule_id for r in cfg.get("alarms") or []):
        raise HTTPException(404, "regra não encontrada")

    def mut(c: dict[str, Any]) -> None:
        for rule in c["alarms"]:
            if rule["id"] != rule_id:
                continue
            if body.threshold is not None:
                rule["threshold"] = body.threshold
            if body.enabled is not None:
                rule["enabled"] = body.enabled
            if body.label is not None:
                rule["label"] = body.label

    update(mut)
    return OkResult(ok=True)


@router.delete(
    "/{rule_id}",
    response_model=OkResult,
    summary="Remove uma regra de alarme",
)
def delete_alarm(rule_id: str) -> OkResult:
    def mut(c: dict[str, Any]) -> None:
        c["alarms"] = [r for r in c["alarms"] if r["id"] != rule_id]

    update(mut)
    return OkResult(ok=True)
