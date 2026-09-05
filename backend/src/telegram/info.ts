import { buildPayload } from "../usage.js";

// ── Levenshtein ──────────────────────────────────────────────────────

export function levenshtein(a: string, b: string): number {
    const al = a.length;
    const bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    // otimização: garante que a seja a menor
    if (al > bl) return levenshtein(b, a);
    let prev = Array.from({ length: al + 1 }, (_, i) => i);
    let curr = new Array(al + 1);
    for (let j = 1; j <= bl; j++) {
        curr[0] = j;
        const bj = b.charAt(j - 1);
        for (let i = 1; i <= al; i++) {
            const cost = a.charAt(i - 1) === bj ? 0 : 1;
            curr[i] = Math.min(
                prev[i] + 1, // deletion
                curr[i - 1] + 1, // insertion
                prev[i - 1] + cost, // substitution
            );
        }
        const tmp = prev;
        prev = curr;
        curr = tmp;
    }
    return prev[al];
}

export function normalizeForSearch(s: string): string {
    return String(s ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

// ── Parse /info ─────────────────────────────────────────────────────

export function parseInfoCommand(text: string): string | null | undefined {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) return null;
    const m = /^\/info(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(trimmed);
    if (!m) return null;
    if (m[1] === undefined) return undefined; // só "/info" sem argumento
    return m[1].trim();
}

export const INFO_HELP_MSG =
    "ℹ️ Use <b>/info {nome da conta}</b> para ver os detalhes de um card.\n" +
    "Exemplo: <code>/info claude</code> ou <code>/info bitcoin</code>\n" +
    "Tolera até 2 erros de digitação.";

export const INFO_EMPTY_MSG =
    "⚠️ Nome vazio. Use: <code>/info {nome da conta}</code>\n" +
    "Exemplo: <code>/info claude</code>";

export const INFO_NOT_FOUND_MSG = (query: string, suggestions: string[]) => {
    const q = escapeHtml(query);
    let msg = `❌ Nenhuma conta encontrada para "<b>${q}</b>".`;
    if (suggestions.length > 0) {
        msg += `\n\n💡 Você quis dizer:\n${suggestions.map((s) => `• <code>${escapeHtml(s)}</code>`).join("\n")}`;
    }
    msg += `\n\n📋 Use <code>/info</code> sem argumento para listar todas as contas.`;
    return msg;
};

// ── Helpers de formatação ──────────────────────────────────────────

function escapeHtml(s: string): string {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function fmtPct(v: unknown): string {
    if (v === null || v === undefined) return "--";
    const n = Number(v);
    if (!Number.isFinite(n)) return "--";
    return `${Math.round(n)}%`;
}

function fmtRemain(pct: unknown): string {
    if (pct === null || pct === undefined) return "--";
    const n = Number(pct);
    if (!Number.isFinite(n)) return "--";
    const r = 100 - Math.max(0, Math.min(100, n));
    return `${Math.round(r)}%`;
}

function fmtUsd(cents: unknown): string {
    if (cents === null || cents === undefined) return "--";
    const n = Number(cents);
    if (!Number.isFinite(n) || n < 0) return "--";
    if (n === 0) return "$0.00";
    const reais = Math.trunc(n / 100);
    const cc = Math.abs(n % 100);
    return cc === 0 ? `$${reais}` : `$${reais}.${String(cc).padStart(2, "0")}`;
}

function fmtBrl(cents: unknown): string {
    if (cents === null || cents === undefined) return "--";
    const n = Number(cents);
    if (!Number.isFinite(n) || n < 0) return "--";
    if (n === 0) return "R$0,00";
    const reais = Math.trunc(n / 100);
    const cc = Math.abs(n % 100);
    return `R$${reais.toLocaleString("pt-BR")},${String(cc).padStart(2, "0")}`;
}

function fmtMoney(cents: unknown, currency?: string | null): string {
    const cur = String(currency || "USD").toUpperCase();
    if (cur === "BRL") return fmtBrl(cents);
    if (cur === "USD") return fmtUsd(cents);
    if (cents === null || cents === undefined) return "--";
    const n = Number(cents);
    if (!Number.isFinite(n) || n < 0) return "--";
    try {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(n / 100);
    } catch {
        return `${cur} ${(n / 100).toFixed(2)}`;
    }
}

function fmtBtc(btc: unknown): string {
    if (btc === null || btc === undefined) return "--";
    const n = Number(btc);
    if (!Number.isFinite(n) || n < 0) return "--";
    return `${n.toFixed(8)} BTC`;
}

function fmtWhen(raw: unknown): string {
    if (!raw) return "";
    const s = String(raw).trim();
    if (s.length >= 16 && s[4] === "-" && s[10] === "T") {
        return `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 13)}h${s.slice(14, 16)}`;
    }
    return s;
}

function fmtCountdown(resetsAt: unknown): string | null {
    if (!resetsAt) return null;
    const s = String(resetsAt).trim();
    let end: number | null = null;
    if (/^\d{4}-/.test(s) || s.includes("T")) {
        const iso = Date.parse(s);
        if (!Number.isNaN(iso)) end = iso;
    }
    if (end === null) {
        const m = /^(\d{2})\/(\d{2})\s+(\d{2})h(\d{2})$/.exec(s);
        if (m) {
            const dd = Number(m[1]);
            const mo = Number(m[2]);
            const hh = Number(m[3]);
            const mi = Number(m[4]);
            const y = new Date().getFullYear();
            const mk = (year: number) => Date.parse(`${String(year).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00-03:00`);
            const thisYear = mk(y);
            const nextYear = mk(y + 1);
            if (!Number.isNaN(thisYear) && thisYear >= Date.now() - 24 * 3600 * 1000) end = thisYear;
            else if (!Number.isNaN(nextYear) && nextYear - Date.now() > 0 && nextYear - Date.now() <= 45 * 24 * 3600 * 1000) end = nextYear;
            else end = thisYear;
        }
    }
    if (end === null) return null;
    const sec = Math.floor((end - Date.now()) / 1000);
    if (sec < 0) return null;
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s2 = sec % 60;
    const hms = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")}`;
    return d > 0 ? `${d}d ${hms}` : hms;
}

function fmtCurrencyAmount(price: unknown, base: string): string {
    if (price === null || price === undefined) return "--";
    const n = Number(price);
    if (!Number.isFinite(n)) return "--";
    try {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: base, maximumFractionDigits: n >= 1 ? 2 : 6 }).format(n);
    } catch {
        return `${n.toFixed(2)} ${base}`;
    }
}

function wmoLabel(code: unknown): string {
    const map: Record<number, string> = {
        0: "Céu limpo", 1: "Predom. limpo", 2: "Parcial. nublado", 3: "Encoberto",
        45: "Nevoeiro", 48: "Nevoeiro c/ geada",
        51: "Chuvisco fraco", 53: "Chuvisco", 55: "Chuvisco forte",
        61: "Chuva fraca", 63: "Chuva", 65: "Chuva forte",
        71: "Neve fraca", 73: "Neve", 75: "Neve forte",
        80: "Pancadas fracas", 81: "Pancadas", 82: "Pancadas fortes",
        95: "Trovoada", 96: "Trovoada c/ granizo", 99: "Trovoada c/ granizo forte",
    };
    if (code === null || code === undefined) return "--";
    const n = Number(code);
    return map[n] || `Código ${n}`;
}

// ── Tipos internos ─────────────────────────────────────────────────

type Candidate = {
    id: string; // ex: "claude:local"
    provider: string;
    title: string;
    label: string;
    searchKeys: string[]; // normalizados
    raw: Record<string, unknown>;
    kind?: string;
};

// ── Construção do índice de busca ─────────────────────────────────

function buildCandidates(payload: Record<string, unknown>): Candidate[] {
    const out: Candidate[] = [];

    const add = (id: string, provider: string, title: string, label: string, raw: Record<string, unknown>, extraKeys: string[] = [], kind?: string) => {
        const keys: string[] = [];
        const pushKey = (s: string) => {
            const n = normalizeForSearch(s);
            if (n) keys.push(n);
            // também adiciona sem espaços para tolerar "open router" vs "openrouter"
            const nospace = n.replace(/\s+/g, "");
            if (nospace && nospace !== n) keys.push(nospace);
        };
        pushKey(provider);
        pushKey(title);
        pushKey(label);
        pushKey(id);
        // id sem prefixo provider
        const shortId = id.includes(":") ? id.split(":").slice(1).join(":") : id;
        if (shortId !== id) pushKey(shortId);
        // label pode ter espaços, adiciona partes
        for (const part of String(label).split(/\s+/)) pushKey(part);
        for (const k of extraKeys) pushKey(k);
        // remove duplicatas
        const uniq = [...new Set(keys.filter(Boolean))];
        out.push({ id, provider, title, label, searchKeys: uniq, raw, kind });
    };

    const providers: Array<[string, string]> = [
        ["claude", "Claude"],
        ["gpt", "GPT"],
        ["cursor", "Cursor"],
        ["openrouter", "OpenRouter"],
        ["deepseek", "DeepSeek"],
        ["opencode", "OpenCode"],
        ["fal", "fal.ai"],
        ["bitcoin", "Bitcoin"],
        ["adsense", "AdSense"],
        ["retroachievements", "RetroAchievements"],
    ];

    for (const [prov, titleBase] of providers) {
        const arr = payload[prov] as unknown;
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
            if (!item || typeof item !== "object" || Array.isArray(item)) continue;
            const acc = item as Record<string, unknown>;
            const id = String(acc.id ?? "unknown");
            const label = String(acc.label ?? "");
            const title = prov === "gpt" && acc.plan ? `GPT ${acc.plan}` :
                prov === "cursor" && acc.plan ? `Cursor ${acc.plan}` :
                    prov === "retroachievements" && acc.username ? `RetroAchievements ${acc.username}` :
                        titleBase;
            const extra: string[] = [];
            if (prov === "retroachievements" && acc.username) extra.push(String(acc.username));
            if (prov === "bitcoin" && acc.address) extra.push(String(acc.address).slice(0, 12));
            add(`${prov}:${id}`, prov, title, label, acc, extra);
        }
    }

    // Weather
    const w = payload.weather as Record<string, unknown> | null | undefined;
    if (w && typeof w === "object" && !Array.isArray(w)) {
        const locName = String((w.location as Record<string, unknown> | null)?.name ?? "");
        add("weather:main", "weather", locName ? `Clima ${locName}` : "Clima", locName, w as Record<string, unknown>, ["weather", "clima", "tempo", "previsao", "meteorologia"], "weather");
    }

    // Currencies
    const cu = payload.currencies as Record<string, unknown> | null | undefined;
    if (cu && typeof cu === "object" && !Array.isArray(cu)) {
        const base = String(cu.base ?? "BRL");
        add("currencies:main", "currencies", `Moedas ${base}`, base, cu as Record<string, unknown>, ["currencies", "moedas", "cambio", "cotacao", base], "currencies");
        // também adiciona cada moeda individual como alias para achar via código
        const items = cu.items as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(items)) {
            for (const it of items) {
                if (!it || typeof it !== "object") continue;
                const code = String(it.code ?? "");
                const label = String(it.label ?? "");
                // não cria candidate separado, só adiciona chave extra ao candidate principal
                // mas para facilitar, adiciona como chave extra já foi feito via base; adiciona códigos
                const main = out.find((c) => c.id === "currencies:main");
                if (main) {
                    const n = normalizeForSearch(code);
                    if (n && !main.searchKeys.includes(n)) main.searchKeys.push(n);
                    const nl = normalizeForSearch(label);
                    if (nl && !main.searchKeys.includes(nl)) main.searchKeys.push(nl);
                }
            }
        }
    }

    // Git — um candidate por repo
    const git = payload.git as Record<string, unknown> | null | undefined;
    if (git && typeof git === "object" && !Array.isArray(git)) {
        const repos = git.repos as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(repos)) {
            for (const repo of repos) {
                if (!repo || typeof repo !== "object") continue;
                const id = String(repo.id ?? "unknown");
                const label = String(repo.label ?? "");
                const source = String(repo.source ?? "");
                const shortName = label || source.split("/").pop()?.replace(/\.git$/, "") || source.slice(0, 24);
                add(`git:${id}`, "git", `Git ${shortName}`, label || shortName, repo as Record<string, unknown>, ["git", shortName, source, String(repo.branch ?? "")], "git");
            }
            if (repos.length === 0 && git.error) {
                add("git:main", "git", "Git", "", git as Record<string, unknown>, ["git"], "git");
            }
        }
    }

    // Calendar
    const cal = payload.calendar as Record<string, unknown> | null | undefined;
    if (cal && typeof cal === "object" && !Array.isArray(cal)) {
        const cals = cal.calendars as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(cals) && cals.length > 0) {
            for (const c of cals) {
                if (!c || typeof c !== "object") continue;
                const id = String(c.id ?? "unknown");
                const label = String(c.label ?? "");
                const kind = String(c.kind ?? "events");
                add(`calendar:${id}`, "calendar", label || (kind === "tasks" ? "Tarefas" : "Calendário"), label, c as Record<string, unknown>, ["calendar", "calendario", "agenda", kind, label], "calendar");
            }
        } else {
            add("calendar:main", "calendar", "Calendário", "", cal as Record<string, unknown>, ["calendar", "calendario", "agenda"], "calendar");
        }
    }

    // RSS
    const rss = payload.rss as Record<string, unknown> | null | undefined;
    if (rss && typeof rss === "object" && !Array.isArray(rss)) {
        const feeds = rss.feeds as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(feeds) && feeds.length > 0) {
            // candidate único para RSS (agrupa feeds)
            add("rss:main", "rss", "RSS", `${feeds.length} feeds`, rss as Record<string, unknown>, ["rss", "feed", "noticias", "news"], "rss");
            for (const f of feeds) {
                if (!f || typeof f !== "object") continue;
                const label = String((f as Record<string, unknown>).label ?? (f as Record<string, unknown>).title ?? "");
                const main = out.find((c) => c.id === "rss:main");
                if (main && label) {
                    const n = normalizeForSearch(label);
                    if (n && !main.searchKeys.includes(n)) main.searchKeys.push(n);
                }
            }
        } else {
            add("rss:main", "rss", "RSS", "", rss as Record<string, unknown>, ["rss", "feed"], "rss");
        }
    }

    return out;
}

