# API Bitcoin (saldo de carteira + cotação)

Consulta o saldo on-chain de um **endereço público** de carteira Bitcoin — não é uma API de conta/login, e o coletor nunca vê nem pede uma chave privada ou seed.

## Endereço

Cole o endereço público da carteira no painel web (persistido em `backend/data/config.json`, gitignored). Aceita os três formatos de endereço mainnet:

- Legacy (P2PKH), começa com `1`
- P2SH, começa com `3`
- Bech32 (SegWit v0/Taproot), começa com `bc1`

A validação (`clean_bitcoin_address`) só confere prefixo/alfabeto/tamanho — não faz checksum completo (Base58Check/Bech32), então um endereço com um caractere trocado ainda pode passar; o pior caso é a consulta de saldo falhar com `ok: false`.

## Saldo on-chain

```
GET https://blockstream.info/api/address/<endereço>
```

Sem autenticação. Resposta:

```json
{
  "address": "bc1q...",
  "chain_stats": { "funded_txo_sum": 123456, "spent_txo_sum": 0, ... },
  "mempool_stats": { "funded_txo_sum": 0, "spent_txo_sum": 0, ... }
}
```

`balance_sat = (chain_stats.funded_txo_sum - chain_stats.spent_txo_sum) + (mempool_stats.funded_txo_sum - mempool_stats.spent_txo_sum)` — inclui transações não confirmadas ainda na mempool. `balance_btc = balance_sat / 100_000_000`.

## Cotação

```
GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,brl
```

Sem autenticação. Resposta:

```json
{ "bitcoin": { "usd": 65000.12, "brl": 330000.55 } }
```

O coletor converte para centavos (`price_usd_cents`, `price_brl_cents`) e multiplica pelo saldo para `value_usd_cents` / `value_brl_cents`.

## Erros parciais

Se o saldo ou a cotação falharem (endereço inválido, rede fora do ar, rate limit de qualquer uma das duas APIs), a conta inteira vira `ok: false` com a mensagem da etapa que falhou — não há "saldo sem cotação" ou vice-versa no JSON.

## O que a tela mostra

Card com duas linhas: saldo em BTC e o valor equivalente em USD/BRL — sem barra de percentual (não existe "limite" pra um saldo de carteira). Mesmo padrão visual do OpenRouter/DeepSeek/fal.ai (saldo em destaque, sem `percent`).
