# Contrato JSON — `GET /usage`

O firmware **depende** deste formato. Mudança = atualizar este doc, os modelos em `backend/app/schemas.py` **e** o parser em `firmware/src/net/parse.cpp`.

O JSON viaja em `GET /usage` (uma vez) e em `GET /events` (SSE, `event: usage`). O payload é o mesmo.

`Content-Type` em `/usage`: `application/json; charset=utf-8`. Em `/events`: `text/event-stream` (`event: usage` + `data:` o JSON).

**v2**: cada provedor (`claude`, `gpt`, `cursor`, `openrouter`, `deepseek`, `opencode_go`, `opencode_zen`, `fal`, `bitcoin`, `adsense`) é uma **lista de contas**, não mais um objeto único — suporta N assinaturas do mesmo provedor (ex.: Claude pessoal + Claude da empresa), cada uma com um apelido opcional. Quem tem uma conta só continua vendo exatamente o mesmo card de sempre (lista com 1 item, `label` vazio).

`bitcoin` não é bem uma "conta" (não há login) — cada item da lista é uma **carteira** identificada pelo endereço público colado no painel; ver `bitcoin[i]` abaixo.

`adsense` é uma conta Google (OAuth no coletor) — hoje (estimativa) + saldo não pago; ver `adsense[i]` abaixo.

Percentuais: **0–100** (float). Se a API nativa mandar 0–1, o coletor converte.

Datas: string ISO-8601 (com offset, ex. `-03:00`) ou `null`.

## Exemplo

```json
{
  "updated_at": "2026-08-31T00:10:00-03:00",
  "claude": [
    {
      "id": "local",
      "label": "",
      "ok": true,
      "error": null,
      "session_percent": 42.0,
      "session_resets_at": "2026-08-31T04:00:00-03:00",
      "weekly_percent": 18.5,
      "weekly_resets_at": "2026-09-04T03:00:00-03:00",
      "sonnet_percent": 55.0,
      "sonnet_resets_at": "2026-09-04T03:00:00-03:00",
      "opus_percent": 12.0,
      "opus_resets_at": "2026-09-04T03:00:00-03:00"
    },
    {
      "id": "a1b2c3d4",
      "label": "Assinatura Empresarial (Hubify)",
      "ok": true,
      "error": null,
      "session_percent": 10.0,
      "session_resets_at": "2026-08-31T04:00:00-03:00",
      "weekly_percent": 3.0,
      "weekly_resets_at": "2026-09-04T03:00:00-03:00",
      "sonnet_percent": null,
      "sonnet_resets_at": null,
      "opus_percent": null,
      "opus_resets_at": null
    }
  ],
  "gpt": [
    {
      "id": "local",
      "label": "",
      "ok": true,
      "error": null,
      "session_percent": 12.0,
      "session_resets_at": "2026-08-31T21:00:00-03:00",
      "weekly_percent": 8.0,
      "weekly_resets_at": "2026-09-04T03:00:00-03:00",
      "plan": "plus"
    }
  ],
  "cursor": [
    {
      "id": "local",
      "label": "",
      "ok": true,
      "error": null,
      "percent": 35.0,
      "other_percent": 12.0,
      "used_cents": 700,
      "limit_cents": 2000,
      "remaining_cents": 1300,
      "bonus_cents": 0,
      "cycle_end": "2026-09-15T00:00:00Z",
      "plan": "pro",
      "requests_used": null,
      "requests_limit": null
    }
  ],
  "openrouter": [
    {
      "id": "legacy",
      "label": "",
      "ok": true,
      "error": null,
      "percent": 66.6,
      "limit_cents": 1000,
      "used_cents": 666,
      "remaining_cents": 334
    }
  ],
  "deepseek": [
    {
      "id": "legacy",
      "label": "",
      "ok": true,
      "error": null,
      "percent": 25.0,
      "limit_cents": 1000,
      "used_cents": 250,
      "remaining_cents": 750
    }
  ],
  "opencode_go": [
    {
      "id": "legacy",
      "label": "",
      "ok": true,
      "error": null,
      "rolling_percent": 42.5,
      "rolling_resets_at": "2026-08-31T04:00:00Z",
      "weekly_percent": 18.0,
      "weekly_resets_at": "2026-09-04T03:00:00Z",
      "monthly_percent": 10.5,
      "monthly_resets_at": "2026-09-01T00:00:00Z"
    }
  ],
  "opencode_zen": [
    {
      "id": "legacy",
      "label": "",
      "ok": true,
      "error": null,
      "percent": null,
      "limit_cents": null,
      "used_cents": null,
      "remaining_cents": 1500
    }
  ],
  "fal": [
    {
      "id": "legacy",
      "label": "",
      "ok": true,
      "error": null,
      "percent": null,
      "limit_cents": null,
      "used_cents": null,
      "remaining_cents": 2450
    }
  ],
  "bitcoin": [
    {
      "id": "legacy",
      "label": "",
      "ok": true,
      "error": null,
      "address": "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
      "balance_btc": 0.00123456,
      "price_usd_cents": 6500000,
      "price_brl_cents": 33000000,
      "value_usd_cents": 8025,
      "value_brl_cents": 40740
    }
  ],
  "adsense": [
    {
      "id": "legacy",
      "label": "",
      "ok": true,
      "error": null,
      "currency": "BRL",
      "today_cents": 1234,
      "unpaid_cents": 56789,
      "account_name": "pub-1234"
    }
  ],
  "weather": {
    "ok": true,
    "error": null,
    "updated_at": "2026-08-31T00:10:00-03:00",
    "current": {
      "temperature_2m": 26.5,
      "apparent_temperature": 28.1,
      "relative_humidity_2m": 65,
      "precipitation": 0.0,
      "weather_code": 2,
      "wind_speed_10m": 12.3
    },
    "current_units": {
      "temperature_2m": "°C",
      "wind_speed_10m": "km/h",
      "precipitation": "mm"
    },
    "daily": {
      "temperature_2m_max": [28.5],
      "temperature_2m_min": [18.0]
    },
    "location": {"name": "São Paulo"}
  },
  "currencies": {
    "ok": true,
    "error": null,
    "updated_at": "2026-08-31T00:10:00-03:00",
    "base": "BRL",
    "items": [
      {"id": "usd", "kind": "fiat", "code": "USD", "label": "Dólar americano", "price": 5.18, "ok": true, "error": null},
      {"id": "eur", "kind": "fiat", "code": "EUR", "label": "Euro", "price": 6.00, "ok": true, "error": null},
      {"id": "btc", "kind": "crypto", "code": "bitcoin", "label": "Bitcoin", "price": 398064.00, "ok": true, "error": null},
      {"id": "eth", "kind": "crypto", "code": "ethereum", "label": "Ethereum", "price": 12408.59, "ok": true, "error": null}
    ]
  }
}
```

