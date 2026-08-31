# Contrato JSON — `GET /usage`

O firmware **depende** deste formato. Mudança = atualizar este doc, os modelos em `backend/app/schemas.py` **e** o parser em `firmware/src/usage_client.cpp`.

O JSON viaja em `GET /usage` (uma vez) e em `GET /events` (SSE, `event: usage`). O payload é o mesmo.

`Content-Type` em `/usage`: `application/json; charset=utf-8`. Em `/events`: `text/event-stream` (`event: usage` + `data:` o JSON).

**v2**: cada provedor (`claude`, `cursor`, `openrouter`, `deepseek`) é uma **lista de contas**, não mais um objeto único — suporta N assinaturas do mesmo provedor (ex.: Claude pessoal + Claude da empresa), cada uma com um apelido opcional. Quem tem uma conta só continua vendo exatamente o mesmo card de sempre (lista com 1 item, `label` vazio).

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
  ]
}
```

## Campos

### Raiz

| Campo | Tipo | Obrigatório |
| --- | --- | --- |
| `updated_at` | string | sim |
| `claude` | array de contas | sim (pode ser `[]`) |
| `cursor` | array de contas | sim (pode ser `[]`) |
| `openrouter` | array de contas | sim (pode ser `[]`) |
| `deepseek` | array de contas | sim (pode ser `[]`) |

### Campos comuns a toda conta, nos 4 provedores

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | string | Estável entre polls (`"local"` pra conta auto-detectada de Claude/Cursor; string curta gerada pelo coletor pras demais). Não é segredo, só uma chave de UI |
| `label` | string | Apelido opcional gravado no painel (`""` = sem apelido — mostra só o nome do provedor, igual hoje) |
| `ok` | bool | `false` se não deu para obter cota desta conta |
| `error` | string ou `null` | Mensagem curta para a tela / curl |

Não existe mais um `configured` por conta: uma conta só aparece no array se estiver visível. Provedor "nunca preenchido" ou "oculto no painel" = array vazio `[]` — ver seção abaixo.

### `claude[i]`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `session_percent` | number ou `null` | Janela ~5 h |
| `session_resets_at` | string ou `null` | |
| `weekly_percent` | number ou `null` | Janela ~7 d (todos os modelos) |
| `weekly_resets_at` | string ou `null` | |
| `sonnet_percent` | number ou `null` | Limite semanal só Sonnet, se o plano tiver |
| `sonnet_resets_at` | string ou `null` | |
| `opus_percent` | number ou `null` | Limite semanal só Opus, se o plano tiver |
| `opus_resets_at` | string ou `null` | |

### `cursor[i]`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `percent` | number ou `null` | "Cursor Models" no dashboard (auto), uso do plano no ciclo (0–100) |
| `other_percent` | number ou `null` | "Other Models" no dashboard (api), segunda barra na tela |
| `used_cents` | number ou `null` | Gasto on-demand em centavos de USD |
| `limit_cents` | number ou `null` | Teto on-demand incluso em centavos de USD |
| `remaining_cents` | number ou `null` | On-demand ainda disponível |
| `bonus_cents` | number ou `null` | Crédito extra, se houver |
| `cycle_end` | string ou `null` | Fim do ciclo de fatura |
| `plan` | string ou `null` | Ex.: `pro`, `ultra` — `null` pra contas extras coladas (o plano só é lido do login local do Mac) |
| `requests_used` | number ou `null` | Só no fallback legado `auth/usage` |
| `requests_limit` | number ou `null` | Só no fallback legado `auth/usage` |

### `openrouter[i]`

Vem de `/api/v1/credits` — saldo da **conta** dessa key, não da key individual (uma key
recém-criada pode nunca ter sido usada diretamente e ainda assim a conta ter
gasto real feito por outra key/app; ver `docs/APIS_OPENROUTER.md`).

| Campo | Tipo | Notas |
| --- | --- | --- |
| `percent` | number ou `null` | `used_cents / limit_cents`; `null` se a conta não tem créditos comprados (`limit_cents` também `null`) |
| `limit_cents` | number ou `null` | `total_credits` da conta em centavos de USD; `null` = nunca comprou crédito |
| `used_cents` | number ou `null` | `total_usage` da conta (gasto total histórico), em centavos de USD |
| `remaining_cents` | number ou `null` | `limit_cents - used_cents`, em centavos de USD |

### `deepseek[i]`

Vem de `GET /user/balance` — saldo da conta dessa key; ver `docs/APIS_DEEPSEEK.md`.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `percent` | number ou `null` | `used_cents / limit_cents`; `null` se a conta nunca recebeu crédito (`limit_cents` também `null`) |
| `limit_cents` | number ou `null` | `granted_balance + topped_up_balance` da conta em centavos de USD |
| `used_cents` | number ou `null` | `limit_cents - remaining_cents` |
| `remaining_cents` | number ou `null` | `total_balance` da conta em centavos de USD |

## Outros endpoints

| Método | Caminho | Corpo |
| --- | --- | --- |
| GET | `/health` | `{"ok":true}` |
| GET | `/usage` | contrato acima — consulta as APIs **na hora** e avisa os clientes SSE |
| GET | `/events` | `text/event-stream`. `event: usage` + `data:` o mesmo JSON. Comentários `: ping` ~15 s. |

A placa e `/display` **escutam** `/events`. O `USAGE_URL` no `secrets.h` continua `http://IP:8787/usage`; o firmware troca o path por `/events`. `GET /usage` permanece para `curl`, o botão “atualizar” e o Swagger.

## Erro parcial

Se uma conta falhar, as outras (do mesmo provedor ou de outros) continuam: `ok=false` só naquela entrada da lista. HTTP **200** sempre. A tela mostra erro só no card daquela conta.

HTTP 5xx só se o processo do coletor quebrar de fato.

## Provedor/conta não configurada (ou oculta)

Uma conta só entra no array se estiver visível — o firmware **não desenha o card** de nenhuma conta que não veio no JSON, em nenhuma tela (Início lista/grade, Agora). Um provedor com array vazio (`[]`) não desenha nenhum card daquele tipo. Origens de "de fora":

1. **Nunca preenchida** — nenhuma credencial local e nenhuma conta extra colada no
   painel (`collector/data/config.json`). OpenRouter e DeepSeek somem ao
   apagar a última key.
2. **Oculta no painel** — a conta **local** de Claude/Cursor (Keychain/`state.vscdb`) e
   a **primeira key** de OpenRouter/DeepSeek (`OPENROUTER_API_KEY`/`DEEPSEEK_API_KEY`)
   têm um interruptor **Mostrar na placa** que grava `CLAUDE_HIDDEN` / `CURSOR_HIDDEN` /
   `OPENROUTER_HIDDEN` / `DEEPSEEK_HIDDEN` em `config.json` — a conta some do array
   (sem chamar a API), mas continua salva/logada; só o card some na ESP32. Contas
   extras coladas (`*_ACCOUNTS`) não têm esse interruptor — remover a conta no
   painel é o equivalente a "ocultar".

Isso é diferente de `ok=false`: uma conta presente no array que falha
(rede fora do ar, token expirado, rate limit) continua com o card visível,
mostrando o erro — só estar de fora do array remove o card.
