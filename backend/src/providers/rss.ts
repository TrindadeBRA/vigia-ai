/**
 * Provedor RSS: busca feeds RSS/Atom públicos e lista os últimos itens.
 * Suporta RSS 2.0 (<rss><channel><item>) e Atom (<feed><entry>).
 * Sem dependências externas — parse XML via regex/string.
 */
import { utcNow } from "../formatting.js";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RSS_BYTES = 2_000_000;
const MAX_LIMIT = 50;

export type RssItem = {
    title: string;
    link: string | null;
    description: string | null;
    pubDate: string | null;
    author: string | null;
    categories: string[];
    guid: string | null;
    enclosure: string | null;
};

export type RssFeedResult = {
    id: string;
    label: string;
    url: string;
    limit: number;
    ok: boolean;
    error: string | null;
    title: string | null;
    description: string | null;
    link: string | null;
    items: RssItem[];
    updated_at: string | null;
};

function clampLimit(n: unknown): number {
    const v = Number(n);
    if (!Number.isFinite(v)) return 10;
    return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(v)));
}

export function isValidRssUrl(raw: string): boolean {
    const s = raw.trim();
    try {
        const u = new URL(s);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch { return false; }
}

// ── XML helpers ──────────────────────────────────────────────────

function decodeEntities(s: string): string {
    return s
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(parseInt(n, 10)); } catch { return _; } })
        .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => { try { return String.fromCharCode(parseInt(n, 16)); } catch { return _; } });
}

function stripCdata(s: string): string {
    return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function stripTags(s: string): string {
    return s.replace(/<[^>]+>/g, "").trim();
}

function extractTag(xml: string, tag: string): string | null {
    // case-insensitive, handles attributes and CDATA
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
    const m = re.exec(xml);
    if (!m) return null;
    return decodeEntities(stripCdata(m[1]).trim());
}

function extractAllTags(xml: string, tag: string): string[] {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi");
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
        out.push(decodeEntities(stripCdata(m[1]).trim()));
    }
    return out;
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
    const re = new RegExp(`<${tag}[^>]*\\b${attr}\\s*=\\s*["']([^"']+)["']`, "i");
    const m = re.exec(xml);
    return m ? decodeEntities(m[1].trim()) : null;
}

function extractLink(xml: string): string | null {
    // RSS: <link>url</link>  |  Atom: <link href="url" rel="alternate" />
    const rssLink = extractTag(xml, "link");
    if (rssLink && /^https?:\/\//i.test(rssLink)) return rssLink;
    // Atom link with href
    const href = extractAttr(xml, "link", "href");
    if (href) return href;
    // fallback: any href in link tag
    const linkTag = /<link[^>]*>/i.exec(xml);
    if (linkTag) {
        const h = /href\s*=\s*["']([^"']+)["']/i.exec(linkTag[0]);
        if (h) return decodeEntities(h[1].trim());
    }
    return rssLink || null;
}

function parseRssDate(raw: string | null): string | null {
    if (!raw) return null;
    const s = raw.trim();
    if (!s) return null;
    try {
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
    } catch { }
    return null;
}

// ── RSS 2.0 parsing ──────────────────────────────────────────────

function parseRssChannel(xml: string, limit: number): { title: string | null; description: string | null; link: string | null; items: RssItem[] } {
    const channelMatch = /<channel[^>]*>([\s\S]*?)<\/channel>/i.exec(xml);
    const channelXml = channelMatch ? channelMatch[1] : xml;
    const title = extractTag(channelXml, "title");
    const description = extractTag(channelXml, "description");
    const link = extractLink(channelXml);

    const itemBlocks: string[] = [];
    const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) !== null) itemBlocks.push(m[1]);

    const items: RssItem[] = [];
    for (const block of itemBlocks.slice(0, limit)) {
        const itemTitle = extractTag(block, "title") || "(sem título)";
        const itemLink = extractLink(block);
        const desc = extractTag(block, "description") || extractTag(block, "content:encoded") || extractTag(block, "content") || null;
        const pubDate = parseRssDate(extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated") || extractTag(block, "dc:date"));
        const author = extractTag(block, "author") || extractTag(block, "dc:creator") || null;
        const categories = extractAllTags(block, "category").map(stripTags).filter(Boolean);
        const guid = extractTag(block, "guid") || null;
        const enclosure = extractAttr(block, "enclosure", "url") || null;
        items.push({
            title: stripTags(itemTitle).slice(0, 300) || "(sem título)",
            link: itemLink,
            description: desc ? stripTags(decodeEntities(stripCdata(desc))).slice(0, 500) || null : null,
            pubDate,
            author: author ? stripTags(author).slice(0, 120) : null,
            categories,
            guid,
            enclosure,
        });
    }
    return { title, description: description ? stripTags(description).slice(0, 500) : null, link, items };
}

