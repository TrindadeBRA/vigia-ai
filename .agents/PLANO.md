# Plano — protótipo v1 (histórico)

Este arquivo descreve o **protótipo original** (Claude + Cursor, coletor `http.server`). O produto vigente está em [`ARQUITETURA.md`](ARQUITETURA.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) e no README da raiz.

---

# Plano — painel de cotas Claude + Cursor

## Objetivo

Mostrar na TFT 3,5" (ESP32) o **uso restante do ciclo** das assinaturas Claude e Cursor, atualizado sozinho na rede local.

## Fora de escopo (v1)

- Outros provedores (GPT, Gemini, Copilot)
- Tokens na placa
- App mobile, nuvem pública, conta compartilhada na internet
- Gráficos históricos, alertas (fora do escopo v1; hoje via Telegram — ver [NOTIFICACOES.md](NOTIFICACOES.md))

## Fases

| Fase | Status | Entrega |
| --- | --- | --- |
| 0 | Feito (antes) | Hello World TFT, dois envs PlatformIO, Wokwi |
| 1 | Feito neste plano | Coletor Python: tokens locais / painel (`data/config.json`), `GET /usage` |
| 2 | Feito neste plano | Firmware: Wi-Fi + barras no hardware e no Wokwi (via `wokwigw`) |
| 3 | Feito | Touch XPT2046, 4 views, calibração NVS; Wokwi com botões |
| 4 | Feito (painel) | Config do coletor no browser + Docker opcional |

## Arquitetura escolhida

```
[Claude OAuth local] ─┐
                      ├─► coletor (Mac, :8787) ─► JSON /usage ─► ESP32 + TFT
[Cursor JWT local]  ─┘
```

A placa só conhece Wi-Fi e a URL do coletor (`USAGE_URL`).

## Critérios de pronto (v1)

- [x] JSON único com `claude` e `cursor`, cada um com `ok` / `error`
- [x] Segredos fora do git (`data/config.json`, `secrets.h`)
- [x] Tela com duas barras (Claude sessão+semana; Cursor plano)
- [x] Wokwi fala com o coletor de verdade via `wokwigw` (`./dev wokwi`)
- [x] README + `` para humanos e agentes
- [ ] Hardware físico conferido pelo usuário (precisa da placa ligada e do coletor no Mac)

## Riscos

- APIs internas mudam (header beta Anthropic, RPC Cursor). Isolar parsers no coletor.
- Token OAuth Claude expira: abrir o Claude Code / app renova.
- JWT Cursor: abrir o Cursor no Mac.
- Firewall do macOS pode bloquear porta 8787 para a ESP32.
- IP do Mac muda: atualizar `USAGE_URL` em `firmware/src/secrets.h`.
