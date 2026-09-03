import { useEffect, useState } from "react";
import { fetchWallpaperProviders, patchWallpaperProviders } from "../../api/client";
import type { WallpaperProviderStatus } from "../../api/types";
import { ImageIcon } from "../../components/icons";
import { useRequest } from "../../hooks/useRequest";
import { cfgCard, cfgHint, iconChip } from "../../tw";
import type { ConfigCopy } from "./copy";
import { ActionRow, Button, FieldStatus, StatusPill, TextField } from "./ui";

const MASK = "•".repeat(24);

function typedKey(v: string): string | null {
  const t = v.trim();
  if (!t || t === MASK) return null;
  return t;
}

type Field = "pexels_key" | "unsplash_key" | "wallhaven_key";

function ProviderRow({
  name,
  hint,
  hasKey,
  optional,
  value,
  onChange,
  onClear,
  clearing,
  c,
}: {
  name: string;
  hint: string;
  hasKey: boolean;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  clearing: boolean;
  c: ConfigCopy;
}) {
  const pill = hasKey
    ? { state: "ok" as const, label: c.providerKeySaved }
    : optional
      ? { state: "ok" as const, label: c.providerAvailable }
      : { state: "missing" as const, label: c.providerNotConfigured };

  return (
    <div className="rounded-[12px] border border-edge bg-canvas p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink">{name}</span>
        <StatusPill state={pill.state} label={pill.label} />
      </div>
      <p className={cfgHint}>{hint}</p>
      <ActionRow>
        <TextField
          type="password"
          autoComplete="off"
          spellCheck={false}
          label={c.providerKeyLabel}
          value={value}
          placeholder={hasKey ? c.providerKeyReplacePlaceholder : c.providerKeyPlaceholder}
          onFocus={() => {
            if (value === MASK) onChange("");
          }}
          onBlur={() => {
            if (!value.trim() && hasKey) onChange(MASK);
          }}
          onChange={(e) => onChange(e.target.value)}
        />
        {hasKey ? (
          <Button variant="ghost" loading={clearing} onClick={onClear}>
            {clearing ? c.removing : c.providerRemoveKey}
          </Button>
        ) : null}
      </ActionRow>
      {hasKey && (value === MASK || !value.trim()) ? <p className={cfgHint}>{c.providerKeySavedHint}</p> : null}
    </div>
  );
}

export function WallpaperProvidersConfigCard({ c }: { c: ConfigCopy }) {
  const [providers, setProviders] = useState<WallpaperProviderStatus | null>(null);
  const [pexelsKey, setPexelsKey] = useState("");
  const [unsplashKey, setUnsplashKey] = useState("");
  const [wallhavenKey, setWallhavenKey] = useState("");
  const [clearingField, setClearingField] = useState<Field | null>(null);

  const load = useRequest();
  const save = useRequest();
  const clear = useRequest();

  async function fetchStatus() {
    setProviders(await fetchWallpaperProviders());
  }

  useEffect(() => {
    void load.run(fetchStatus, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPexelsKey(providers?.pexels.configured ? MASK : "");
    setUnsplashKey(providers?.unsplash.configured ? MASK : "");
    setWallhavenKey(providers?.wallhaven.has_key ? MASK : "");
  }, [providers?.pexels.configured, providers?.unsplash.configured, providers?.wallhaven.has_key]);

  const keysDirty = Boolean(typedKey(pexelsKey) || typedKey(unsplashKey) || typedKey(wallhavenKey));

  async function handleSave() {
    const body: Record<string, string> = {};
    const pexels = typedKey(pexelsKey);
    const unsplash = typedKey(unsplashKey);
    const wallhaven = typedKey(wallhavenKey);
    if (pexels) body.pexels_key = pexels;
    if (unsplash) body.unsplash_key = unsplash;
    if (wallhaven) body.wallhaven_key = wallhaven;
    if (Object.keys(body).length === 0) return { ok: true };
    const res = await patchWallpaperProviders(body);
    if (res.ok) await fetchStatus();
    return res;
  }

  async function handleClear(field: Field) {
    setClearingField(field);
    try {
      const res = await patchWallpaperProviders({ [field]: "" });
      if (res.ok) await fetchStatus();
      return res;
    } finally {
      setClearingField(null);
    }
  }

  if (!providers) return null;

  return (
    <article className={`${cfgCard} gap-3`}>
      <div className="flex items-start gap-3">
        <div className={iconChip}>
          <ImageIcon size={18} className="text-ink2" />
        </div>
        <div className="min-w-0">
          <h3 className="m-0 text-[15.5px] font-bold">{c.wallpaperProvidersTitle}</h3>
          <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{c.wallpaperProvidersLead}</p>
        </div>
      </div>

      <div className="grid gap-3">
        <ProviderRow
          c={c}
          name={c.providerPexels}
          hint={c.providerNeedsKey}
          hasKey={Boolean(providers.pexels.configured)}
          value={pexelsKey}
          onChange={setPexelsKey}
          onClear={() => void clear.run(() => handleClear("pexels_key"), { success: c.providerKeyRemoved, error: c.providerError })}
          clearing={clear.busy && clearingField === "pexels_key"}
        />
        <ProviderRow
          c={c}
          name={c.providerWallhaven}
          hint={c.providerOptionalKey}
          hasKey={Boolean(providers.wallhaven.has_key)}
          optional
          value={wallhavenKey}
          onChange={setWallhavenKey}
          onClear={() => void clear.run(() => handleClear("wallhaven_key"), { success: c.providerKeyRemoved, error: c.providerError })}
          clearing={clear.busy && clearingField === "wallhaven_key"}
        />
        <ProviderRow
          c={c}
          name={c.providerUnsplash}
          hint={c.providerNeedsKey}
          hasKey={Boolean(providers.unsplash.configured)}
          value={unsplashKey}
          onChange={setUnsplashKey}
          onClear={() => void clear.run(() => handleClear("unsplash_key"), { success: c.providerKeyRemoved, error: c.providerError })}
          clearing={clear.busy && clearingField === "unsplash_key"}
        />
      </div>

      <ActionRow>
        <Button disabled={!keysDirty} loading={save.busy} onClick={() => void save.run(handleSave, { success: c.providerSaved, error: c.providerError })}>
          {save.busy ? c.providerSaving : c.providerSave}
        </Button>
      </ActionRow>
      {save.message ? <FieldStatus status={save.status} message={save.message} /> : null}
      {clear.message ? <FieldStatus status={clear.status} message={clear.message} /> : null}
    </article>
  );
}