// ── Atom parsing ─────────────────────────────────────────────────

function parseAtomFeed(xml: string, limit: number): { title: string | null; description: string | null; link: string | null; items: RssItem[] } {
    const feedTitle = extractTag(xml, "title");
    const feedSubtitle = extractTag(xml, "subtitle");
    const feedLink = extractLink(xml);

    const entryBlocks: string[] = [];
    const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    let m: RegExpExecArray | null;
    while ((m = entryRe.exec(xml)) !== null) entryBlocks.push(m[1]);

    const items: RssItem[] = [];
    for (const block of entryBlocks.slice(0, limit)) {
        const entryTitle = extractTag(block, "title") || "(sem título)";
        const entryLink = extractLink(block);
        const summary = extractTag(block, "summary") || extractTag(block, "content") || null;
        const pubDate = parseRssDate(extractTag(block, "published") || extractTag(block, "updated") || null);
        const authorBlock = /<author[^>]*>([\s\S]*?)<\/author>/i.exec(block);
        const author = authorBlock ? (extractTag(authorBlock[1], "name") || extractTag(authorBlock[1], "email") || null) : null;
        const categories: string[] = [];
        const catRe = /<category[^>]*term\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
        let cm: RegExpExecArray | null;
        while ((cm = catRe.exec(block)) !== null) categories.push(decodeEntities(cm[1].trim()));
        // also <category>text</category>
        for (const c of extractAllTags(block, "category")) {
            const t = stripTags(c).trim();
            if (t && !categories.includes(t)) categories.push(t);
        }
        const guid = extractTag(block, "id") || null;
        const enclosure = extractAttr(block, "link", "href") || null;

        items.push({
            title: stripTags(entryTitle).slice(0, 300) || "(sem título)",
            link: entryLink || enclosure,
            description: summary ? stripTags(decodeEntities(stripCdata(summary))).slice(0, 500) || null : null,
            pubDate,
            author: author ? stripTags(author).slice(0, 120) : null,
            categories,
            guid,
            enclosure: null,
        });
    }
    return { title: feedTitle ? stripTags(feedTitle).slice(0, 200) : null, description: feedSubtitle ? stripTags(feedSubtitle).slice(0, 500) : null, link: feedLink, items };
}

function parseFeed(xml: string, limit: number): { title: string | null; description: string | null; link: string | null; items: RssItem[] } {
    const isAtom = /<feed[^>]*xmlns[^>]*atom/i.test(xml) || /<feed[^>]*>/i.test(xml) && /<entry[^>]*>/i.test(xml);
    if (isAtom) return parseAtomFeed(xml, limit);
    return parseRssChannel(xml, limit);
}

// ── Fetch ────────────────────────────────────────────────────────

