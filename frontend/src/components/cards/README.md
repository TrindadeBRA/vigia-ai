# Padrões de Cards — `/display`

Documento de referência para criar novos cards componentizados no mostrador. Baseado no **Claude** `frontend/src/components/cards/ClaudeCard.tsx:1` como implementação modelo.

## 1. Grid e tamanhos

**Arquivo:** `frontend/src/board.ts:1`

- `CELL_MIN=168` `CELL_GAP=14` `CELL_ROW=0.96`
- `rowPxFor(cellPx)` normal, `halfRowPxFor`, `quarterRowPxFor`
- `colsForWidth(width)` usa `quarterMin=84` (metade de `CELL_MIN`) → grid 1/4 dobra colunas visuais mas mantém tamanho visual dos cards
- `CardSize = "sm" | "sw" | "md" | "lg" | "xl" | "wl" | "wxl"` `board.ts:1`
  - `sm` = Pequeno · 5h (sessão) `i18n.ts:179`
  - `sw` = Pequeno · semana (weekly) — segunda variação pequena, 1 contador cada
  - `md` normal, `lg` grande 2×1, `xl` extra grande 2×2, `wl` 2×4 longo, `wxl` 2×4 super largo
- `rectFor(size, cols): Rect` `board.ts:54`
  ```ts
  sm/sw → {w:2,h:1} ≈188×83 retângulo largo
  md    → {w:2,h:2} ≈188×180 quadrado (normal)
  lg    → {w:4,h:2} largo
  xl    → {w:4,h:4} 2×2
  wl    → {w:4,h:8} longo 2×4
  wxl   → {w:4,h:8} super largo 2×4
  ```
  2× `sm` empilham = 1× `md`. Grid usa `unitPx=rowPxFor(cellPx)` com `cellPx` quarter (≈87×83 quadrado).
- `MIN_PAD_ROWS=12` (quarter) `board.ts:34`, `padRowsForHeight` e `firstFree/packRowMajor 64` para densidade.
- `normalizeSize`, `colsForWidth`, `displayBoard`, `packBoard`, `placeCard`, `setCardSize`, `emptyCells`, `dropTarget` controlam persistência em `localStorage["vigia_display_prefs"].board` `Display.tsx:44`.

### Quando ocultar tamanhos

`claudeAllowedSizes` `ClaudeCard.tsx:60` retorna só tamanhos que fazem sentido para o payload:
```ts
if (count>=3) return ["sm","sw","md","lg","wl"]; // 3-4 janelas → wl útil
return ["sm","sw","md","lg"]; // 2 janelas → xl/wxl vazios
```
`SizeMenu` `Display.tsx:556` recebe `allowed` e filtra `CARD_ORDER`; `wxl/xl` sempre ocultos pro Claude.

## 2. Arquitetura do card

**3 camadas:**

1. **Tile wrapper** (`ClaudeTileCard` `Display.tsx:695`) — chrome do grid: borda, `shadow-card`, `GripIcon` drag, `SizeMenu allowed`, `viewFade`. Padding `px-2.5 py-2` para `sm/sw` (½ altura) e `px-3.5 pb-3 pt-3` demais.
2. **BoardCard** (`ClaudeBoardCard` `ClaudeCard.tsx:186`) — conteúdo dentro do tile, sem chrome, recebe `metrics: Metric[]`, `label`, `ok/error`, `t/pal/nowMs`, `size`, `onOpen`. Click abre detalhe.
3. **Detail** (`ClaudeDetail` `ClaudeCard.tsx:393`) — página `/display` account, `MetaChips` + `metricsGrid` com `DetailMetricCard`.

**Tipos:**

```ts
type Metric = {label:string; pct:number|null; sub:string|null; countdownAt?:string|null; value?:string|null} // Display.tsx:29
type ProviderMeta = {id, provider, ok, error, title, label, metrics:Metric[], kind, weather, currencies} // Display.tsx:30
```

## 3. Dados — API → métricas

**Backend:** `backend/app/providers/claude.py:38` `parse_claude_payload` normaliza `five_hour/seven_day/seven_day_sonnet/seven_day_opus` ou `limits[].kind` para `session/weekly/sonnet/opus` 0–100 + `resets_at` ISO. `schemas.py:159` `ClaudeAccount`.

**Frontend:** `getClaudeMetrics(c,t)` `ClaudeCard.tsx:15` mapeia `ClaudeAccount` → `Metric[]` (4 janelas opcionais, fallback `noData`). `buildProviders` `Display.tsx:263` usa mesma lógica para `ProviderMeta.metrics`.

**Helpers:** `fmtPct`, `fmtRemain`, `fmtCountdown(resets_at, nowMs)`, `fmtWhen`, `barColor/barGlow` `format.ts:29`.

