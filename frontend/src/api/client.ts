import type { ConfigPublic, UsagePayload } from "./types";

export async function fetchUsage(): Promise<UsagePayload> {
  const res = await fetch("/usage", { cache: "no-store" });
  if (!res.ok) throw new Error(`usage HTTP ${res.status}`);
  return res.json() as Promise<UsagePayload>;
}

export async function fetchConfig(): Promise<ConfigPublic> {
  const res = await fetch("/api/config", { cache: "no-store" });
  if (!res.ok) throw new Error(`config HTTP ${res.status}`);
  return res.json() as Promise<ConfigPublic>;
}

export async function patchConfig(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; restart_needed_for_port?: boolean }> {
  const res = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; restart_needed_for_port?: boolean }>;
}

export async function addAccount(provider: string, label: string, secret: string) {
  const res = await fetch("/api/config/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, label, token: secret, key: secret }),
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

export async function deleteAccount(provider: string, id: string) {
  const res = await fetch(`/api/config/account/${provider}/${id}`, { method: "DELETE" });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

export async function clearSecret(name: string) {
  const res = await fetch(`/api/config/secret/${name}`, { method: "DELETE" });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}
