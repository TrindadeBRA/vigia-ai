// Guard SSRF para download de imagens externas (wallpapers) — SECURITY_REVIEW.md Finding 1.
// Três camadas, todas obrigatórias: (1) resolve o hostname e bloqueia IP privado/loopback/
// link-local/reservado/multicast, (2) revalida a URL a cada hop de redirect (fetch com
// redirect:"manual"), (3) limite de download via truncamento de stream, não só pós-download.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_DOWNLOAD_BYTES = 10_000_000;

export async function isBlockedHost(hostname: string): Promise<boolean> {
  const host = (hostname ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost") return true;
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return true;
  }
  for (const info of addresses) {
    const rawIp = info.address.split("%")[0];
    const fam = isIP(rawIp);
    if (!fam) return true;
    if (isBlockedIp(rawIp)) return true;
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  // IPv4 checks
  if (isIP(ip) === 4) {
    const parts = ip.split(".").map((x) => parseInt(x, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    // private 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // loopback 127.0.0.0/8
    if (a === 127) return true;
    // link-local 169.254.0.0/16
    if (a === 169 && b === 254) return true;
    // unspecified 0.0.0.0/8
    if (a === 0) return true;
    // multicast 224.0.0.0/4
    if (a >= 224 && a <= 239) return true;
    // reserved 240.0.0.0/4
    if (a >= 240) return true;
    // broadcast 255.255.255.255
    if (ip === "255.255.255.255") return true;
    return false;
  }
  if (isIP(ip) === 6) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true;
    if (low.startsWith("fe80:")) return true; // link-local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique local
    if (low.startsWith("ff")) return true; // multicast
    if (low === "::ffff:127.0.0.1") return true;
    // unspecified :: already handled
    return false;
  }
  return true;
}

export async function validatePublicUrl(url: string): Promise<void> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw Object.assign(new Error("URL deve ser http:// ou https://"), { statusCode: 400 }); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw Object.assign(new Error("URL deve ser http:// ou https://"), { statusCode: 400 });
  if (!parsed.hostname || await isBlockedHost(parsed.hostname)) throw Object.assign(new Error("host da URL não permitido"), { statusCode: 400 });
}

// fetch with manual redirect revalidation per hop and 10MB limit via stream truncation
export async function downloadImage(url: string, timeout = 15_000): Promise<Buffer> {
  await validatePublicUrl(url);
  let current = url;
  let redirects = 0;
  const maxRedirects = 5;
  while (true) {
    const resp = await fetch(current, {
      headers: { "User-Agent": "Mozilla/5.0 (VigiaAI/1.0)" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeout),
    });
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) throw Object.assign(new Error(`falha ao baixar imagem: redirect sem location`), { statusCode: 502 });
      const next = new URL(loc, current).toString();
      await validatePublicUrl(next);
      current = next;
      redirects++;
      if (redirects > maxRedirects) throw Object.assign(new Error("muitos redirects"), { statusCode: 502 });
      continue;
    }
    if (!resp.ok) {
      throw Object.assign(new Error(`falha ao baixar imagem: HTTP ${resp.status}`), { statusCode: 502 });
    }
    // 10MB limit via stream truncation: check content-length then read
    const cl = resp.headers.get("content-length");
    if (cl && parseInt(cl, 10) > MAX_DOWNLOAD_BYTES) throw Object.assign(new Error("imagem muito grande"), { statusCode: 413 });
    // read with limit
    const reader = resp.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > MAX_DOWNLOAD_BYTES) throw Object.assign(new Error("imagem muito grande"), { statusCode: 413 });
          chunks.push(value);
        }
      }
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      return buf;
    } else {
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.byteLength > MAX_DOWNLOAD_BYTES) throw Object.assign(new Error("imagem muito grande"), { statusCode: 413 });
      return buf;
    }
  }
}

export async function httpJson(url: string, headers: Record<string, string> = {}, timeout = 15_000): Promise<unknown> {
  await validatePublicUrl(url);
  let current = url;
  let redirects = 0;
  while (true) {
    const resp = await fetch(current, {
      headers: { ...headers, "User-Agent": headers["User-Agent"] ?? "Mozilla/5.0 (VigiaAI/1.0)" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeout),
    });
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) throw new Error(`redirect sem location`);
      const next = new URL(loc, current).toString();
      await validatePublicUrl(next);
      current = next;
      redirects++;
      if (redirects > 5) throw new Error("muitos redirects");
      continue;
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw Object.assign(new Error(`API erro ${resp.status}: ${body.slice(0, 500)}`), { statusCode: resp.status });
    }
    const raw = await resp.text();
    try { return JSON.parse(raw); } catch (e) { throw Object.assign(new Error(`API JSON inválido: ${e}`), { statusCode: 502 }); }
  }
}
