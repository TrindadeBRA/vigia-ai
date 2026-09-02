"""Rotas de cotação de moedas: fiat (câmbio) + cripto, lista configurável pelo usuário."""

from __future__ import annotations

import secrets
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.providers.currencies import (
    clean_crypto_code,
    clean_fiat_code,
    fetch_currency_quotes,
    mock_currencies_payload,
    search_crypto,
)
from app.schemas import (
    CurrenciesConfig,
    CurrenciesPatch,
    CurrenciesPayload,
    CurrencyItemBody,
    CurrencySearchResponse,
    OkResult,
)
from app.store import load, update

router = APIRouter(prefix="/api/currencies", tags=["currencies"])


def _config_public() -> CurrenciesConfig:
    cfg = load()
    return CurrenciesConfig.model_validate(cfg.get("currencies") or {})


@router.get("/config", response_model=CurrenciesConfig, summary="Configuração de cotação de moedas")
def get_config() -> CurrenciesConfig:
    return _config_public()


@router.patch("/config", response_model=CurrenciesConfig, summary="Atualiza cotação de moedas")
def patch_config(body: CurrenciesPatch) -> CurrenciesConfig:
    base_clean: str | None = None
    if body.base is not None:
        base_clean = clean_fiat_code(body.base)
        if not base_clean:
            raise HTTPException(400, "Moeda base inválida; use um código de 3 letras (ex.: BRL)")

    def mut(cfg: dict[str, Any]) -> None:
        cur = cfg.setdefault("currencies", {})
        if body.enabled is not None:
            cur["enabled"] = body.enabled
        if body.hidden is not None:
            cur["hidden"] = body.hidden
        if base_clean is not None:
            cur["base"] = base_clean

    update(mut)
    return _config_public()


@router.post("/items", response_model=CurrenciesConfig, summary="Adiciona uma moeda à lista")
def add_item(body: CurrencyItemBody) -> CurrenciesConfig:
    if body.kind == "fiat":
        code = clean_fiat_code(body.code)
        if not code:
            raise HTTPException(400, "Código de moeda inválido; use 3 letras (ex.: USD)")
    else:
        code = clean_crypto_code(body.code)
        if not code:
            raise HTTPException(400, "Identificador de criptomoeda inválido; escolha um resultado da busca")
    item_id = secrets.token_hex(4)

    def mut(cfg: dict[str, Any]) -> None:
        cur = cfg.setdefault("currencies", {})
        items = cur.setdefault("items", [])
        items.append({"id": item_id, "kind": body.kind, "code": code, "label": body.label.strip()})
        if not cur.get("enabled"):
            cur["enabled"] = True

    update(mut)
    return _config_public()


@router.delete("/items/{item_id}", response_model=OkResult, summary="Remove uma moeda da lista")
def delete_item(item_id: str) -> OkResult:
    def mut(cfg: dict[str, Any]) -> None:
        cur = cfg.setdefault("currencies", {})
        cur["items"] = [i for i in cur.get("items") or [] if i.get("id") != item_id]

    update(mut)
    return OkResult(ok=True)


@router.get("/search", response_model=CurrencySearchResponse, summary="Busca criptomoedas (proxy CoinGecko)")
def search(q: str = Query(..., min_length=2, description="Nome ou símbolo"), count: int = Query(8, ge=1, le=15)) -> CurrencySearchResponse:
    return CurrencySearchResponse(results=search_crypto(q, count))


@router.get("", response_model=CurrenciesPayload, summary="Cotações atuais (força fetch)")
def get_quotes() -> CurrenciesPayload:
    cfg = load()
    ccfg = cfg.get("currencies") or {}
    if cfg.get("mock") and ccfg.get("enabled"):
        return CurrenciesPayload.model_validate(mock_currencies_payload())
    data = fetch_currency_quotes(ccfg)
    return CurrenciesPayload.model_validate(data)
