import { useEffect, useState } from "react";
import { addCurrencyItem, deleteCurrencyItem, patchCurrenciesConfig, searchCurrencyCoins } from "../../api/client";
import type { CurrenciesConfig, CurrencySearchResult } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import { PROVIDER_ICON } from "../../theme";
import { cfgCard, cfgFieldLabel, iconChip, iconImg } from "../../tw";
import type { ConfigCopy } from "./copy";
import { ActionRow, Button, FieldStatus, Fold, Switch, TextField } from "./ui";

// Códigos ISO 4217 mais comuns — cobre a maioria dos casos sem precisar de
// busca (ao contrário de cripto, que tem milhares de ativos no CoinGecko).
const FIAT_CODES: { code: string; label: string }[] = [
    { code: "USD", label: "Dólar americano" },
    { code: "EUR", label: "Euro" },
    { code: "GBP", label: "Libra esterlina" },
    { code: "ARS", label: "Peso argentino" },
    { code: "JPY", label: "Iene japonês" },
    { code: "CAD", label: "Dólar canadense" },
    { code: "AUD", label: "Dólar australiano" },
    { code: "CHF", label: "Franco suíço" },
    { code: "CNY", label: "Yuan chinês" },
    { code: "MXN", label: "Peso mexicano" },
    { code: "CLP", label: "Peso chileno" },
    { code: "UYU", label: "Peso uruguaio" },
    { code: "PYG", label: "Guarani paraguaio" },
    { code: "BOB", label: "Boliviano" },
    { code: "COP", label: "Peso colombiano" },
    { code: "PEN", label: "Sol peruano" },
    { code: "INR", label: "Rupia indiana" },
    { code: "ZAR", label: "Rand sul-africano" },
    { code: "RUB", label: "Rublo russo" },
    { code: "KRW", label: "Won sul-coreano" },
    { code: "SGD", label: "Dólar de Singapura" },
    { code: "HKD", label: "Dólar de Hong Kong" },
    { code: "NZD", label: "Dólar neozelandês" },
    { code: "SEK", label: "Coroa sueca" },
    { code: "NOK", label: "Coroa norueguesa" },
    { code: "TRY", label: "Lira turca" },
    { code: "ILS", label: "Shekel israelense" },
    { code: "AED", label: "Dirham dos EAU" },
    { code: "BRL", label: "Real brasileiro" },
];

function ItemRow({ item, c, onReload }: { item: CurrenciesConfig["items"][number]; c: ConfigCopy; onReload: () => Promise<void> }) {
    const remove = useRequest();
    return (
        <li className="flex items-center justify-between gap-2 rounded-[10px] border border-edge bg-canvas px-2.5 py-2">
            <div className="min-w-0">
                <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-[650]">
                    {item.label || item.code} <span className="ml-1 text-[11px] font-normal text-ink3">{item.code}{item.kind === "crypto" ? ` · ${c.currenciesKindCrypto}` : ""}</span>
                </p>
            </div>
            <Button
                variant="ghost"
                className="shrink-0 px-2.5 py-1.5 text-[12.5px]"
                loading={remove.busy}
                onClick={() =>
                    remove.run(
                        async () => {
                            const res = await deleteCurrencyItem(item.id);
                            if (res.ok) await onReload();
                            return res;
                        },
                        { success: c.removed, error: c.offline },
                    )
                }
            >
                {remove.busy ? c.removing : c.remove}
            </Button>
        </li>
    );
}