## 4. Primitivos visuais (reuso máximo)

- `barStyle(pct,pal)` `ClaudeCard.tsx:71` → `barColor/barGlow` + `barTrack/barFill` `tw.ts:23`
- `Icon` `ClaudeCard.tsx:76` → `PROVIDER_ICON.claude` `/icons/claude.png` `theme.ts:71` `size-7` compacto / `size-[42px]` normal
- `ClaudeHeader` `ClaudeCard.tsx:90` ícone + dot `bg-good/bad` + `cardLabel`
- `CompactRow`/`Row` `ClaudeCard.tsx:125` — barra `5px` vs `7px`, footer 1 linha vs `flex-wrap`
- `DetailMetricCard` `ClaudeCard.tsx:365` → `metricCard` `tw.ts:29` `barTrack h-[9px]` `num`
- Classes: `cardLabel`, `errorText`, `metricCard`, `metricsGrid`, `num` `tw.ts:15`.

**Tema:** `PALETTES` `ACCENTS` `PROVIDER_ICON` `theme.ts:3`.

## 5. Layouts por tamanho (Claude modelo)

| Tamanho          | Rect             | Conteúdo                                                                |
| ---------------- | ---------------- | ----------------------------------------------------------------------- |
| `sm` 2×1         | sessão só        | ícone 42 esquerda + 1 hero `label 10px` `pct 18px` `bar 4px` `Reset em` |
| `sw` 2×1         | semana só        | idem com `metrics[1]`                                                   |
| `md` 2×2         | 2 métricas       | `ClaudeHeader` + 2× `CompactRow` `justify-center` + `+N`                |
| `lg` 4×2         | 2 + pills        | `grid-cols-2` `Row` + pills sonnet/opus                                 |
| `wl` 2×8         | 4 métricas pilha | `justify-evenly gap-2` `Row`                                            |
| `xl/wxl` ocultos | 4 métricas grade | `xl` 2×2, `wxl` 2 colunas                                               |

`sm/sw` ultra-compactos cabem em ½ altura (73px + gap).

## 6. Seletor de tamanho

`CARD_ORDER ["sm","sw","md","lg","xl","wl","wxl"]` `Display.tsx:534`  
`SizeMenu` `Display.tsx:556` botão `size-[18px]` `SizeIcon 7/11px` menu `min-w 110` `rounded-lg` `p-0.5` `gap 1.5` `text 11px`. `SizeIcon` diferencia `sm` sólido vs `sw` tracejado.

## 7. Como criar um novo card (ex: GPT)

1. **Mapear API** `backend/app/providers/<novo>.py` + `schemas.py` + `api/types.ts`.
2. **Criar** `frontend/src/components/cards/<Novo>Card.tsx` com:
   ```ts
   export function get<Novo>Metrics(acc: <Acc>, t:T): Metric[]
   export function <novo>AllowedSizes(acc, metrics): CardSize[]
   export function <Novo>BoardCard({metrics,label,ok,error,t,pal,nowMs,size,onOpen})
   export function <Novo>Detail({account,updatedAt,t,pal,nowMs})
   ```
   Reuse `barStyle`, `PROVIDER_ICON.<novo>`, `CompactRow/Row`, `fmt*`.
3. **Tile wrapper** em `Display.tsx` como `ClaudeTileCard`, calcule `allowed = <novo>AllowedSizes(null, p.metrics)` e passe a `SizeMenu`.
4. **Branch em `ProviderCard`** `Display.tsx:743`:
   ```ts
   if (p.provider==="novo") return <NovoTileCard .../>
   ```
5. **Detail branch** em `AccountPage` e `ClaudeBody` equivalente.
6. **i18n** `i18n.ts:75` adicione `cardSmallWeek` etc se precisar de variações.
7. **Board** já suporta 1/4; só garanta `rectFor` e `normalizeSize` para novos tamanhos se criar.

## 8. Checklist

- [ ] `getMetrics` cobre todas janelas opcionais + `noData`
- [ ] `allowedSizes` oculta `xl/wxl` quando sem dados
- [ ] `BoardCard` trata `!ok` com `errorText`
- [ ] `sm/sw` 1 contador hero, `md` 2, `lg` 2+ pills, `wl` 4
- [ ] Usa `PROVIDER_ICON`, `barColor/barGlow`, `fmtCountdown` com `nowMs`
- [ ] Tile wrapper com `GripIcon 14` + `SizeMenu allowed`
- [ ] `Detail` com `MetaChips` + `metricsGrid`
- [ ] `npm run build` passa `tsc --noEmit`

Referências: `Display.tsx:263` `board.ts:54` `ClaudeCard.tsx:1` `WeatherCard.tsx:1` `CurrenciesCard.tsx:1` `format.ts:1` `tw.ts:1`.
