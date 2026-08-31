# Contributing

Obrigado por contribuir com o **Vigia AI**.

## Como rodar

```bash
./dev up          # backend :8787 + frontend :5173
./dev down        # encerra o que ficou nessas portas
./dev test
./dev lint
./dev sim         # Wokwi + coletor real
./dev firmware flash
```

Python ≥ 3.11, Node 20+, PlatformIO Core.

## Regras

1. Tokens **nunca** no firmware, no `diagram.json`, na resposta de `GET /usage` nem no git.
2. Mudança no JSON de `/usage` = OpenAPI (`backend/app/schemas.py`) **e** parser em `firmware/src/usage_client.cpp` **e** `docs/CONTRATO_JSON.md`.
3. Falha de uma conta não derruba as outras (`ok: false` só naquela entrada). HTTP 200.
4. Sem cache no coletor, a menos que uma issue peça o contrário.
5. UI e docs em **português (Brasil)**; identificadores de código em inglês.
6. Não adicionar GPT/Gemini/nuvem/MQTT sem uma issue acordada.
7. GPIO 2 é `TFT_DC`. Não usar como LED.
8. Commits no estilo Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`.

## Layout

| Pasta | Papel |
| --- | --- |
| `firmware/` | ESP32 + Wokwi |
| `backend/` | FastAPI, Swagger `/docs` |
| `frontend/` | Vite + React (`/` painel, `/display` mostrador) |

Leia `AGENTS.md` e `docs/CONTEXTO_IA.md` antes de gerar código com um agente.
