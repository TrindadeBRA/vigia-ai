# UI — Tom Select pesquisável

> **Regra obrigatória para todo select que carrega muitos dados.**

## Quando usar

Todo `<select>` / `SelectField` que renderiza **lista longa ou dinâmica** (≥ 8 opções, ou dados vindos de API/banco, ou lista que pode crescer) **DEVE** ser um **Tom Select pesquisável** — não um `<select>` nativo.

Critérios práticos:

- **≥ 8 opções** → Tom Select.
- **Dados dinâmicos** (API, `fetch`, `providers`, `calendars`, `wallpapers`, `currencies`, `ROMs`, etc.) → Tom Select, mesmo com poucas opções hoje.
- **≤ 7 opções fixas e estáveis** (ex.: `celsius/fahrenheit`, `kmh/ms/mph/kn`, `desc/asc`, `minutes/hours/days`) → pode permanecer `<select>` nativo / `SelectField`.

Exemplos que **devem** ser Tom Select: moedas FIAT (29), ROMs do emulador, provedores/métricas de alarmes, calendários, provedores de tema, filtros Wallhaven com presets, biblioteca de wallpapers.

Exemplos que **podem** ficar nativos: unidade de temperatura (2), unidade de vento (4), ordem (2), limite 3/5/10/15/20/30/50 quando isolado.

## Componente padrão

- **Lib**: [`tom-select`](https://tom-select.js.org/) (`tom-select/dist/css/tom-select.css`).
- **Wrapper**: `TomSelectField` em `frontend/src/pages/config/ui.tsx` (re-exportado também em `frontend/src/components/TomSelectField.tsx` se necessário).
- **API**: compatível com `SelectField` — `label`, `hint`, `options`, `value`, `onChange` (sintético `e.target.value`), `placeholder`, `disabled`, `wrapperClassName`, `optgroups` quando houver agrupamento.
- **Comportamento**: `maxOptions: 500`, `searchField: ["text"]`, `placeholder` visível, `lockOptgroupOrder: true` quando houver grupos, `onChange` dispara `setValue` + `onChange` sintético.

## Estilo

Tom Select deve seguir o tema Vigia (variáveis CSS `--card`, `--chip`, `--accent`, etc.). Estilos globais já injetados em `ui.tsx` / `EmulatorCard.tsx`:

```css
.ts-wrapper { min-height: 34px; }
.ts-control { border-color: var(--card-border,#2e2e2e) !important; background: var(--chip,#232323) !important; color: var(--text,#f5f5f5) !important; border-radius: 10px !important; }
.ts-dropdown { background: var(--card,#1c1c1c) !important; border-color: var(--card-border,#2e2e2e) !important; border-radius: 10px !important; }
.ts-dropdown .option.active { background: var(--accent,#e63931) !important; color: var(--accent-ink,#fff) !important; }
```

Não criar estilos inline por página — centralizar no wrapper.

## Como migrar um SelectField existente

```tsx
// antes
<SelectField label="Moeda base" value={base} onChange={(e) => setBase(e.target.value)} options={FIAT_CODES.map(...)} />

// depois
<TomSelectField label="Moeda base" value={base} onChange={(e) => setBase(e.target.value)} options={FIAT_CODES.map(...)} placeholder="Buscar moeda..." />
```

Para listas com `optgroups` (ex.: ROMs por plataforma), passar `optgroups` e `optgroupField`.

## Checklist de revisão

- [ ] Select com ≥ 8 opções ou dados dinâmicos usa `TomSelectField`.
- [ ] Placeholder em pt-br (“Buscar…”, “Selecione…”).
- [ ] `value` sincronizado via `ts.setValue` em `useEffect`.
- [ ] `destroy()` no cleanup do `useEffect`.
- [ ] Sem `localStorage` como fonte — valor vem de props/state do backend.
- [ ] Acessível por teclado (Tom Select já cuida) e com `label` visível.