function scoreCandidate(queryNorm: string, cand: Candidate): number {
    // 0 = perfeito, 1 = substring, 2+ = levenshtein
    // verifica match exato em alguma chave
    for (const key of cand.searchKeys) {
        if (key === queryNorm) return 0;
    }
    // substring: query contida na chave ou chave contida na query
    for (const key of cand.searchKeys) {
        if (key.includes(queryNorm) || queryNorm.includes(key)) return 0.5;
    }
    // levenshtein mínimo entre query e cada chave
    let best = Infinity;
    for (const key of cand.searchKeys) {
        const d = levenshtein(queryNorm, key);
        if (d < best) best = d;
        // também testa sem espaços
        const qNoSpace = queryNorm.replace(/\s+/g, "");
        const kNoSpace = key.replace(/\s+/g, "");
        if (qNoSpace !== queryNorm || kNoSpace !== key) {
            const d2 = levenshtein(qNoSpace, kNoSpace);
            if (d2 < best) best = d2;
        }
    }
    return best;
}

// ── Formatadores por provider ──────────────────────────────────────

function formatClaude(acc: Record<string, unknown>): string {
    const label = String(acc.label ?? "");
    const header = label ? `🤖 <b>Claude</b> — ${escapeHtml(label)}` : `🤖 <b>Claude</b>`;
    if (!acc.ok) return `${header}\n❌ <i>${escapeHtml(String(acc.error ?? "sem dados"))}</i>`;
    const lines: string[] = [header];
    const addPct = (name: string, pct: unknown, resetsAt: unknown) => {
        if (pct === null && pct === undefined && !resetsAt) return;
        const pctStr = pct !== null && pct !== undefined ? fmtPct(pct) : "--";
        const remain = pct !== null && pct !== undefined ? `resta ${fmtRemain(pct)}` : "";
        const when = fmtWhen(resetsAt);
        const cd = fmtCountdown(resetsAt);
        const whenStr = when ? ` · reset ${escapeHtml(when)}` : "";
        const cdStr = cd ? ` (${escapeHtml(cd)})` : "";
        const extra = [remain, whenStr + cdStr].filter(Boolean).join("");
        lines.push(`├ ${escapeHtml(name)}: <b>${escapeHtml(pctStr)}</b>${extra ? ` — ${extra}` : ""}`);
    };
    addPct("Sessão 5h", acc.session_percent, acc.session_resets_at);
    addPct("Semana", acc.weekly_percent, acc.weekly_resets_at);
    addPct("Sonnet (semana)", acc.sonnet_percent, acc.sonnet_resets_at);
    addPct("Opus (semana)", acc.opus_percent, acc.opus_resets_at);
    if (lines.length === 1) lines.push(`├ <i>sem janelas de cota</i>`);
    // troca último ├ por └
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatGpt(acc: Record<string, unknown>): string {
    const label = String(acc.label ?? "");
    const plan = String(acc.plan ?? "");
    const title = plan ? `GPT ${plan}` : "GPT";
    const header = label ? `🧠 <b>${escapeHtml(title)}</b> — ${escapeHtml(label)}` : `🧠 <b>${escapeHtml(title)}</b>`;
    if (!acc.ok) return `${header}\n❌ <i>${escapeHtml(String(acc.error ?? "sem dados"))}</i>`;
    const lines: string[] = [header];
    const addPct = (name: string, pct: unknown, resetsAt: unknown) => {
        if (pct === null && pct === undefined && !resetsAt) return;
        const pctStr = pct !== null && pct !== undefined ? fmtPct(pct) : "--";
        const remain = pct !== null && pct !== undefined ? `resta ${fmtRemain(pct)}` : "";
        const when = fmtWhen(resetsAt);
        const cd = fmtCountdown(resetsAt);
        const whenStr = when ? ` · reset ${escapeHtml(when)}` : "";
        const cdStr = cd ? ` (${escapeHtml(cd)})` : "";
        lines.push(`├ ${escapeHtml(name)}: <b>${escapeHtml(pctStr)}</b>${remain ? ` — ${remain}` : ""}${whenStr}${cdStr}`);
    };
    addPct("Sessão", acc.session_percent, acc.session_resets_at);
    addPct("Semana", acc.weekly_percent, acc.weekly_resets_at);
    if (lines.length === 1) lines.push(`├ <i>sem dados</i>`);
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatCursor(acc: Record<string, unknown>): string {
    const label = String(acc.label ?? "");
    const plan = String(acc.plan ?? "");
    const title = plan ? `Cursor ${plan}` : "Cursor";
    const header = label ? `🖱️ <b>${escapeHtml(title)}</b> — ${escapeHtml(label)}` : `🖱️ <b>${escapeHtml(title)}</b>`;
    if (!acc.ok) return `${header}\n❌ <i>${escapeHtml(String(acc.error ?? "sem dados"))}</i>`;
    const lines: string[] = [header];
    if (acc.percent !== null && acc.percent !== undefined) {
        const cd = acc.cycle_end ? fmtWhen(acc.cycle_end) : "";
        const cdStr = cd ? ` · ciclo ${escapeHtml(cd)}` : "";
        lines.push(`├ Modelos: <b>${escapeHtml(fmtPct(acc.percent))}</b> — resta ${escapeHtml(fmtRemain(acc.percent))}${cdStr}`);
    }
    if (acc.other_percent !== null && acc.other_percent !== undefined) {
        lines.push(`├ Outros modelos: <b>${escapeHtml(fmtPct(acc.other_percent))}</b> — resta ${escapeHtml(fmtRemain(acc.other_percent))}`);
    }
    const ondemandBits: string[] = [];
    if (acc.used_cents !== null && acc.used_cents !== undefined && acc.limit_cents !== null && acc.limit_cents !== undefined) {
        ondemandBits.push(`${fmtUsd(acc.used_cents)} / ${fmtUsd(acc.limit_cents)}`);
    } else if (acc.used_cents !== null && acc.used_cents !== undefined) {
        ondemandBits.push(`usado ${fmtUsd(acc.used_cents)}`);
    } else if (acc.limit_cents !== null && acc.limit_cents !== undefined) {
        ondemandBits.push(`teto ${fmtUsd(acc.limit_cents)}`);
    }
    if (acc.remaining_cents !== null && acc.remaining_cents !== undefined) ondemandBits.push(`resta ${fmtUsd(acc.remaining_cents)}`);
    if (acc.bonus_cents !== null && acc.bonus_cents !== undefined && Number(acc.bonus_cents) > 0) ondemandBits.push(`bônus ${fmtUsd(acc.bonus_cents)}`);
    if (ondemandBits.length > 0) lines.push(`├ On-demand: ${escapeHtml(ondemandBits.join(" · "))}`);
    if (acc.requests_used !== null && acc.requests_used !== undefined) {
        lines.push(`├ Pedidos: ${escapeHtml(String(acc.requests_used))}${acc.requests_limit ? ` / ${escapeHtml(String(acc.requests_limit))}` : ""}`);
    }
    if (lines.length === 1) lines.push(`├ <i>sem dados</i>`);
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatCredits(acc: Record<string, unknown>, title: string): string {
    const label = String(acc.label ?? "");
    const header = label ? `💳 <b>${escapeHtml(title)}</b> — ${escapeHtml(label)}` : `💳 <b>${escapeHtml(title)}</b>`;
    if (!acc.ok) return `${header}\n❌ <i>${escapeHtml(String(acc.error ?? "sem dados"))}</i>`;
    const lines: string[] = [header];
    if (acc.percent !== null && acc.percent !== undefined) {
        lines.push(`├ Uso: <b>${escapeHtml(fmtPct(acc.percent))}</b> — resta ${escapeHtml(fmtRemain(acc.percent))}`);
    }
    if (acc.limit_cents !== null && acc.limit_cents !== undefined) lines.push(`├ Teto: <b>${escapeHtml(fmtUsd(acc.limit_cents))}</b>`);
    if (acc.used_cents !== null && acc.used_cents !== undefined) lines.push(`├ Usado: ${escapeHtml(fmtUsd(acc.used_cents))}`);
    if (acc.remaining_cents !== null && acc.remaining_cents !== undefined) lines.push(`├ Restante: <b>${escapeHtml(fmtUsd(acc.remaining_cents))}</b>`);
    if (lines.length === 1) lines.push(`├ <i>sem dados de créditos</i>`);
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatOpenCode(acc: Record<string, unknown>): string {
    const label = String(acc.label ?? "");
    const header = label ? `💻 <b>OpenCode</b> — ${escapeHtml(label)}` : `💻 <b>OpenCode</b>`;
    if (!acc.ok) return `${header}\n❌ <i>${escapeHtml(String(acc.error ?? "sem dados"))}</i>`;
    const lines: string[] = [header];
    const addPct = (name: string, pct: unknown, resetsAt: unknown) => {
        if (pct === null || pct === undefined) return;
        const when = fmtWhen(resetsAt);
        const cd = fmtCountdown(resetsAt);
        const whenStr = when ? ` · reset ${escapeHtml(when)}` : "";
        const cdStr = cd ? ` (${escapeHtml(cd)})` : "";
        lines.push(`├ ${escapeHtml(name)}: <b>${escapeHtml(fmtPct(pct))}</b> — resta ${escapeHtml(fmtRemain(pct))}${whenStr}${cdStr}`);
    };
    addPct("Rolling", acc.rolling_percent, acc.rolling_resets_at);
    addPct("Semana", acc.weekly_percent, acc.weekly_resets_at);
    addPct("Mês", acc.monthly_percent, acc.monthly_resets_at);
    if (acc.percent !== null && acc.percent !== undefined) {
        lines.push(`├ Créditos: <b>${escapeHtml(fmtPct(acc.percent))}</b>`);
    }
    if (acc.remaining_cents !== null && acc.remaining_cents !== undefined) {
        const lim = acc.limit_cents !== null && acc.limit_cents !== undefined ? ` · teto ${escapeHtml(fmtUsd(acc.limit_cents))}` : "";
        lines.push(`├ Saldo: <b>${escapeHtml(fmtUsd(acc.remaining_cents))}</b>${lim}`);
    }
    if (lines.length === 1) lines.push(`├ <i>sem dados</i>`);
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatBitcoin(acc: Record<string, unknown>): string {
    const label = String(acc.label ?? "");
    const header = label ? `₿ <b>Bitcoin</b> — ${escapeHtml(label)}` : `₿ <b>Bitcoin</b>`;
    if (!acc.ok) return `${header}\n❌ <i>${escapeHtml(String(acc.error ?? "sem dados"))}</i>`;
    const lines: string[] = [header];
    if (acc.address) lines.push(`├ Endereço: <code>${escapeHtml(String(acc.address))}</code>`);
    if (acc.balance_btc !== null && acc.balance_btc !== undefined) lines.push(`├ Saldo: <b>${escapeHtml(fmtBtc(acc.balance_btc))}</b>`);
    if (acc.price_usd_cents !== null && acc.price_usd_cents !== undefined) lines.push(`├ Cotação USD: ${escapeHtml(fmtUsd(acc.price_usd_cents))}`);
    if (acc.price_brl_cents !== null && acc.price_brl_cents !== undefined) lines.push(`├ Cotação BRL: ${escapeHtml(fmtBrl(acc.price_brl_cents))}`);
    if (acc.value_usd_cents !== null && acc.value_usd_cents !== undefined) lines.push(`├ Valor USD: <b>${escapeHtml(fmtUsd(acc.value_usd_cents))}</b>`);
    if (acc.value_brl_cents !== null && acc.value_brl_cents !== undefined) lines.push(`├ Valor BRL: <b>${escapeHtml(fmtBrl(acc.value_brl_cents))}</b>`);
    if (lines.length === 1) lines.push(`├ <i>sem dados</i>`);
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatAdsense(acc: Record<string, unknown>): string {
    const label = String(acc.label ?? acc.account_name ?? "");
    const header = label ? `💰 <b>AdSense</b> — ${escapeHtml(label)}` : `💰 <b>AdSense</b>`;
    if (!acc.ok) return `${header}\n❌ <i>${escapeHtml(String(acc.error ?? "sem dados"))}</i>`;
    const lines: string[] = [header];
    const cur = String(acc.currency ?? "USD");
    if (acc.today_cents !== null && acc.today_cents !== undefined) lines.push(`├ Hoje: <b>${escapeHtml(fmtMoney(acc.today_cents, cur))}</b>`);
    if (acc.unpaid_cents !== null && acc.unpaid_cents !== undefined) lines.push(`├ Carteira: <b>${escapeHtml(fmtMoney(acc.unpaid_cents, cur))}</b>`);
    if (acc.currency) lines.push(`├ Moeda: ${escapeHtml(String(acc.currency))}`);
    if (acc.account_name) lines.push(`├ Conta: <code>${escapeHtml(String(acc.account_name))}</code>`);
    if (lines.length === 1) lines.push(`├ <i>sem dados</i>`);
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatWeather(w: Record<string, unknown>): string {
    const loc = w.location as Record<string, unknown> | null | undefined;
    const locName = String(loc?.name ?? "");
    const header = locName ? `🌤️ <b>Clima · ${escapeHtml(locName)}</b>` : `🌤️ <b>Clima</b>`;
    if (!w.ok) return `${header}\n❌ <i>${escapeHtml(String(w.error ?? "sem dados"))}</i>`;
    const cur = w.current as Record<string, unknown> | null | undefined;
    const units = w.current_units as Record<string, unknown> | null | undefined;
    const tempUnit = String(units?.["temperature_2m"] ?? "°C");
    const windUnit = String(units?.["wind_speed_10m"] ?? "km/h");
    const lines: string[] = [header];
    if (cur) {
        if (cur.temperature_2m !== null && cur.temperature_2m !== undefined) {
            const code = cur.weather_code;
            const desc = wmoLabel(code);
            lines.push(`├ Agora: <b>${escapeHtml(String(Math.round(Number(cur.temperature_2m)) + tempUnit))}</b> — ${escapeHtml(desc)}`);
        }
        if (cur.apparent_temperature !== null && cur.apparent_temperature !== undefined) lines.push(`├ Sensação: ${escapeHtml(String(Math.round(Number(cur.apparent_temperature)) + tempUnit))}`);
        if (cur.relative_humidity_2m !== null && cur.relative_humidity_2m !== undefined) lines.push(`├ Umidade: ${escapeHtml(String(Math.round(Number(cur.relative_humidity_2m)) + "%"))}`);
        if (cur.wind_speed_10m !== null && cur.wind_speed_10m !== undefined) lines.push(`├ Vento: ${escapeHtml(String(Math.round(Number(cur.wind_speed_10m)) + " " + windUnit))}`);
        if (cur.precipitation !== null && cur.precipitation !== undefined && Number(cur.precipitation) > 0) lines.push(`├ Chuva: ${escapeHtml(String(cur.precipitation) + " mm")}`);
        if (cur.pressure_msl !== null && cur.pressure_msl !== undefined) lines.push(`├ Pressão: ${escapeHtml(String(Math.round(Number(cur.pressure_msl)) + " hPa"))}`);
    }
    const daily = w.daily as Record<string, unknown> | null | undefined;
    if (daily && Array.isArray(daily.time) && daily.time.length > 0) {
        const idx = 0;
        const max = (daily.temperature_2m_max as unknown[] | undefined)?.[idx];
        const min = (daily.temperature_2m_min as unknown[] | undefined)?.[idx];
        if (max !== null && max !== undefined && min !== null && min !== undefined) {
            lines.push(`├ Hoje: máx ${escapeHtml(String(Math.round(Number(max)) + tempUnit))} · mín ${escapeHtml(String(Math.round(Number(min)) + tempUnit))}`);
        }
    }
    if (lines.length === 1) lines.push(`├ <i>sem dados atuais</i>`);
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatCurrencies(cu: Record<string, unknown>): string {
    const base = String(cu.base ?? "BRL");
    const header = `💱 <b>Moedas · ${escapeHtml(base)}</b>`;
    if (!cu.ok) return `${header}\n❌ <i>${escapeHtml(String(cu.error ?? "sem dados"))}</i>`;
    const items = cu.items as Array<Record<string, unknown>> | undefined;
    if (!items || items.length === 0) return `${header}\n<i>nenhuma moeda configurada</i>`;
    const lines: string[] = [header];
    for (const it of items.slice(0, 10)) {
        const code = String(it.code ?? "");
        const label = String(it.label ?? code);
        const price = it.price;
        const ok = it.ok;
        if (ok && price !== null && price !== undefined) {
            lines.push(`├ ${escapeHtml(label)} (${escapeHtml(code)}): <b>${escapeHtml(fmtCurrencyAmount(price, base))}</b>`);
        } else {
            lines.push(`├ ${escapeHtml(label)} (${escapeHtml(code)}): <i>${escapeHtml(String(it.error ?? "--"))}</i>`);
        }
    }
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatGitRepo(repo: Record<string, unknown>): string {
    const label = String(repo.label ?? "");
    const source = String(repo.source ?? "");
    const shortName = label || source.split("/").pop()?.replace(/\.git$/, "") || source.slice(0, 24);
    const branch = String(repo.branch ?? "");
    const header = branch ? `🌿 <b>Git · ${escapeHtml(shortName)}</b> — ${escapeHtml(branch)}` : `🌿 <b>Git · ${escapeHtml(shortName)}</b>`;
    if (!repo.ok) return `${header}\n❌ <i>${escapeHtml(String(repo.error ?? "sem dados"))}</i>\n└ Fonte: <code>${escapeHtml(source)}</code>`;
    const commits = repo.commits as Array<Record<string, unknown>> | undefined;
    const lines: string[] = [header];
    if (source) lines.push(`├ Fonte: <code>${escapeHtml(source.slice(0, 60))}</code>`);
    if (!commits || commits.length === 0) {
        lines.push(`├ <i>nenhum commit</i>`);
    } else {
        for (const c of commits.slice(0, 5)) {
            const hash = String(c.short_hash ?? String(c.hash ?? "").slice(0, 7));
            const subject = String(c.subject ?? "").slice(0, 60);
            const author = String(c.author_name ?? "");
            const date = c.date ? fmtWhen(c.date) || String(c.date).slice(0, 16) : "";
            lines.push(`├ <code>${escapeHtml(hash)}</code> ${escapeHtml(subject)} — ${escapeHtml(author)} ${date ? `· ${escapeHtml(date)}` : ""}`);
        }
    }
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatCalendar(cal: Record<string, unknown>): string {
    // pode ser um calendar individual ou o payload agregado
    const isAggregated = Array.isArray(cal.calendars);
    if (isAggregated) {
        const cals = cal.calendars as Array<Record<string, unknown>>;
        if (cals.length === 0) return `📅 <b>Calendário</b>\n└ <i>nenhum calendário configurado</i>`;
        if (cals.length === 1) return formatCalendar(cals[0] as Record<string, unknown>);
        // múltiplos calendários: mostra resumo
        const lines: string[] = [`📅 <b>Calendário · ${cals.length} fontes</b>`];
        for (const c of cals.slice(0, 3)) {
            const label = String(c.label ?? c.url ?? "sem nome");
            const kind = String(c.kind ?? "events");
            const count = Array.isArray(c.events) ? (c.events as unknown[]).length : 0;
            const ok = c.ok;
            if (!ok) lines.push(`├ ${escapeHtml(label)} (${escapeHtml(kind)}): ❌ ${escapeHtml(String(c.error ?? "erro"))}`);
            else lines.push(`├ ${escapeHtml(label)} (${escapeHtml(kind)}): ${count} ${count === 1 ? "item" : "itens"}`);
        }
        if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
        return lines.join("\n");
    }
    const label = String(cal.label ?? cal.url ?? "Calendário");
    const kind = String(cal.kind ?? "events");
    const header = `📅 <b>${escapeHtml(label)}</b> — ${escapeHtml(kind === "tasks" ? "Tarefas" : "Eventos")}`;
    if (!cal.ok) return `${header}\n❌ <i>${escapeHtml(String(cal.error ?? "sem dados"))}</i>`;
    const events = cal.events as Array<Record<string, unknown>> | undefined;
    if (!events || events.length === 0) return `${header}\n└ <i>nenhum evento</i>`;
    const lines: string[] = [header];
    for (const ev of events.slice(0, 5)) {
        const summary = String(ev.summary ?? "sem título").slice(0, 60);
        const whenRaw = String(ev.dtstart ?? ev.due ?? "");
        const when = whenRaw ? fmtWhen(whenRaw) || whenRaw.slice(0, 16) : "";
        const loc = ev.location ? ` · ${String(ev.location).slice(0, 30)}` : "";
        const allDay = ev.allDay ? " (dia todo)" : "";
        lines.push(`├ ${escapeHtml(summary)}${when ? ` — ${escapeHtml(when)}` : ""}${escapeHtml(allDay)}${escapeHtml(loc)}`);
    }
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatRss(rss: Record<string, unknown>): string {
    const feeds = rss.feeds as Array<Record<string, unknown>> | undefined;
    const header = `📰 <b>RSS</b> — ${feeds?.length ?? 0} ${feeds?.length === 1 ? "feed" : "feeds"}`;
    if (!rss.ok && (!feeds || feeds.length === 0)) return `${header}\n❌ <i>${escapeHtml(String(rss.error ?? "sem dados"))}</i>`;
    if (!feeds || feeds.length === 0) return `${header}\n└ <i>nenhum feed</i>`;
    const lines: string[] = [header];
    for (const feed of feeds.slice(0, 3)) {
        const label = String(feed.label ?? feed.title ?? feed.url ?? "Feed");
        if (!feed.ok) {
            lines.push(`├ ${escapeHtml(label)}: ❌ ${escapeHtml(String(feed.error ?? "erro"))}`);
            continue;
        }
        const items = feed.items as Array<Record<string, unknown>> | undefined;
        lines.push(`├ <b>${escapeHtml(label)}</b> — ${items?.length ?? 0} itens`);
        if (items) {
            for (const it of items.slice(0, 2)) {
                const title = String(it.title ?? "sem título").slice(0, 60);
                const pub = it.pubDate ? fmtWhen(it.pubDate) || String(it.pubDate).slice(0, 16) : "";
                lines.push(`│  ├ ${escapeHtml(title)}${pub ? ` · ${escapeHtml(pub)}` : ""}`);
            }
        }
    }
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    // corrige sub-itens do último feed
    return lines.join("\n");
}

function formatRetro(acc: Record<string, unknown>): string {
    const username = String(acc.username ?? acc.label ?? "");
    const header = username ? `🎮 <b>RetroAchievements · ${escapeHtml(username)}</b>` : `🎮 <b>RetroAchievements</b>`;
    if (!acc.ok) return `${header}\n❌ <i>${escapeHtml(String(acc.error ?? "sem dados"))}</i>`;
    const lines: string[] = [header];
    if (acc.total_points !== null && acc.total_points !== undefined) lines.push(`├ Pontos: <b>${escapeHtml(String(acc.total_points))}</b>`);
    if (acc.total_true_points !== null && acc.total_true_points !== undefined) lines.push(`├ True Points: ${escapeHtml(String(acc.total_true_points))}`);
    if (acc.rank !== null && acc.rank !== undefined) {
        const total = acc.total_ranked ? ` / ${escapeHtml(String(acc.total_ranked))}` : "";
        lines.push(`├ Rank: <b>#${escapeHtml(String(acc.rank))}</b>${total}`);
    }
    if (acc.motto) lines.push(`├ Lema: <i>${escapeHtml(String(acc.motto))}</i>`);
    if (acc.status) lines.push(`├ Status: ${escapeHtml(String(acc.status))}`);
    if (acc.rich_presence_msg) lines.push(`├ Jogando: ${escapeHtml(String(acc.rich_presence_msg))}`);
    if (acc.last_game_title) lines.push(`├ Último jogo: ${escapeHtml(String(acc.last_game_title))}`);
    if (lines.length === 1) lines.push(`├ <i>sem dados</i>`);
    if (lines.length > 1) lines[lines.length - 1] = lines[lines.length - 1].replace("├", "└");
    return lines.join("\n");
}

function formatCandidate(cand: Candidate): string {
    const raw = cand.raw;
    switch (cand.provider) {
        case "claude": return formatClaude(raw);
        case "gpt": return formatGpt(raw);
        case "cursor": return formatCursor(raw);
        case "openrouter": return formatCredits(raw, "OpenRouter");
        case "deepseek": return formatCredits(raw, "DeepSeek");
        case "fal": return formatCredits(raw, "fal.ai");
        case "opencode": return formatOpenCode(raw);
        case "bitcoin": return formatBitcoin(raw);
        case "adsense": return formatAdsense(raw);
        case "retroachievements": return formatRetro(raw);
        case "weather": return formatWeather(raw);
        case "currencies": return formatCurrencies(raw);
        case "git": return formatGitRepo(raw);
        case "calendar": return formatCalendar(raw);
        case "rss": return formatRss(raw);
        default: return `📋 <b>${escapeHtml(cand.title)}</b> — ${escapeHtml(cand.label)}\n└ <i>sem formatador específico</i>`;
    }
}

function listAllCandidates(cands: Candidate[]): string {
    if (cands.length === 0) return "📭 Nenhuma conta configurada no Vigia AI.";
    const lines: string[] = ["📋 <b>Contas disponíveis</b> — use <code>/info {nome}</code>:\n"];
    // agrupa por provider para ficar bonito
    const byProvider = new Map<string, Candidate[]>();
    for (const c of cands) {
        const arr = byProvider.get(c.provider) ?? [];
        arr.push(c);
        byProvider.set(c.provider, arr);
    }
    for (const [prov, list] of byProvider) {
        const icon: Record<string, string> = {
            claude: "🤖", gpt: "🧠", cursor: "🖱️", openrouter: "💳", deepseek: "💳", fal: "💳", opencode: "💻",
            bitcoin: "₿", adsense: "💰", weather: "🌤️", currencies: "💱", git: "🌿", calendar: "📅", rss: "📰", retroachievements: "🎮",
        };
        const emoji = icon[prov] ?? "📋";
        for (const c of list) {
            const display = c.label ? `${c.title} — ${c.label}` : c.title;
            // mostra id curto para o usuário copiar
            const hint = c.provider === "weather" || c.provider === "currencies" || c.provider === "rss" ? c.provider : c.label || c.provider;
            lines.push(`${emoji} <code>${escapeHtml(hint)}</code> — ${escapeHtml(display)}`);
        }
    }
    lines.push(`\n💡 Dica: tolera até 2 erros de digitação. Ex: <code>/info claud</code> → Claude`);
    return lines.join("\n");
}

// ── API principal ──────────────────────────────────────────────────

export async function handleInfoQuery(query: string): Promise<string> {
    const trimmed = query.trim();
    // lista todas se vazio
    let payload: Record<string, unknown>;
    try {
        payload = await buildPayload({ forceQuota: false }) as Record<string, unknown>;
    } catch (exc) {
        return `❌ Falha ao buscar dados: <i>${escapeHtml(String(exc))}</i>`;
    }

    const candidates = buildCandidates(payload);
    if (!trimmed) {
        return listAllCandidates(candidates);
    }

    const qNorm = normalizeForSearch(trimmed);
    if (!qNorm) return INFO_EMPTY_MSG;

    // calcula score para cada candidate
    const scored = candidates.map((c) => ({ cand: c, score: scoreCandidate(qNorm, c) }));
    scored.sort((a, b) => a.score - b.score);

    const bestScore = scored[0]?.score ?? Infinity;
    // threshold: até 2 de distância Levenshtein, ou 0.5 para substring
    if (bestScore > 2) {
        // sugere os 3 mais próximos
        const suggestions = scored.slice(0, 3).map((s) => s.cand.label || s.cand.provider || s.cand.title).filter(Boolean);
        // deduplica
        const uniq = [...new Set(suggestions)].slice(0, 3);
        return INFO_NOT_FOUND_MSG(trimmed, uniq);
    }

    // pega todos com score == bestScore (empate) — se mais de 1, mostra todos
    const winners = scored.filter((s) => s.score === bestScore).map((s) => s.cand);
    // se empate com muitos (ex: 2 claude accounts com mesmo label vazio), limita a 3
    const toShow = winners.slice(0, 3);

    const parts = toShow.map((c) => formatCandidate(c));
    let result = parts.join("\n\n— — —\n\n");
    // Telegram limite 4096 chars — trunca com aviso
    if (result.length > 4000) {
        result = result.slice(0, 4000) + "\n\n<i>…mensagem truncada (limite do Telegram)</i>";
    }
    // se havia mais de um vencedor, avisa
    if (winners.length > toShow.length) {
        result += `\n\n<i>+ ${winners.length - toShow.length} resultado(s) oculto(s) — refine a busca</i>`;
    } else if (winners.length > 1) {
        result = `🔍 <i>${winners.length} resultados para "${escapeHtml(trimmed)}":</i>\n\n` + result;
    }
    return result;
}

// exports para teste
export const _formatCandidate = formatCandidate;
export const _buildCandidates = buildCandidates;
export const _scoreCandidate = scoreCandidate;
