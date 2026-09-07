# UI — Select pesquisável (react-select)

> **Regra obrigatória para todo select que carrega muitos dados.**

## Quando usar

Todo `<select>` / `SelectField` que renderiza **lista longa ou dinâmica** (≥ 8 opções, ou dados vindos de API/banco, ou lista que pode crescer) **DEVE** ser um **select pesquisável com react-select** — não um `<select>` nativo.

Critérios práticos:

- **≥ 8 opções** → react-select.
- **Dados dinâmicos** (API, `fetch`, `providers`, `calendars`, `wallpapers`, `currencies`, `ROMs`, etc.) → react-select, mesmo com poucas opções hoje.
- **≤ 7 opções fixas e estáveis** (ex.: `celsius/fahrenheit`, `kmh/ms/mph/kn`, `desc/asc`, `minutes/hours/days`) → pode permanecer `<select>` nativo / `SelectField`.

Exemplos que **devem** ser react-select: moedas FIAT (29), ROMs do emulador, provedores/métricas de alarmes, calendários, provedores de tema, filtros Wallhaven com presets, biblioteca de wallpapers.

Exemplos que **podem** ficar nativos: unidade de temperatura (2), unidade de vento (4), ordem (2), limite 3/5/10/15/20/30/50 quando isolado.

## Componente padrão

- **Lib**: [`react-select`](https://react-select.com/home) (`react-select`).
- **Wrapper**: `SearchableField` em `frontend/src/pages/config/ui.tsx` (alias legado `TomSelectField` mantido para compatibilidade).
- **API**: compatível com `SelectField` — `label`, `hint`, `options`, `value`, `onChange` (sintético `e.target.value`), `placeholder`, `disabled`, `wrapperClassName`, `isClearable`, `noOptionsMessage`. Para agrupamento (ex.: ROMs por plataforma), passar `options` como grupos `{ label, options }` no `EmulatorCard`.
- **Comportamento**: `isSearchable`, `menuPortalTarget={document.body}`, `menuPosition="fixed"`, `placeholder` visível, `onChange` dispara evento sintético `e.target.value`.

## Estilo

react-select deve seguir o tema Vigia (variáveis CSS `--card`, `--chip`, `--accent`, etc.). Estilos via prop `styles` em `SearchableField` / `EmulatorCard`:

```ts
control: { borderColor: "var(--card-border)", background: "var(--chip)", borderRadius: 10 }
menu: { background: "var(--card)", borderColor: "var(--card-border)", borderRadius: 10 }
option (active/selected): { background: "var(--accent)", color: "var(--accent-ink)" }
```

Não criar estilos inline por página — centralizar no wrapper. Ajuste global mínimo em `frontend/src/index.css` (`.react-select__menu-portal`).

## Como migrar um SelectField existente

```tsx
// antes
<SelectField label="Moeda base" value={base} onChange={(e) => setBase(e.target.value)} options={FIAT_CODES.map(...)} />

// depois
<SearchableField label="Moeda base" value={base} onChange={(e) => setBase(e.target.value)} options={FIAT_CODES.map(...)} placeholder="Buscar moeda..." />
// (TomSelectField ainda funciona como alias)
```

Para listas com grupos (ex.: ROMs por plataforma), usar `react-select` com `options` agrupadas — ver `EmulatorCard.tsx`.

## Checklist de revisão

- [ ] Select com ≥ 8 opções ou dados dinâmicos usa `SearchableField` (ou `TomSelectField` alias).
- [ ] Placeholder em pt-br ("Buscar…", "Selecione…").
- [ ] `value` controlado via `options.find(o => o.value === value)` (sem manipulação direta de DOM).
- [ ] `menuPortalTarget={document.body}` + `menuPosition="fixed"` para escapar de `overflow: hidden` de cards.
- [ ] Sem `localStorage` como fonte — valor vem de props/state do backend.
- [ ] Acessível por teclado (react-select já cuida) e com `label` visível.

## Histórico

- Até 2026-09: `tom-select` + `TomSelectField` (removido — causava `NotFoundError: removeChild` por manipulação de DOM fora do React, ver AlarmsPage).
- A partir de 2026-09: `react-select` + `SearchableField` (sem manipulação direta de DOM, compatível com React 18).
