"""Regras de alarme (provedor + métrica + limiar) e disparo edge-triggered de push."""

from __future__ import annotations

from typing import Any

from app.schemas import AlarmMetric
from app.store import load

# (chave, label, kind) por provedor — só os campos que a API real preenche
# (ver USAGE_EXAMPLE em schemas.py). kind "percent": dispara quando valor >= limiar.
# kind "cents": dispara quando valor <= limiar (saldo baixo).
METRICS: dict[str, list[tuple[str, str, str]]] = {
    "claude": [
        ("session_percent", "Sessão 5h", "percent"),
        ("weekly_percent", "Semana", "percent"),
        ("sonnet_percent", "Sonnet (semana)", "percent"),
        ("opus_percent", "Opus (semana)", "percent"),
    ],
    "gpt": [
        ("session_percent", "Sessão", "percent"),
        ("weekly_percent", "Semana", "percent"),
    ],
    "cursor": [
        ("percent", "Uso do plano", "percent"),
        ("other_percent", "Outros modelos", "percent"),
        ("remaining_cents", "Saldo restante", "cents"),
    ],
    "openrouter": [
        ("percent", "Uso", "percent"),
        ("remaining_cents", "Saldo restante", "cents"),
    ],
    "deepseek": [
        ("percent", "Uso", "percent"),
        ("remaining_cents", "Saldo restante", "cents"),
    ],
    "opencode": [
        ("rolling_percent", "Rolling", "percent"),
        ("weekly_percent", "Semana", "percent"),
        ("monthly_percent", "Mês", "percent"),
        ("percent", "Uso", "percent"),
        ("remaining_cents", "Saldo Zen", "cents"),
    ],
    "fal": [
        ("remaining_cents", "Saldo restante", "cents"),
    ],
    "bitcoin": [
        ("value_usd_cents", "Valor em USD", "cents"),
    ],
    "adsense": [
        ("unpaid_cents", "Carteira", "cents"),
    ],
}


def catalog_public() -> dict[str, list[AlarmMetric]]:
    return {
        provider: [AlarmMetric(key=key, label=label, kind=kind) for key, label, kind in fields]
        for provider, fields in METRICS.items()
    }


PROVIDER_NAMES: dict[str, str] = {
    "claude": "Claude",
    "gpt": "GPT",
    "cursor": "Cursor",
    "openrouter": "OpenRouter",
    "deepseek": "DeepSeek",
    "opencode": "OpenCode",
    "fal": "fal.ai",
    "bitcoin": "Bitcoin",
    "adsense": "AdSense",
}


def metric_kind(provider: str, metric: str) -> str | None:
    for key, _label, kind in METRICS.get(provider, []):
        if key == metric:
            return kind
    return None


def metric_label(provider: str, metric: str) -> str | None:
    for key, label, _kind in METRICS.get(provider, []):
        if key == metric:
            return label
    return None


def _fired(kind: str, value: float, threshold: float) -> bool:
    return value >= threshold if kind == "percent" else value <= threshold


def evaluate(payload: dict[str, Any], rules: list[dict[str, Any]], armed: dict[str, bool]) -> list[dict[str, Any]]:
    """Lógica pura: cruza `payload` (formato de UsagePayload) com `rules`, atualiza `armed`
    in-place e retorna os eventos de disparo (transição não-armado -> armado)."""
    events: list[dict[str, Any]] = []
    for rule in rules:
        if not rule.get("enabled", True):
            continue
        provider = rule["provider"]
        kind = metric_kind(provider, rule["metric"])
        if kind is None:
            continue
        for account in payload.get(provider) or []:
            if not isinstance(account, dict) or not account.get("ok", True):
                continue
            account_id = str(account.get("id") or "")
            wanted = rule.get("account_id", "*")
            if wanted not in ("*", account_id):
                continue
            value = account.get(rule["metric"])
            if value is None:
                continue
            state_key = f"{rule['id']}:{account_id}"
            fired = _fired(kind, float(value), float(rule["threshold"]))
            was_armed = armed.get(state_key, False)
            if fired and not was_armed:
                events.append(
                    {
                        "rule": rule,
                        "provider": provider,
                        "account_id": account_id,
                        "account_label": account.get("label") or "",
                        "value": value,
                    }
                )
            armed[state_key] = fired
    return events


def _event_message(event: dict[str, Any]) -> tuple[str, str]:
    """Título curto = provedor + métrica; corpo = só o limite cruzado.

    O nome (auto-sugerido ou digitado pela regra) é ótimo pra lista na UI, mas
    é longo demais pra caber numa notificação do sistema sem cortar — por
    isso o título do push é sempre reconstruído a partir do catálogo.
    """
    rule = event["rule"]
    provider = event["provider"]
    kind = metric_kind(provider, rule["metric"]) or "percent"
    provider_name = PROVIDER_NAMES.get(provider, provider)
    metric_name = metric_label(provider, rule["metric"]) or rule["metric"]
    title = f"{provider_name} · {metric_name}"
    if kind == "percent":
        body = f"Uso chegou a {event['value']:.0f}% (limiar {rule['threshold']:.0f}%)"
    else:
        body = f"Saldo em ${event['value'] / 100:.2f} (limiar ${rule['threshold'] / 100:.2f})"
    return title, body


class AlarmEngine:
    """Um por processo — guarda o estado "armado" de cada regra em memória."""

    def __init__(self) -> None:
        self._armed: dict[str, bool] = {}

    def handle_payload(self, payload: dict[str, Any]) -> None:
        cfg = load()
        rules = cfg.get("alarms") or []
        if not rules:
            return
        events = evaluate(payload, rules, self._armed)
        if not events:
            return
        from app import push  # import tardio: evita ciclo hub -> alarms -> push -> store

        for event in events:
            title, body = _event_message(event)
            try:
                push.broadcast(title, body, tag=f"alarm-{event['rule']['id']}")
            except Exception as exc:  # noqa: BLE001
                print(f"[alarms] falha ao enviar push: {exc}")