## Campos

### Raiz

| Campo          | Tipo            | Obrigatório         |
| -------------- | --------------- | ------------------- |
| `updated_at`   | string          | sim                 |
| `claude`       | array de contas | sim (pode ser `[]`) |
| `gpt`          | array de contas | sim (pode ser `[]`) |
| `cursor`       | array de contas | sim (pode ser `[]`) |
| `openrouter`   | array de contas | sim (pode ser `[]`) |
| `deepseek`     | array de contas | sim (pode ser `[]`) |
| `opencode_go`  | array de contas | sim (pode ser `[]`) |
| `opencode_zen` | array de contas | sim (pode ser `[]`) |
| `fal`          | array de contas | sim (pode ser `[]`) |
| `bitcoin`      | array de contas | sim (pode ser `[]`) |
| `adsense`      | array de contas | sim (pode ser `[]`) |
| `weather`      | objeto ou `null` | não — ausente/`null` = desligado ou oculto; ver `weather` abaixo |
| `currencies`   | objeto ou `null` | não — ausente/`null` = desligado ou oculto; ver `currencies` abaixo |

### Campos comuns a toda conta, nos 10 provedores

| Campo   | Tipo             | Notas                                                                                                                                                      |
| ------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`    | string           | Estável entre polls (`"local"` pra conta auto-detectada de Claude/Cursor; string curta gerada pelo coletor pras demais). Não é segredo, só uma chave de UI |
| `label` | string           | Apelido opcional gravado no painel (`""` = sem apelido — mostra só o nome do provedor, igual hoje)                                                         |
| `ok`    | bool             | `false` se não deu para obter cota desta conta                                                                                                             |
| `error` | string ou `null` | Mensagem curta para a tela / curl                                                                                                                          |

Não existe mais um `configured` por conta: uma conta só aparece no array se estiver visível. Provedor "nunca preenchido" ou "oculto no painel" = array vazio `[]` — ver seção abaixo.

### `claude[i]`

| Campo               | Tipo             | Notas                                      |
| ------------------- | ---------------- | ------------------------------------------ |
| `session_percent`   | number ou `null` | Janela ~5 h                                |
| `session_resets_at` | string ou `null` |                                            |
| `weekly_percent`    | number ou `null` | Janela ~7 d (todos os modelos)             |
| `weekly_resets_at`  | string ou `null` |                                            |
| `sonnet_percent`    | number ou `null` | Limite semanal só Sonnet, se o plano tiver |
| `sonnet_resets_at`  | string ou `null` |                                            |
| `opus_percent`      | number ou `null` | Limite semanal só Opus, se o plano tiver   |
| `opus_resets_at`    | string ou `null` |                                            |

### `gpt[i]`

Cota da assinatura ChatGPT / Codex CLI — ver `APIS_GPT.md`.

| Campo               | Tipo             | Notas                                         |
| ------------------- | ---------------- | --------------------------------------------- |
| `session_percent`   | number ou `null` | Janela curta (~5 h), se o plano tiver         |
| `session_resets_at` | string ou `null` |                                               |
| `weekly_percent`    | number ou `null` | Janela longa (semana, ou ~30 d no plano free) |
| `weekly_resets_at`  | string ou `null` |                                               |
| `plan`              | string ou `null` | Ex.: `plus`, `pro`, `free`                    |

### `cursor[i]`

| Campo             | Tipo             | Notas                                                                                            |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `percent`         | number ou `null` | "Cursor Models" no dashboard (auto), uso do plano no ciclo (0–100)                               |
| `other_percent`   | number ou `null` | "Other Models" no dashboard (api), segunda barra na tela                                         |
| `used_cents`      | number ou `null` | Gasto on-demand em centavos de USD                                                               |
| `limit_cents`     | number ou `null` | Teto on-demand incluso em centavos de USD                                                        |
| `remaining_cents` | number ou `null` | On-demand ainda disponível                                                                       |
| `bonus_cents`     | number ou `null` | Crédito extra, se houver                                                                         |
| `cycle_end`       | string ou `null` | Fim do ciclo de fatura                                                                           |
| `plan`            | string ou `null` | Ex.: `pro`, `ultra` — `null` pra contas extras coladas (o plano só é lido do login local do Mac) |
| `requests_used`   | number ou `null` | Só no fallback legado `auth/usage`                                                               |
| `requests_limit`  | number ou `null` | Só no fallback legado `auth/usage`                                                               |

### `openrouter[i]`

Vem de `/api/v1/credits` — saldo da **conta** dessa key, não da key individual (uma key
recém-criada pode nunca ter sido usada diretamente e ainda assim a conta ter
gasto real feito por outra key/app; ver `APIS_OPENROUTER.md`).

| Campo             | Tipo             | Notas                                                                                                  |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| `percent`         | number ou `null` | `used_cents / limit_cents`; `null` se a conta não tem créditos comprados (`limit_cents` também `null`) |
| `limit_cents`     | number ou `null` | `total_credits` da conta em centavos de USD; `null` = nunca comprou crédito                            |
| `used_cents`      | number ou `null` | `total_usage` da conta (gasto total histórico), em centavos de USD                                     |
| `remaining_cents` | number ou `null` | `limit_cents - used_cents`, em centavos de USD                                                         |

### `deepseek[i]`

Vem de `GET /user/balance` — saldo da conta dessa key; ver `APIS_DEEPSEEK.md`.

| Campo             | Tipo             | Notas                                                                                             |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| `percent`         | number ou `null` | `used_cents / limit_cents`; `null` se a conta nunca recebeu crédito (`limit_cents` também `null`) |
| `limit_cents`     | number ou `null` | `granted_balance + topped_up_balance` da conta em centavos de USD                                 |
| `used_cents`      | number ou `null` | `limit_cents - remaining_cents`                                                                   |
| `remaining_cents` | number ou `null` | `total_balance` da conta em centavos de USD                                                       |

### `opencode_go[i]`

Vem de `GET /zen/go/v1/usage` — assinatura mensal da OpenCode; ver `APIS_OPENCODE_GO.md`.

| Campo               | Tipo             | Notas                                 |
| ------------------- | ---------------- | ------------------------------------- |
| `rolling_percent`   | number ou `null` | Janela curta (~5 h), limite $12       |
| `rolling_resets_at` | string ou `null` |                                       |
| `weekly_percent`    | number ou `null` | Janela semanal (~7 d), limite $30     |
| `weekly_resets_at`  | string ou `null` |                                       |
| `monthly_percent`   | number ou `null` | Janela mensal (1º do mês), limite $60 |
| `monthly_resets_at` | string ou `null` |                                       |

### `opencode_zen[i]`

Vem de um endpoint de saldo da OpenCode — créditos pré-pagos; ver `APIS_OPENCODE_ZEN.md`.

| Campo             | Tipo             | Notas                                                        |
| ----------------- | ---------------- | ------------------------------------------------------------ |
| `percent`         | number ou `null` | `used_cents / limit_cents`; `null` se a API não expõe limite |
| `limit_cents`     | number ou `null` | Teto em centavos de USD; `null` se não houver                |
| `used_cents`      | number ou `null` | Gasto em centavos de USD; `null` se não houver               |
| `remaining_cents` | number ou `null` | Saldo restante em centavos de USD (único campo confiável)    |

### `fal[i]`

Vem de `GET /v1/account/billing` (fal.ai) — créditos pré-pagos; ver `APIS_FAL.md`.

| Campo             | Tipo             | Notas                                                        |
| ----------------- | ---------------- | ------------------------------------------------------------ |
| `percent`         | number ou `null` | Sempre `null` — a API não expõe limite/teto                  |
| `limit_cents`     | number ou `null` | Sempre `null` — a API não expõe teto                          |
| `used_cents`      | number ou `null` | Sempre `null` — a API não expõe gasto acumulado               |
| `remaining_cents` | number ou `null` | `credits.current_balance` × 100 (único campo confiável)       |

### `bitcoin[i]`

Endereço público de carteira colado no painel (não é chave privada) — saldo on-chain via Blockstream Esplora + cotação via CoinGecko; ver `APIS_BITCOIN.md`.

| Campo             | Tipo             | Notas                                                              |
| ------------------ | ---------------- | ------------------------------------------------------------------ |
| `address`          | string ou `null` | Endereço público da carteira consultada                            |
| `balance_btc`      | number ou `null` | Saldo confirmado + mempool, em BTC                                 |
| `price_usd_cents`  | number ou `null` | Cotação do BTC em centavos de USD                                  |
| `price_brl_cents`  | number ou `null` | Cotação do BTC em centavos de BRL                                  |
| `value_usd_cents`  | number ou `null` | `balance_btc × price_usd_cents`, em centavos de USD                |
| `value_brl_cents`  | number ou `null` | `balance_btc × price_brl_cents`, em centavos de BRL                |

### `adsense[i]`

Login Google OAuth no coletor (não vai token no JSON) — ganhos estimados de hoje + saldo não pago; ver `APIS_ADSENSE.md`.

| Campo           | Tipo             | Notas                                                          |
| --------------- | ---------------- | -------------------------------------------------------------- |
| `currency`      | string ou `null` | ISO-4217 da conta (ex.: `BRL`, `USD`)                          |
| `today_cents`   | number ou `null` | Ganhos estimados de hoje, na moeda da conta                    |
| `unpaid_cents`  | number ou `null` | Saldo não pago (`payments/unpaid`), na moeda da conta          |
| `account_name`  | string ou `null` | Nome de exibição da conta AdSense                              |

### `weather`

Previsão Open-Meteo. **Não** é lista de contas: é um objeto único, igual a moedas. `null` ou ausente = item desligado/oculto no painel — o firmware **não desenha o card**. O payload completo (hourly/daily extra) alimenta o mostrador web; a placa lê só o recorte abaixo.

| Campo           | Tipo             | Notas                                                                 |
| --------------- | ---------------- | --------------------------------------------------------------------- |
| `ok`            | bool             | `false` se a busca do Open-Meteo falhou                               |
| `error`         | string ou `null` | Mensagem curta quando `ok` é `false`                                  |
| `updated_at`    | string ou `null` | ISO-8601 do ciclo                                                     |
| `current`       | objeto ou `null` | Condições atuais (`temperature_2m`, `weather_code`, `apparent_temperature`, `relative_humidity_2m`, `wind_speed_10m`, `precipitation`) |
| `current_units` | objeto ou `null` | Unidades dos campos em `current` (ex.: `°C`, `km/h`, `mm`)            |
| `daily`         | objeto ou `null` | A placa usa só o 1º dia de `temperature_2m_max` / `temperature_2m_min` |
| `location`      | objeto ou `null` | `name` vira o sufixo do card (cidade)                                 |

### `currencies`

Cotação de moedas (fiat + cripto) convertidas para uma moeda base. **Não** é lista de contas: é um objeto único, igual ao clima. `null` ou ausente = item desligado/oculto no painel — o firmware **não desenha o card**. Lista vazia (`items: []` e `ok: true`) também some da placa. O firmware guarda no máximo 8 itens (`MAX_CURRENCY_ITEMS`); o resto é ignorado (log serial).

| Campo         | Tipo             | Notas                                                                 |
| ------------- | ---------------- | --------------------------------------------------------------------- |
| `ok`          | bool             | `false` se a busca das cotações falhou por completo                   |
| `error`       | string ou `null` | Mensagem curta quando `ok` é `false`                                  |
| `updated_at`  | string ou `null` | ISO-8601 do ciclo                                                     |
| `base`        | string           | ISO-4217 da moeda em que os preços são mostrados (ex.: `BRL`)         |
| `items`       | array            | Moedas acompanhadas, na ordem do painel                               |

#### `currencies.items[i]`

| Campo   | Tipo             | Notas                                                                                          |
| ------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `id`    | string           | Estável entre polls (gerado pelo coletor)                                                      |
| `kind`  | string           | `"fiat"` (câmbio) ou `"crypto"` (CoinGecko)                                                    |
| `code`  | string           | ISO-4217 (`USD`) ou id CoinGecko (`ethereum`)                                                  |
| `label` | string           | Nome de exibição (`""` = usa `code`)                                                           |
| `price` | number ou `null` | Valor de 1 unidade de `code` em `base`                                                         |
| `ok`    | bool             | `false` se esta cotação falhou (as outras continuam)                                           |
| `error` | string ou `null` | Mensagem curta quando `ok` é `false`                                                           |

## Outros endpoints

| Método | Caminho   | Corpo                                                                                                         |
| ------ | --------- | ------------------------------------------------------------------------------------------------------------- |
| GET    | `/health` | `{"ok":true,"panel_lan":"http://IP:8787/",...}` — `panel_lan` é a URL absoluta do painel na LAN (QR da placa) |
| GET    | `/usage`  | contrato acima — consulta as APIs **na hora** e avisa os clientes SSE                                         |
| GET    | `/events` | `text/event-stream`. `event: usage` + `data:` o mesmo JSON. Comentários `: ping` ~15 s.                       |

A placa e `/display` **escutam** `/events`. O `USAGE_URL` no `secrets.h` continua `http://IP:8787/usage`; o firmware troca o path por `/events`. `GET /usage` permanece para `curl`, o botão “atualizar” e o Swagger.