export function CurrenciesConfigCard({ currencies, c, onReload }: { currencies: CurrenciesConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const [kind, setKind] = useState<"fiat" | "crypto">("fiat");
    const [fiatCode, setFiatCode] = useState(FIAT_CODES[0].code);
    const [cryptoQuery, setCryptoQuery] = useState("");
    const [cryptoResults, setCryptoResults] = useState<CurrencySearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [base, setBase] = useState(currencies.base);

    useEffect(() => {
        setBase(currencies.base);
    }, [currencies.base]);

    const toggleEnabled = useRequest();
    const saveBase = useRequest();
    const add = useRequest();

    async function doSearch() {
        const q = cryptoQuery.trim();
        if (q.length < 2) return;
        setSearching(true);
        try {
            setCryptoResults(await searchCurrencyCoins(q, 8));
        } catch {
            setCryptoResults([]);
        } finally {
            setSearching(false);
        }
    }

    async function addFiat() {
        const chosen = FIAT_CODES.find((f) => f.code === fiatCode);
        await add.run(
            async () => {
                const res = await addCurrencyItem({ kind: "fiat", code: fiatCode, label: chosen?.label || fiatCode });
                if (res.ok) await onReload();
                return res;
            },
            { success: c.added, error: c.offline },
        );
    }

    async function addCrypto(coin: CurrencySearchResult) {
        await add.run(
            async () => {
                const res = await addCurrencyItem({ kind: "crypto", code: coin.id, label: coin.name });
                if (res.ok) await onReload();
                return res;
            },
            { success: c.added, error: c.offline },
        );
        setCryptoResults([]);
        setCryptoQuery("");
    }

    const hint = currencies.items.length
        ? `${currencies.base} · ${currencies.items.map((i) => i.code.toUpperCase()).join(", ")}`
        : c.currenciesEmpty;
    const listSummary = currencies.items.length
        ? `${c.currenciesListLabel} (${currencies.items.length})`
        : c.currenciesListLabel;

    return (
        <article className={`${cfgCard} gap-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={iconChip}>
                        <img className={iconImg} src={PROVIDER_ICON.currencies} alt="" draggable={false} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">{c.currenciesTitle}</h3>
                        <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
                    </div>
                </div>
                <Switch
                    label={c.showOnBoard}
                    checked={currencies.enabled && !currencies.hidden}
                    busy={toggleEnabled.busy}
                    onChange={async (e) => {
                        const next = e.target.checked;
                        await toggleEnabled.run(
                            async () => {
                                const res = await patchCurrenciesConfig({ enabled: next, hidden: !next });
                                if (res.ok) await onReload();
                                return res;
                            },
                            { success: c.saved, error: c.offline },
                        );
                    }}
                />
            </div>

            <ActionRow>
                <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                    <span className={cfgFieldLabel}>{c.currenciesBaseLabel}</span>
                    <select value={base} onChange={(e) => setBase(e.target.value)} className="w-full rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink">
                        {FIAT_CODES.map((f) => (
                            <option key={f.code} value={f.code}>{f.code} — {f.label}</option>
                        ))}
                    </select>
                </label>
                <Button
                    loading={saveBase.busy}
                    disabled={base === currencies.base}
                    onClick={() =>
                        saveBase.run(
                            async () => {
                                const res = await patchCurrenciesConfig({ base });
                                if (res.ok) await onReload();
                                return res;
                            },
                            { success: c.saved, error: c.offline },
                        )
                    }
                >
                    {saveBase.busy ? c.saving : c.save}
                </Button>
            </ActionRow>
            {saveBase.message ? <FieldStatus status={saveBase.status} message={saveBase.message} /> : null}
            {toggleEnabled.message ? <FieldStatus status={toggleEnabled.status} message={toggleEnabled.message} /> : null}

            <Fold summary={listSummary}>
                {currencies.items.length ? (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {currencies.items.map((item) => (
                            <ItemRow key={item.id} item={item} c={c} onReload={onReload} />
                        ))}
                    </ul>
                ) : (
                    <p className="m-0 text-xs text-ink3">{c.currenciesEmpty}</p>
                )}
            </Fold>

            <Fold summary={c.currenciesAddTitle}>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setKind("fiat")}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${kind === "fiat" ? "border-accent bg-accent text-accent-ink" : "border-edge bg-chip text-ink2"}`}
                    >
                        {c.currenciesKindFiat}
                    </button>
                    <button
                        type="button"
                        onClick={() => setKind("crypto")}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${kind === "crypto" ? "border-accent bg-accent text-accent-ink" : "border-edge bg-chip text-ink2"}`}
                    >
                        {c.currenciesKindCrypto}
                    </button>
                </div>

                {kind === "fiat" ? (
                    <ActionRow>
                        <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                            <select value={fiatCode} onChange={(e) => setFiatCode(e.target.value)} className="w-full rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink">
                                {FIAT_CODES.map((f) => (
                                    <option key={f.code} value={f.code}>{f.code} — {f.label}</option>
                                ))}
                            </select>
                        </label>
                        <Button loading={add.busy} onClick={() => void addFiat()}>
                            {add.busy ? c.adding : c.currenciesAdd}
                        </Button>
                    </ActionRow>
                ) : (
                    <div className="flex flex-col gap-2">
                        <ActionRow>
                            <TextField
                                placeholder={c.currenciesSearchPh}
                                value={cryptoQuery}
                                onChange={(e) => setCryptoQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void doSearch(); } }}
                                autoComplete="off"
                            />
                            <Button variant="secondary" loading={searching} onClick={() => void doSearch()} disabled={cryptoQuery.trim().length < 2}>
                                {searching ? c.currenciesSearching : c.currenciesSearch}
                            </Button>
                        </ActionRow>
                        {cryptoResults.length > 0 ? (
                            <div className="flex flex-col gap-1 rounded-[10px] border border-edge bg-canvas p-1">
                                {cryptoResults.map((coin) => (
                                    <button
                                        key={coin.id}
                                        type="button"
                                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm hover:bg-chip"
                                        onClick={() => void addCrypto(coin)}
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="font-semibold text-ink">{coin.name}</span>
                                            <span className="ml-1.5 text-xs text-ink3">{coin.symbol}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : cryptoQuery.trim().length >= 2 && !searching ? (
                            <p className="m-0 text-xs text-ink3">{c.currenciesNoResults}</p>
                        ) : null}
                    </div>
                )}
                {add.message ? <FieldStatus status={add.status} message={add.message} /> : null}
            </Fold>
        </article>
    );
}
