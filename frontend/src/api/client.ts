import type { AlarmRule, AlarmsPublic, ConfigPublic, UsagePayload } from "./types";

export async function fetchUsage(): Promise<UsagePayload> {
  const res = await fetch("/usage", { cache: "no-store" });
  if (!res.ok) throw new Error(`usage HTTP ${res.status}`);
  return res.json() as Promise<UsagePayload>;
}

export async function fetchHealth(): Promise<{ interval_s?: number }> {
  const res = await fetch("/health", { cache: "no-store" });
  if (!res.ok) throw new Error(`health HTTP ${res.status}`);
  return res.json() as Promise<{ interval_s?: number }>;
}

/** Stream SSE do contrato JSON. O browser reconecta sozinho. */
export function openUsageEvents(onPayload: (data: UsagePayload) => void, onFail: () => void): () => void {
  const es = new EventSource("/events");
  const onUsage = (ev: MessageEvent<string>) => {
    try {
      onPayload(JSON.parse(ev.data) as UsagePayload);
    } catch {
      onFail();
    }
  };
  es.addEventListener("usage", onUsage as EventListener);
  es.onmessage = onUsage;
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) onFail();
  };
  return () => {
    es.removeEventListener("usage", onUsage as EventListener);
    es.onmessage = null;
    es.onerror = null;
    es.close();
  };
}

type MutateResult = { ok: boolean; error?: string; restart_needed_for_port?: boolean };

function errorFromBody(data: { detail?: unknown; error?: string }, status: number): string {
  if (typeof data.error === "string" && data.error) return data.error;
  if (typeof data.detail === "string" && data.detail) return data.detail;
  return `HTTP ${status}`;
}

async function readMutate(res: Response): Promise<MutateResult> {
  const data = (await res.json().catch(() => ({}))) as MutateResult & { detail?: unknown };
  if (!res.ok) return { ok: false, error: errorFromBody(data, res.status) };
  return data;
}

export async function fetchConfig(): Promise<ConfigPublic> {
  const res = await fetch("/api/config", { cache: "no-store" });
  if (!res.ok) throw new Error(`config HTTP ${res.status}`);
  return res.json() as Promise<ConfigPublic>;
}

export async function patchConfig(body: Record<string, unknown>): Promise<MutateResult> {
  const res = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readMutate(res);
}

export async function addAccount(provider: string, label: string, secret: string) {
  const res = await fetch("/api/config/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, label, token: secret, key: secret }),
  });
  return readMutate(res);
}

export async function deleteAccount(provider: string, id: string) {
  const res = await fetch(`/api/config/account/${provider}/${id}`, { method: "DELETE" });
  return readMutate(res);
}

export async function clearSecret(name: string) {
  const res = await fetch(`/api/config/secret/${name}`, { method: "DELETE" });
  return readMutate(res);
}

export async function fetchAlarms(): Promise<AlarmsPublic> {
  const res = await fetch("/api/alarms", { cache: "no-store" });
  if (!res.ok) throw new Error(`alarms HTTP ${res.status}`);
  return res.json() as Promise<AlarmsPublic>;
}