## Erro parcial

Se uma conta falhar, as outras (do mesmo provedor ou de outros) continuam: `ok=false` só naquela entrada da lista. HTTP **200** sempre. A tela mostra erro só no card daquela conta.

HTTP 5xx só se o processo do coletor quebrar de fato.

## Provedor/conta não configurada (ou oculta)

Uma conta só entra no array se estiver visível — o firmware **não desenha o card** de nenhuma conta que não veio no JSON, em nenhuma tela (Início lista/grade, Agora). Um provedor com array vazio (`[]`) não desenha nenhum card daquele tipo. Origens de "de fora":

1. **Nunca preenchida** — nenhuma credencial local e nenhuma conta extra colada no
   painel (`backend/data/config.json`). OpenRouter, DeepSeek, OpenCode Go, OpenCode Zen, fal.ai, Bitcoin e AdSense somem ao
   apagar a última key/endereço/login. Clima e Moedas somem ao desligar o interruptor ou esvaziar a lista.
2. **Oculta no painel** — a conta **local** de Claude/GPT/Cursor (Keychain/`auth.json`/`state.vscdb`) e
   a **primeira key/endereço** de OpenRouter/DeepSeek/OpenCode Go/OpenCode Zen/fal.ai/Bitcoin (`OPENROUTER_API_KEY`/`DEEPSEEK_API_KEY`/`OPENCODE_GO_API_KEY`/`OPENCODE_ZEN_API_KEY`/`FAL_API_KEY`/`BITCOIN_ADDRESS`)
   e o login AdSense
   têm um interruptor **Mostrar na placa** que grava `CLAUDE_HIDDEN` / `GPT_HIDDEN` / `CURSOR_HIDDEN` /
   `OPENROUTER_HIDDEN` / `DEEPSEEK_HIDDEN` / `OPENCODE_GO_HIDDEN` / `OPENCODE_ZEN_HIDDEN` / `FAL_HIDDEN` / `BITCOIN_HIDDEN` / `ADSENSE_HIDDEN` em `config.json` — a conta some do array
   (sem chamar a API), mas continua salva/logada; só o card some na ESP32. Contas
   extras coladas (`*_ACCOUNTS`) não têm esse interruptor — remover a conta no
   painel é o equivalente a "ocultar". Clima e Moedas usam `weather.hidden` / `currencies.hidden`.

Isso é diferente de `ok=false`: uma conta presente no array que falha
(rede fora do ar, token expirado, rate limit) continua com o card visível,
mostrando o erro — só estar de fora do array remove o card.
