import { useEffect, useState } from "react";
import { fetchWallpaperProviders, patchWallpaperProviders } from "../../api/client";
import type { WallpaperProviderStatus } from "../../api/types";
import { ImageIcon } from "../../components/icons";
import { useRequest } from "../../hooks/useRequest";
import { cfgCard, cfgHint, iconChip } from "../../tw";
import type { ConfigCopy } from "./copy";
import { ActionRow, Button, FieldStatus, StatusPill, TextField } from "./ui";

const MASK = "•".repeat(24);

type Field = "pexels_key" | "unsplash_key" | "wallhaven_key" | "giphy_key";

function WallpaperProviderCard({
  name,
  hint,
  hasKey,
  optional,
  c,
  onSave,
  onClear,
}: {
  name: string;
  hint: string;
  hasKey: boolean;
  optional?: boolean;
  c: ConfigCopy;
  onSave: (v: string) => Promise<{ ok: boolean; error?: string }>;
  onClear: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [value, setValue] = useState(hasKey ? MASK : "");
  const save = useRequest();
  const clear = useRequest();

  useEffect(() => {
    setValue(hasKey ? MASK : "");
  }, [hasKey]);

  const ready = Boolean(value.trim()) && value !== MASK;
  const pill = hasKey
    ? { state: "ok" as const, label: c.providerKeySaved }
    : optional
      ? { state: "ok" as const, label: c.providerAvailable }
      : { state: "missing" as const, label: c.providerNotConfigured };
  const lastMsg = save.message ? save : clear.message ? clear : null;

  return (
    <article className={`${cfgCard} gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={iconChip}>
            <ImageIcon size={18} className="text-ink2" />
          </div>
          <div className="min-w-0">
            <h3 className="m-0 text-[15.5px] font-bold">{name}</h3>
            <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
          </div>
        </div>
        <StatusPill state={pill.state} label={pill.label} />
      </div>

      <ActionRow>
        <TextField
          type="password"
          autoComplete="off"
          spellCheck={false}
          label={c.providerKeyLabel}
          value={value}
          placeholder={hasKey ? c.providerKeyReplacePlaceholder : c.providerKeyPlaceholder}
          onFocus={() => {
            if (value === MASK) setValue("");
          }}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          loading={save.busy}
          disabled={!ready}
          onClick={async () => {
            const v = value.trim();
            if (!v || v === MASK) return;
            const out = await save.run(() => onSave(v), { success: c.providerSaved, error: c.providerError });
            if (out?.ok) setValue(MASK);
          }}
        >
          {save.busy ? c.providerSaving : c.providerSave}
        </Button>
        {hasKey ? (
          <Button variant="ghost" loading={clear.busy} onClick={() => void clear.run(onClear, { success: c.providerKeyRemoved, error: c.providerError })}>
            {clear.busy ? c.removing : c.providerRemoveKey}
          </Button>
        ) : null}
      </ActionRow>
      {hasKey && (value === MASK || !value.trim()) ? <p className={cfgHint}>{c.providerKeySavedHint}</p> : null}

      {lastMsg ? <FieldStatus status={lastMsg.status} message={lastMsg.message} /> : null}
    </article>
  );
}

export function WallpaperProviderCards({ c }: { c: ConfigCopy }) {
  const [providers, setProviders] = useState<WallpaperProviderStatus | null>(null);

  async function reload() {
    setProviders(await fetchWallpaperProviders());
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveField(field: Field, value: string) {
    const res = await patchWallpaperProviders({ [field]: value });
    if (res.ok) await reload();
    return res;
  }

  async function clearField(field: Field) {
    const res = await patchWallpaperProviders({ [field]: "" });
    if (res.ok) await reload();
    return res;
  }

  if (!providers) return null;

  return (
    <>
      <WallpaperProviderCard
        c={c}
        name={c.providerPexels}
        hint={c.providerNeedsKey}
        hasKey={Boolean((providers as unknown as Record<string, { configured?: boolean }>).pexels?.configured)}
        onSave={(v) => saveField("pexels_key", v)}
        onClear={() => clearField("pexels_key")}
      />
      <WallpaperProviderCard
        c={c}
        name={c.providerWallhaven}
        hint={c.providerOptionalKey}
        hasKey={Boolean(
          (providers as unknown as Record<string, { configured?: boolean; has_key?: boolean }>).wallhaven?.has_key ??
          (providers as unknown as Record<string, { configured?: boolean }>).wallhaven?.configured,
        )}
        optional
        onSave={(v) => saveField("wallhaven_key", v)}
        onClear={() => clearField("wallhaven_key")}
      />
      <WallpaperProviderCard
        c={c}
        name={c.providerUnsplash}
        hint={c.providerNeedsKey}
        hasKey={Boolean((providers as unknown as Record<string, { configured?: boolean }>).unsplash?.configured)}
        onSave={(v) => saveField("unsplash_key", v)}
        onClear={() => clearField("unsplash_key")}
      />
      <WallpaperProviderCard
        c={c}
        name="Giphy"
        hint={c.providerNeedsKey}
        hasKey={Boolean((providers as unknown as Record<string, { configured?: boolean }>).giphy?.configured)}
        onSave={(v) => saveField("giphy_key", v)}
        onClear={() => clearField("giphy_key")}
      />
    </>
  );
}
