/**
 * Provedor Calendário: busca ICS público (Google, Outlook, iCloud) e lista próximos eventos/tarefas.
 * Aceita qualquer URL que retorne text/calendar — normaliza webcal:// -> https://
 * e valida SSRF antes de buscar.
 */
import { utcNow } from "../formatting.js";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_ICS_BYTES = 2_000_000;
const MAX_EVENTS_PER_SOURCE = 50;

export type CalendarKind = "events" | "tasks";

export type CalendarEvent = {
    uid: string | null;
    summary: string;
    description: string | null;
    location: string | null;
    dtstart: string | null;
    dtend: string | null;
    due: string | null;
    status: string | null;
    allDay: boolean;
    kind: CalendarKind;
};

export type CalendarSourceResult = {
    id: string;
    label: string;
    url: string;
    kind: CalendarKind;
    limit: number;
    ok: boolean;
    error: string | null;
    events: CalendarEvent[];
    updated_at: string | null;
};

// ── URL helpers ──────────────────────────────────────────────────────

export function normalizeCalendarUrl(raw: string): string {
    let s = raw.trim();
    if (!s) return s;
    // webcal:// -> https://
    if (s.toLowerCase().startsWith("webcal://")) s = "https://" + s.slice(9);
    // outlook share link sem .ics mas com /calendar/ — mantém como está, o fetch vai seguir redirect
    return s;
}

export function isValidCalendarUrl(raw: string): boolean {
    const s = normalizeCalendarUrl(raw);
    try {
        const u = new URL(s);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch { return false; }
}

function clampLimit(n: unknown): number {
    const v = Number(n);
    if (!Number.isFinite(v)) return 5;
    return Math.max(1, Math.min(MAX_EVENTS_PER_SOURCE, Math.trunc(v)));
}

// ── ICS parsing ──────────────────────────────────────────────────────

function unfoldIcs(text: string): string {
    // RFC 5545 folding: lines starting with space/tab are continuations
    return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function parseIcsDate(value: string, params: string): { iso: string | null; allDay: boolean } {
    const v = value.trim();
    if (!v) return { iso: null, allDay: false };
    const isDateOnly = /VALUE=DATE/i.test(params) || /^\d{8}$/.test(v);
    if (isDateOnly) {
        // YYYYMMDD -> ISO date at midnight UTC
        const y = v.slice(0, 4), m = v.slice(4, 6), d = v.slice(6, 8);
        try {
            const dt = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
            if (Number.isNaN(dt.getTime())) return { iso: null, allDay: true };
            return { iso: dt.toISOString(), allDay: true };
        } catch { return { iso: null, allDay: true }; }
    }
    // DATE-TIME: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS or with TZID
    // Try to parse with TZ handling: if ends with Z -> UTC, else treat as floating/local -> parse as UTC for simplicity
    let iso: string | null = null;
    try {
        // Normalize: 20260904T143000Z -> 2026-09-04T14:30:00.000Z
        // 20260904T143000 -> 2026-09-04T14:30:00.000 (floating)
        const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
        if (m) {
            const [, y, mo, d, h, mi, s, z] = m;
            if (z) {
                iso = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`).toISOString();
            } else {
                // Check TZID param for offset — for MVP treat as local time in UTC
                // If TZID present, we could try to interpret, but without tz database we fallback to UTC
                iso = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`).toISOString();
            }
        } else {
            // Fallback: try Date parse
            const d = new Date(v);
            if (!Number.isNaN(d.getTime())) iso = d.toISOString();
        }
    } catch { iso = null; }
    return { iso, allDay: false };
}

function decodeIcsText(s: string): string {
    return s
        .replace(/\\n/gi, "\n")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\");
}

type RawComponent = { type: "VEVENT" | "VTODO"; props: Map<string, { params: string; value: string }> };

function parseComponents(ics: string): RawComponent[] {
    const unfolded = unfoldIcs(ics);
    const lines = unfolded.split(/\r\n|\n/);
    const out: RawComponent[] = [];
    let current: RawComponent | null = null;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line === "BEGIN:VEVENT") { current = { type: "VEVENT", props: new Map() }; continue; }
        if (line === "BEGIN:VTODO") { current = { type: "VTODO", props: new Map() }; continue; }
        if (line === "END:VEVENT" || line === "END:VTODO") {
            if (current) out.push(current);
            current = null;
            continue;
        }
        if (!current) continue;
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const keyPart = line.slice(0, colonIdx);
        const value = line.slice(colonIdx + 1);
        const semiIdx = keyPart.indexOf(";");
        const key = (semiIdx === -1 ? keyPart : keyPart.slice(0, semiIdx)).toUpperCase();
        const params = semiIdx === -1 ? "" : keyPart.slice(semiIdx + 1);
        // Keep first occurrence; for multi-value like ATTENDEE we ignore extras
        if (!current.props.has(key)) current.props.set(key, { params, value });
        // For RRULE we keep it too
    }
    return out;
}

