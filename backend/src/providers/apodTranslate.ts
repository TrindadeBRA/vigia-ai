/**
 * Tradução gratuita do texto do APOD (MyMemory, sem chave).
 * Só usada na página de detalhes — não entra no contrato /usage.
 * Limite anônimo ~1000 palavras/dia; um APOD por dia cabe folgado.
 * GET do MyMemory aceita ~500 caracteres em `q` — o texto é fatiado em frases.
 */
const MYMEMORY_URL = "https://api.mymemory.translated.net/get";
const MAX_CHUNK = 450;
const FETCH_TIMEOUT_MS = 12_000;

const cache = new Map<string, string>();

export type TranslateFetcher = (url: string, init?: RequestInit) => Promise<Response>;

export function mymemoryLangPair(lang: string): string | null {
  if (lang === "pt") return "en|pt-BR";
  if (lang === "es") return "en|es";
  return null;
}

export function splitForMyMemory(text: string, max = MAX_CHUNK): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= max) return [trimmed];

  const parts: string[] = [];
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  let buf = "";
  for (const sentence of sentences) {
    if (sentence.length > max) {
      if (buf) {
        parts.push(buf);
        buf = "";
      }
      for (let i = 0; i < sentence.length; i += max) {
        parts.push(sentence.slice(i, i + max));
      }
      continue;
    }
    const next = buf ? `${buf} ${sentence}` : sentence;
    if (next.length > max) {
      parts.push(buf);
      buf = sentence;
    } else {
      buf = next;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

export function clearApodTranslateCache(): void {
  cache.clear();
}

async function translateChunk(chunk: string, langpair: string, fetcher: TranslateFetcher): Promise<string> {
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(langpair)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetcher(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "VigiaAI/1.0 (apod-translate)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    const translated = data.responseData?.translatedText;
    if (typeof translated !== "string" || !translated.trim()) {
      throw new Error("tradução vazia");
    }
    if (translated.toUpperCase().startsWith("MYMEMORY WARNING")) {
      throw new Error(translated.slice(0, 160));
    }
    return translated.trim();
  } finally {
    clearTimeout(timer);
  }
}

export async function translateApodExplanation(
  text: string,
  lang: string,
  fetcher: TranslateFetcher = fetch,
): Promise<string> {
  const pair = mymemoryLangPair(lang);
  if (!pair) return text;
  const source = text.trim();
  if (!source) return "";
  const key = `${lang}:${source}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const chunks = splitForMyMemory(source);
  const out: string[] = [];
  for (const chunk of chunks) {
    out.push(await translateChunk(chunk, pair, fetcher));
  }
  const joined = out.join(" ").replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  cache.set(key, joined);
  return joined;
}