export async function createAlarm(body: { provider: string; metric: string; threshold: number; label?: string }) {
  const res = await fetch("/api/alarms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as (AlarmRule & { detail?: unknown }) | { detail?: unknown };
  if (!res.ok) return { ok: false, error: errorFromBody(data as { detail?: unknown }, res.status) };
  return { ok: true, rule: data as AlarmRule };
}

export async function patchAlarm(id: string, body: { threshold?: number; enabled?: boolean; label?: string }) {
  const res = await fetch(`/api/alarms/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readMutate(res);
}

export async function deleteAlarm(id: string) {
  const res = await fetch(`/api/alarms/${id}`, { method: "DELETE" });
  return readMutate(res);
}

export async function fetchVapidPublicKey(): Promise<{ public_key: string }> {
  const res = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
  if (!res.ok) throw new Error(`vapid HTTP ${res.status}`);
  return res.json() as Promise<{ public_key: string }>;
}

export async function subscribePush(body: { endpoint: string; p256dh: string; auth: string; ua: string }) {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readMutate(res);
}

export async function unsubscribePush(endpoint: string) {
  const res = await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  return readMutate(res);
}

export async function testPush() {
  const res = await fetch("/api/push/test", { method: "POST" });
  return readMutate(res);
}

export async function fetchTelegramStatus(): Promise<import("./types").TelegramStatus> {
  const res = await fetch("/api/telegram/status", { cache: "no-store" });
  if (!res.ok) throw new Error(`telegram status HTTP ${res.status}`);
  return res.json() as Promise<import("./types").TelegramStatus>;
}

export async function saveTelegramToken(bot_token: string) {
  const res = await fetch("/api/telegram/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_token }),
  });
  return readMutate(res);
}

export async function clearTelegramToken() {
  const res = await fetch("/api/telegram/token/clear", { method: "POST" });
  return readMutate(res);
}

export async function removeTelegramChat(chat_id: string) {
  const res = await fetch("/api/telegram/chats/remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id }),
  });
  return readMutate(res);
}

export async function testTelegram() {
  const res = await fetch("/api/telegram/test", { method: "POST" });
  return readMutate(res);
}

// ── Weather ──────────────────────────────────────────────────────────

export async function fetchWeatherConfig(): Promise<import("./types").WeatherConfig> {
  const res = await fetch("/api/weather/config", { cache: "no-store" });
  if (!res.ok) throw new Error(`weather config HTTP ${res.status}`);
  return res.json() as Promise<import("./types").WeatherConfig>;
}

export async function patchWeatherConfig(body: Record<string, unknown>): Promise<MutateResult & { data?: unknown }> {
  const res = await fetch("/api/weather/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as MutateResult & { detail?: unknown };
  if (!res.ok) return { ok: false, error: errorFromBody(data, res.status) };
  return { ok: true, data };
}

export async function searchCities(q: string, count = 5): Promise<import("./types").WeatherGeocodingResult[]> {
  const res = await fetch(`/api/weather/geocoding?q=${encodeURIComponent(q)}&count=${count}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`geocoding HTTP ${res.status}`);
  const data = (await res.json()) as { results?: import("./types").WeatherGeocodingResult[] };
  return data.results || [];
}

export async function setWeatherLocation(body: { name: string; latitude: number; longitude: number; country?: string; country_code?: string; timezone?: string; elevation?: number | null }): Promise<MutateResult> {
  const res = await fetch("/api/weather/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readMutate(res);
}

export async function fetchWeather(): Promise<import("./types").WeatherPayload> {
  const res = await fetch("/api/weather", { cache: "no-store" });
  if (!res.ok) throw new Error(`weather HTTP ${res.status}`);
  return res.json() as Promise<import("./types").WeatherPayload>;
}

// ── Cotação de moedas ───────────────────────────────────────────────

export async function fetchCurrenciesConfig(): Promise<import("./types").CurrenciesConfig> {
  const res = await fetch("/api/currencies/config", { cache: "no-store" });
  if (!res.ok) throw new Error(`currencies config HTTP ${res.status}`);
  return res.json() as Promise<import("./types").CurrenciesConfig>;
}

export async function patchCurrenciesConfig(body: { enabled?: boolean; hidden?: boolean; base?: string }): Promise<MutateResult> {
  const res = await fetch("/api/currencies/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as MutateResult & { detail?: unknown };
  if (!res.ok) return { ok: false, error: errorFromBody(data, res.status) };
  return { ok: true };
}

export async function addCurrencyItem(body: { kind: "fiat" | "crypto"; code: string; label?: string }): Promise<MutateResult> {
  const res = await fetch("/api/currencies/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as MutateResult & { detail?: unknown };
  if (!res.ok) return { ok: false, error: errorFromBody(data, res.status) };
  return { ok: true };
}

export async function deleteCurrencyItem(id: string): Promise<MutateResult> {
  const res = await fetch(`/api/currencies/items/${id}`, { method: "DELETE" });
  return readMutate(res);
}

export async function searchCurrencyCoins(q: string, count = 8): Promise<import("./types").CurrencySearchResult[]> {
  const res = await fetch(`/api/currencies/search?q=${encodeURIComponent(q)}&count=${count}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`currencies search HTTP ${res.status}`);
  const data = (await res.json()) as { results?: import("./types").CurrencySearchResult[] };
  return data.results || [];
}

export async function fetchCurrencies(): Promise<import("./types").CurrenciesPayload> {
  const res = await fetch("/api/currencies", { cache: "no-store" });
  if (!res.ok) throw new Error(`currencies HTTP ${res.status}`);
  return res.json() as Promise<import("./types").CurrenciesPayload>;
}