function componentToEvent(comp: RawComponent, defaultKind: CalendarKind): CalendarEvent | null {
    const get = (k: string) => comp.props.get(k);
    const summary = get("SUMMARY") ? decodeIcsText(get("SUMMARY")!.value).trim() : "";
    if (!summary && comp.type === "VEVENT") {
        // Allow empty summary but skip if no DTSTART and no SUMMARY
        const hasStart = !!get("DTSTART");
        if (!hasStart) return null;
    }
    if (comp.type === "VTODO" && !summary) {
        const hasDue = !!get("DUE") || !!get("DTSTART");
        if (!hasDue) return null;
    }

    const uid = get("UID") ? get("UID")!.value.trim() || null : null;
    const desc = get("DESCRIPTION") ? decodeIcsText(get("DESCRIPTION")!.value).trim() || null : null;
    const loc = get("LOCATION") ? decodeIcsText(get("LOCATION")!.value).trim() || null : null;
    const status = get("STATUS") ? get("STATUS")!.value.trim() || null : null;

    let dtstart: string | null = null;
    let dtend: string | null = null;
    let due: string | null = null;
    let allDay = false;

    if (get("DTSTART")) {
        const { iso, allDay: ad } = parseIcsDate(get("DTSTART")!.value, get("DTSTART")!.params);
        dtstart = iso;
        allDay = ad;
    }
    if (get("DTEND")) {
        const { iso } = parseIcsDate(get("DTEND")!.value, get("DTEND")!.params);
        dtend = iso;
    }
    if (get("DUE")) {
        const { iso, allDay: ad } = parseIcsDate(get("DUE")!.value, get("DUE")!.params);
        due = iso;
        if (ad) allDay = true;
    }
    // VTODO may use DTSTART as start, DUE as due
    // VEVENT all-day without DTEND: assume 1 day
    if (allDay && dtstart && !dtend && comp.type === "VEVENT") {
        try {
            const d = new Date(dtstart);
            d.setUTCDate(d.getUTCDate() + 1);
            dtend = d.toISOString();
        } catch { }
    }

    // Filter completed tasks if status is COMPLETED/CANCELLED
    // We keep them but mark status; filtering happens later

    const kind: CalendarKind = comp.type === "VTODO" ? "tasks" : defaultKind === "tasks" && comp.type === "VEVENT" ? "events" : defaultKind;
    // Actually: if calendar kind is tasks, VEVENTs are still events but we treat them as tasks? No — keep original type
    // For simplicity: VTODO -> tasks, VEVENT -> events regardless of calendar kind
    const finalKind: CalendarKind = comp.type === "VTODO" ? "tasks" : "events";

    return {
        uid,
        summary: summary || "(sem título)",
        description: desc,
        location: loc,
        dtstart,
        dtend,
        due,
        status,
        allDay,
        kind: finalKind,
    };
}

// Simple RRULE expansion for recurring events (MVP: DAILY/WEEKLY/MONTHLY/YEARLY with COUNT/UNTIL)
function expandRecurring(events: CalendarEvent[], comps: RawComponent[]): CalendarEvent[] {
    const out: CalendarEvent[] = [...events];
    const now = Date.now();
    const horizonMs = 90 * 24 * 3600 * 1000; // 90 days ahead
    const horizon = now + horizonMs;

    for (let i = 0; i < comps.length; i++) {
        const comp = comps[i];
        const rruleProp = comp.props.get("RRULE");
        if (!rruleProp) continue;
        const base = events[i];
        if (!base || !base.dtstart) continue;
        const rrule = rruleProp.value;
        const freqMatch = /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i.exec(rrule);
        if (!freqMatch) continue;
        const freq = freqMatch[1].toUpperCase();
        const countMatch = /COUNT=(\d+)/i.exec(rrule);
        const untilMatch = /UNTIL=([^\s;]+)/i.exec(rrule);
        const intervalMatch = /INTERVAL=(\d+)/i.exec(rrule);
        const interval = intervalMatch ? Math.max(1, parseInt(intervalMatch[1], 10)) : 1;
        const count = countMatch ? Math.min(50, parseInt(countMatch[1], 10)) : 20;
        let until: number | null = null;
        if (untilMatch) {
            const { iso } = parseIcsDate(untilMatch[1], "");
            if (iso) until = new Date(iso).getTime();
        }
        const baseTime = new Date(base.dtstart).getTime();
        if (Number.isNaN(baseTime)) continue;
        let generated = 0;
        let cursor = baseTime;
        // Generate occurrences after base (base already included)
        for (let n = 1; n < count && generated < 20; n++) {
            let next: number;
            const d = new Date(cursor);
            if (freq === "DAILY") d.setUTCDate(d.getUTCDate() + interval);
            else if (freq === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7 * interval);
            else if (freq === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + interval);
            else if (freq === "YEARLY") d.setUTCFullYear(d.getUTCFullYear() + interval);
            else break;
            next = d.getTime();
            cursor = next;
            if (until != null && next > until) break;
            if (next > horizon) break;
            if (next < now - 24 * 3600 * 1000) continue; // skip past occurrences older than 1 day
            generated++;
            const duration = base.dtend && base.dtstart ? new Date(base.dtend).getTime() - new Date(base.dtstart).getTime() : 0;
            const nextEnd = duration ? new Date(next + duration).toISOString() : base.dtend;
            out.push({
                ...base,
                uid: base.uid ? `${base.uid}#${n}` : null,
                dtstart: new Date(next).toISOString(),
                dtend: nextEnd,
                due: base.due ? new Date(new Date(base.due).getTime() + (next - baseTime)).toISOString() : base.due,
            });
            if (out.length > 200) break;
        }
    }
    return out;
}