async function fetchRssText(url: string): Promise<string> {
    let current = url.trim();
    let redirects = 0;
    while (true) {
        const resp = await fetch(current, {
            headers: {
                "User-Agent": "VigiaAI/1.0 (rss)",
                "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
            },
            redirect: "manual",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (resp.status >= 300 && resp.status < 400) {
            const loc = resp.headers.get("location");
            if (!loc) throw new Error("redirect sem location");
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
        if (cl && parseInt(cl, 10) > MAX_RSS_BYTES) throw new Error("feed muito grande");
        const reader = resp.body?.getReader();
        if (reader) {
            const chunks: Uint8Array[] = [];
            let total = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    total += value.byteLength;
                    if (total > MAX_RSS_BYTES) throw new Error("feed muito grande");
                    chunks.push(value);
                }
            }
            const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
            return buf.toString("utf-8");
        }
        const text = await resp.text();
        if (Buffer.byteLength(text, "utf-8") > MAX_RSS_BYTES) throw new Error("feed muito grande");
        return text;
    }
}

export async function fetchRssFeed(cfg: { id: string; url: string; label?: string; limit?: number }): Promise<RssFeedResult> {
    const id = String(cfg.id);
    const url = String(cfg.url ?? "").trim();
    const label = String(cfg.label ?? "").trim();
    const limit = clampLimit(cfg.limit ?? 10);

    if (!url) {
        return { id, label, url, limit, ok: false, error: "URL vazia", title: null, description: null, link: null, items: [], updated_at: utcNow() };
    }
    if (!isValidRssUrl(url)) {
        return { id, label, url, limit, ok: false, error: "URL inválida (use http/https)", title: null, description: null, link: null, items: [], updated_at: utcNow() };
    }

    try {
        const xml = await fetchRssText(url);
        if (!xml.trim()) throw new Error("feed vazio");
        if (!/<(rss|feed|channel)[\s>]/i.test(xml)) throw new Error("resposta não é um feed RSS/Atom válido");
        const parsed = parseFeed(xml, limit);
        return {
            id, label, url, limit,
            ok: true, error: null,
            title: parsed.title,
            description: parsed.description,
            link: parsed.link,
            items: parsed.items,
            updated_at: utcNow(),
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { id, label, url, limit, ok: false, error: msg.slice(0, 500), title: null, description: null, link: null, items: [], updated_at: utcNow() };
    }
}

export async function fetchRssFeeds(cfg: Record<string, unknown>): Promise<RssFeedResult[]> {
    const rssCfg = (cfg.rss ?? {}) as Record<string, unknown>;
    const list = Array.isArray(rssCfg.feeds) ? rssCfg.feeds as Array<Record<string, unknown>> : [];
    if (list.length === 0) return [];
    const results = await Promise.all(
        list.map((c) =>
            fetchRssFeed({
                id: String(c.id ?? ""),
                url: String(c.url ?? ""),
                label: String(c.label ?? ""),
                limit: clampLimit(c.limit ?? 10),
            }),
        ),
    );
    return results;
}

export function mockRssPayload(): Record<string, unknown> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    return {
        ok: true,
        error: null,
        updated_at: utcNow(),
        feeds: [
            {
                id: "demo",
                label: "Notícias",
                url: "https://example.com/rss.xml",
                limit: 10,
                ok: true,
                error: null,
                title: "Notícias Demo",
                description: "Feed de demonstração",
                link: "https://example.com",
                items: [
                    { title: "Vigia AI ganha novo card de RSS", link: "https://example.com/1", description: "Agora você pode acompanhar seus feeds favoritos direto no painel.", pubDate: now.toISOString(), author: "Equipe Vigia", categories: ["tecnologia"], guid: "1", enclosure: null },
                    { title: "Como configurar seus feeds", link: "https://example.com/2", description: "Adicione URLs de RSS/Atom nas configurações.", pubDate: hourAgo.toISOString(), author: null, categories: [], guid: "2", enclosure: null },
                    { title: "Dica: use feeds Atom também", link: "https://example.com/3", description: "O card suporta RSS 2.0 e Atom.", pubDate: yesterday.toISOString(), author: null, categories: ["dica"], guid: "3", enclosure: null },
                ],
                updated_at: utcNow(),
            },
        ],
    };
}

export const clampRssLimit = clampLimit;
export const parse_rss = parseFeed;
export const fetch_rss_feed = fetchRssFeed;
export const fetch_rss_feeds = fetchRssFeeds;
export const mock_rss_payload = mockRssPayload;
