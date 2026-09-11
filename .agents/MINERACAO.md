# Mineração de Bitcoin (protótipo)

Painel `/display/mining` + rota `VIEW_MINER` na placa. Fora do contrato
`/usage`. Plano histórico da implementação: [`PLANO_MINERACAO.md`](PLANO_MINERACAO.md).

É o mesmo modelo do [NerdMiner_v2](https://github.com/BitMaker-hub/NerdMiner_v2)
(MIT): Stratum + duplo SHA256 do block header no ESP32, ~30–90 kH/s. Loteria
educacional, não miner lucrativo.

## Share baixo é válido — igual ao NerdMiner

Um **share** não é um bloco de Bitcoin. Continua sendo SHA256d do header de
verdade; o pool só aceita provas mais fáceis para saber que a placa está
hasheando. Achar um bloco ainda exige a dificuldade da rede (trilhões) — uma
ESP32 praticamente nunca acha.

O firmware pede dificuldade **0.00015** (`kDefaultDifficulty` em
`firmware/src/mining/mining_task.cpp`), o mesmo valor do NerdMiner, via
`mining.suggest_difficulty` no handshake e de novo no keepalive (~30 s). O
**pool decide** se aceita. Se aceitar, shares entram em minutos. Se ignorar e
impor 1, quase não entram.

Isso não é “share falso”: pools de solo mining feitos para NerdMiner
(`public-pool.io` e forks) existem justamente para isso.

## Como ler o painel

| Campo | O que significa | Quando fica vazio |
| --- | --- | --- |
| Situação / hashrate / tempo / último relatório | A sessão está hasheando de verdade | Só se a placa sair da `VIEW_MINER` (`stale`) |
| Shares aceitas / rejeitadas | Share submetido **e** respondido pelo pool | Normal a **0** se o pool impôs dificuldade 1 |
| Melhor dificuldade | Recorde entre shares **aceitos** (não de qualquer hash) | Fica 0 enquanto não houver share aceito |
| Block height | Fora do MVP — a placa não consulta explorer | Sempre **—** (`blockHeight` vai `0` no report) |

O log da placa (buffer curto, ~10 s) mostra a dificuldade real:

```
[stratum] nova dificuldade: 0.00015   ← pool NerdMiner; shares em minutos
[stratum] nova dificuldade: 1         ← pool “normal”; ~1 share a cada ~30 h
```

Sessão observada em hardware (2026-09-11): ~7h37 a ~38 kH/s, dificuldade 1,
shares 0, melhor dificuldade 0, height —. Hashrate e uptime subiram. Esperança
de share ≈ 0,25 (`~1,0×10⁹` hashes / `2³²`); chance de zero ≈ 78%. Não é bug
de report.

## Tempo esperado por share (~40 kH/s)

Fórmula aproximada: `hashes ≈ dificuldade × 2³²`.

| Dificuldade do pool | Tempo médio para 1 share |
| --- | --- |
| 0.00015 (pedido do firmware / NerdMiner) | ~15–20 s |
| 0.001 | ~2 min |
| 1 (mínimo típico de pool ASIC / ckpool) | ~30 h |
| 100000 (às vezes o primeiro `set_difficulty` antes do vardiff) | anos |

## Pools

Default da config: `public-pool.io` / `3333` (`backend/src/schemas/mining.ts`).
A placa só minera com `enabled` + wallet preenchida **e** `VIEW_MINER` aberta.

Compatíveis com share baixo (lista do NerdMiner):

- `public-pool.io:3333`
- `pool.nerdminers.org:3333`
- `pool.nerdminer.io:3333`
- `pool.pyblock.xyz:3333`
- `pool.sethforprivacy.com:3333`
- `pool.stompi.de:3333`
- `pool.solomining.de:3333`

Incompatíveis (dificuldade mínima 1 ou maior — o painel “não marca” share):

- `solo.ckpool.org`
- Slush / Braiins e pools de ASIC em geral

Wallet bech32 (`bc1…`) vai sempre em minúsculas no `mining.authorize` —
`public-pool.io` rejeita `BC1…`. Ver `normalizeBtcWallet` em `schemas/mining.ts`.