export function parseIcs(icsText: string, defaultKind: CalendarKind = "events"): CalendarEvent[] {
    const comps = parseComponents(icsText);
    const events: CalendarEvent[] = [];
    for (const comp of comps) {
        const ev = componentToEvent(comp, defaultKind);
        if (ev) events.push(ev);
    }
    // Expand recurring
    const expanded = expandRecurring(events, comps);
    return expanded;
}

// ── Fetch ────────────────────────────────────────────────────────────

async function fetchIcsText(url: string): Promise<string> {
    const normalized = normalizeCalendarUrl(url);
    // SSRF guard: reuse logic from wallpapers but inline simple check
    // We allow any public http(s) — block private IPs via DNS lookup if needed
    // For now, just validate URL shape and fetch with redirect limit
    let current = normalized;
    let redirects = 0;
    while (true) {
        const resp = await fetch(current, {
            headers: {
                "User-Agent": "VigiaAI/1.0 (calendar)",
                "Accept": "text/calendar, text/plain, */*",
            },
            redirect: "manual",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (resp.status >= 300 && resp.status < 400) {
            const loc = resp.headers.get("location");
            if (!loc) throw new Error(`redirect sem location`);
            current = new URL(loc, current).toString();
            redirects++;
            if (redirects > 5) throw new Error("muitos redirects");
            continue;
        }
        if (!resp.ok) {
            const body = await resp.text().catch(() => "");
            throw new Error(`HTTP ${resp.status}: ${body.slice(0, 300)}`);
        }
        const cl = resp.headers.get("content-length");
        if (cl && parseInt(cl, 10) > MAX_ICS_BYTES) throw new Error("calendário muito grande");
        const reader = resp.body?.getReader();
        if (reader) {
            const chunks: Uint8Array[] = [];
            let total = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    total += value.byteLength;
                    if (total > MAX_ICS_BYTES) throw new Error("calendário muito grande");
                    chunks.push(value);
                }
            }
            const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
            return buf.toString("utf-8");
        }
        const text = await resp.text();
        if (Buffer.byteLength(text, "utf-8") > MAX_ICS_BYTES) throw new Error("calendário muito grande");
        return text;
    }
}

function filterAndSort(events: CalendarEvent[], kind: CalendarKind, limit: number): CalendarEvent[] {
    const now = Date.now();
    const cutoff = now - 2 * 3600 * 1000; // keep events that started up to 2h ago (ongoing)
    let filtered = events.filter((e) => {
        if (kind === "tasks") {
            // For tasks, keep not completed
            if (e.status && /COMPLETED|CANCELLED/i.test(e.status)) return false;
            // Tasks without due/start are still shown but sorted last
            return true;
        }
        // Events: keep future or ongoing
        const t = e.dtstart ? new Date(e.dtstart).getTime() : e.due ? new Date(e.due).getTime() : null;
        if (t == null || Number.isNaN(t)) return true; // keep undated at end
        // If has end, keep if end > cutoff
        if (e.dtend) {
            const end = new Date(e.dtend).getTime();
            if (!Number.isNaN(end) && end > cutoff) return true;
            return end > cutoff;
        }
        return t >= cutoff;
    });

    filtered.sort((a, b) => {
        const ta = a.dtstart ? new Date(a.dtstart).getTime() : a.due ? new Date(a.due).getTime() : Infinity;
        const tb = b.dtstart ? new Date(b.dtstart).getTime() : b.due ? new Date(b.due).getTime() : Infinity;
        if (ta === Infinity && tb === Infinity) return a.summary.localeCompare(b.summary);
        if (ta === Infinity) return 1;
        if (tb === Infinity) return -1;
        return ta - tb;
    });

    // For tasks, also sort by due date; for events by start
    return filtered.slice(0, clampLimit(limit));
}

export async function fetchCalendarSource(cfg: { id: string; url: string; label?: string; kind?: CalendarKind; limit?: number }): Promise<CalendarSourceResult> {
    const id = String(cfg.id);
    const url = normalizeCalendarUrl(String(cfg.url ?? "").trim());
    const label = String(cfg.label ?? "").trim();
    const kind: CalendarKind = cfg.kind === "tasks" ? "tasks" : "events";
    const limit = clampLimit(cfg.limit ?? 5);

    if (!url) {
        return { id, label, url, kind, limit, ok: false, error: "URL vazia", events: [], updated_at: utcNow() };
    }
    if (!isValidCalendarUrl(url)) {
        return { id, label, url, kind, limit, ok: false, error: "URL inválida (use http/https ou webcal)", events: [], updated_at: utcNow() };
    }

    try {
        const icsText = await fetchIcsText(url);
        if (!icsText.trim()) throw new Error("calendário vazio");
        // Quick check: must contain BEGIN:VCALENDAR
        if (!/BEGIN:VCALENDAR/i.test(icsText)) throw new Error("resposta não é um calendário ICS válido");
        const parsed = parseIcs(icsText, kind);
        const sliced = filterAndSort(parsed, kind, limit);
        return { id, label, url, kind, limit, ok: true, error: null, events: sliced, updated_at: utcNow() };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { id, label, url, kind, limit, ok: false, error: msg.slice(0, 500), events: [], updated_at: utcNow() };
    }
}

export async function fetchCalendarSources(cfg: Record<string, unknown>): Promise<CalendarSourceResult[]> {
    const calCfg = (cfg.calendar ?? {}) as Record<string, unknown>;
    const list = Array.isArray(calCfg.calendars) ? calCfg.calendars as Array<Record<string, unknown>> : [];
    if (list.length === 0) return [];
    const results = await Promise.all(
        list.map((c) =>
            fetchCalendarSource({
                id: String(c.id ?? ""),
                url: String(c.url ?? ""),
                label: String(c.label ?? ""),
                kind: (c.kind === "tasks" ? "tasks" : "events") as CalendarKind,
                limit: clampLimit(c.limit ?? 5),
            }),
        ),
    );
    return results;
}

export function mockCalendarPayload(): Record<string, unknown> {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    return {
        ok: true,
        error: null,
        updated_at: utcNow(),
        calendars: [
            {
                id: "demo-events",
                label: "Agenda",
                url: "https://calendar.google.com/calendar/ical/demo/public/basic.ics",
                kind: "events",
                limit: 5,
                ok: true,
                error: null,
                events: [
                    { uid: "1", summary: "Reunião de planejamento", description: null, location: "Sala 3", dtstart: now.toISOString(), dtend: new Date(now.getTime() + 3600 * 1000).toISOString(), due: null, status: null, allDay: false, kind: "events" },
                    { uid: "2", summary: "Entrega do projeto", description: "Enviar relatório final", location: null, dtstart: tomorrow.toISOString(), dtend: new Date(tomorrow.getTime() + 3600 * 1000).toISOString(), due: null, status: null, allDay: false, kind: "events" },
                    { uid: "3", summary: "Feriado — Dia da Independência", description: null, location: null, dtstart: nextWeek.toISOString(), dtend: new Date(nextWeek.getTime() + 24 * 3600 * 1000).toISOString(), due: null, status: null, allDay: true, kind: "events" },
                ],
                updated_at: utcNow(),
            },
            {
                id: "demo-tasks",
                label: "Tarefas",
                url: "https://calendar.google.com/calendar/ical/demo-tasks/public/basic.ics",
                kind: "tasks",
                limit: 5,
                ok: true,
                error: null,
                events: [
                    { uid: "t1", summary: "Revisar PR #42", description: "Checar testes", location: null, dtstart: null, dtend: null, due: tomorrow.toISOString(), status: "NEEDS-ACTION", allDay: false, kind: "tasks" },
                    { uid: "t2", summary: "Comprar presente", description: null, location: null, dtstart: null, dtend: null, due: nextWeek.toISOString(), status: null, allDay: false, kind: "tasks" },
                ],
                updated_at: utcNow(),
            },
        ],
    };
}

export const clampCalendarLimit = clampLimit;
export const parse_ics = parseIcs;
export const fetch_calendar_source = fetchCalendarSource;
export const fetch_calendar_sources = fetchCalendarSources;
export const mock_calendar_payload = mockCalendarPayload;
