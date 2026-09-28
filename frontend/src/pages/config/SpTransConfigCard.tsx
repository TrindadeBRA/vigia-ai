import { useEffect, useState } from "react";
import {
  addSpTransStop,
  fetchSpTransCache,
  fetchSpTransGeolocate,
  fetchSpTransNearby,
  fetchSpTransPrevisao,
  fetchSpTransStatus,
  patchSpTransStop,
  refreshSpTransCache,
  removeSpTransStop,
  saveSpTransToken,
  searchSpTransStops,
} from "../../api/client";
import type { SpTransCacheStatus, SpTransLineForecast, SpTransMonitoredLine, SpTransStatus, SpTransStop, SpTransStopSearch } from "../../api/types";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useRequest } from "../../hooks/useRequest";
import { cfgCard, iconChip } from "../../tw";
import type { ConfigCopy } from "./copy";
import { Button, FieldStatus, Fold, TextField } from "./ui";

type SpTransConfig = { enabled: boolean; hidden: boolean; stops: SpTransStop[]; has_token?: boolean; suffix?: string | null };

function StopRow({ stop, c, onReload }: { stop: SpTransStop; c: ConfigCopy; onReload: () => Promise<void> }) {
  const remove = useRequest();
  const saveLines = useRequest();
  const saveNick = useRequest();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [nickname, setNickname] = useState(stop.nickname);
  const [allLines, setAllLines] = useState<SpTransLineForecast[] | null>(null);
  const [linesError, setLinesError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set(stop.lines.map((l) => l.cl)));

  useEffect(() => {
    let alive = true;
    setAllLines(null);
    setLinesError(null);
    fetchSpTransPrevisao(stop.cp)
      .then((prev) => {
        if (!alive) return;
        if (!prev.ok) {
          setLinesError(prev.error);
          return;
        }
        const map = new Map(prev.lines.map((l) => [l.cl, l]));
        const ordered = stop.lines.map((m) => map.get(m.cl)).filter((l): l is SpTransLineForecast => Boolean(l));
        for (const l of prev.lines) {
          if (!ordered.some((o) => o.cl === l.cl)) ordered.push(l);
        }
        setAllLines(ordered);
      })
      .catch((e: unknown) => {
        if (alive) setLinesError(e instanceof Error ? e.message : String(e));
      });
    return () => { alive = false; };
  }, [stop.cp, stop.lines]);

  const stopLabel = stop.nickname.trim() || stop.name || `Ponto ${stop.cp}`;

  function toggleLine(cl: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(cl)) next.delete(cl);
      else next.add(cl);
      return next;
    });
  }

  async function handleSaveLines() {
    const picked: SpTransMonitoredLine[] = (allLines ?? [])
      .filter((l) => checked.has(l.cl))
      .map((l) => ({ cl: l.cl, c: l.c, lt: "", tl: 10, sl: l.sl, lt0: l.lt0, lt1: l.lt1 }));
    await saveLines.run(async () => {
      const res = await patchSpTransStop(stop.id, { lines: picked });
      await onReload();
      return res;
    }, { success: c.sptransLinesSaved, error: c.offline });
  }

  return (
    <li className="flex flex-col gap-2 rounded-[10px] border border-edge bg-canvas px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-[650]">{stopLabel}</p>
          <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{stop.name} · {stop.cp}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" className="px-2 py-1 text-[11px]" loading={remove.busy} onClick={() => setConfirmingRemove(true)}>{remove.busy ? c.removing : c.remove}</Button>
        </div>
      </div>
      <TextField label={c.sptransNicknameLabel} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={c.sptransNicknamePh} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          loading={saveNick.busy}
          disabled={nickname.trim() === stop.nickname.trim()}
          onClick={() => saveNick.run(async () => { const r = await patchSpTransStop(stop.id, { nickname: nickname.trim() }); await onReload(); return r; }, { success: c.saved, error: c.offline })}
        >
          {saveNick.busy ? c.saving : c.save}
        </Button>
      </div>
      {saveNick.message ? <FieldStatus status={saveNick.status} message={saveNick.message} /> : null}
      <div className="border-t border-edge pt-2">
        <p className="m-0 mb-1.5 text-[12px] font-[650]">{c.sptransLinesLabel}</p>
        <p className="m-0 mb-2 text-[11px] leading-snug text-ink3">{c.sptransLinesHint}</p>
        {allLines === null && !linesError ? <p className="m-0 text-xs text-ink3">…</p> : null}
        {linesError ? <p className="m-0 text-xs text-bad">{linesError}</p> : null}
        {allLines?.length ? (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {allLines.map((l) => (
              <li key={l.cl}>
                <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
                  <input type="checkbox" checked={checked.has(l.cl)} onChange={() => toggleLine(l.cl)} className="size-4 accent-[var(--accent)]" />
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    <strong>{l.c}</strong> <span className="text-ink2">{l.lt0 || l.lt1}</span>
                  </span>
                  {l.next ? <span className="shrink-0 text-[11px] font-bold text-ink">{l.next.t}</span> : null}
                </label>
              </li>
            ))}
          </ul>
        ) : null}
        {allLines !== null && !allLines.length && !linesError ? <p className="m-0 text-xs text-ink3">{c.sptransNoResults}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button loading={saveLines.busy} onClick={() => void handleSaveLines()}>{saveLines.busy ? c.saving : c.save}</Button>
        </div>
        {saveLines.message ? <FieldStatus status={saveLines.status} message={saveLines.message} /> : null}
      </div>
      {remove.message ? <FieldStatus status={remove.status} message={remove.message} /> : null}
      <ConfirmModal
        open={confirmingRemove}
        title={c.confirmRemoveTitle}
        body={c.confirmRemoveBody(stopLabel)}
        confirmLabel={c.remove}
        cancelLabel={c.cancel}
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={() => {
          setConfirmingRemove(false);
          void remove.run(async () => { const r = await removeSpTransStop(stop.id); await onReload(); return r; }, { success: c.removed, error: c.offline });
        }}
      />
    </li>
  );
}

export function SpTransConfigCard({ sptrans, c, onReload }: { sptrans: SpTransConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<SpTransStatus | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpTransStopSearch[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const [nearbyLabel, setNearbyLabel] = useState<string | null>(null);
  const [cache, setCache] = useState<SpTransCacheStatus | null>(null);

  const saveToken = useRequest();
  const search = useRequest();
  const locate = useRequest();
  const refreshCache = useRequest();
  const add = useRequest();

  const stops = sptrans?.stops ?? [];
  const hint = stops.length ? `${stops.length} ponto${stops.length === 1 ? "" : "s"}` : c.sptransEmpty;

  useEffect(() => {
    fetchSpTransStatus().then(setStatus).catch(() => undefined);
    fetchSpTransCache().then(setCache).catch(() => undefined);
  }, []);

  async function handleSaveToken() {
    const t = token.trim();
    if (!t) return;
    await saveToken.run(async () => {
      const res = await saveSpTransToken(t);
      if (res.ok) {
        setToken("");
        const st = await fetchSpTransStatus().catch(() => null);
        if (st) setStatus(st);
        await onReload();
      }
      return res;
    }, { success: c.sptransTokenSaved, error: c.offline });
  }

  async function handleSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    setSearched(false);
    setResults(null);
    setGeoLabel(null);
    setNearbyLabel(null);
    await search.run(async () => {
      try {
        const { results: list, geo } = await searchSpTransStops(q);
        setResults(list);
        setGeoLabel(geo ? geo.label : null);
        setSearched(true);
        return { ok: true };
      } catch (e) {
        setSearched(true);
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }, { error: c.offline });
  }

  function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error(c.sptransLocationFail));
        return;
      }
      // No Electron o Chromium não tem provider de geolocalização e o
      // callback pode nunca disparar — timeout próprio garante resposta.
      const timer = window.setTimeout(() => reject(new Error(c.sptransLocationFail)), 8000);
      navigator.geolocation.getCurrentPosition(
        (pos) => { window.clearTimeout(timer); resolve(pos); },
        () => { window.clearTimeout(timer); reject(new Error(c.sptransLocationFail)); },
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000,
        },
      );
    });
  }

  async function handleLocation() {
    setSearched(false);
    setResults(null);
    setGeoLabel(null);
    setNearbyLabel(null);
    await locate.run(async () => {
      try {
        const pos = await getPosition();
        const list = await fetchSpTransNearby(pos.coords.latitude, pos.coords.longitude, 10);
        setResults(list);
        setNearbyLabel(c.sptransNearbyLabel);
        setSearched(true);
        return { ok: true };
      } catch {
        try {
          const geo = await fetchSpTransGeolocate();
          const list = await fetchSpTransNearby(geo.lat, geo.lng, 10);
          setResults(list);
          setNearbyLabel(`${c.sptransLocationApprox}${geo.city ? ` · ${geo.city}` : ""}`);
          setSearched(true);
          return { ok: true };
        } catch (e) {
          setSearched(true);
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }
    }, { error: c.offline });
  }

  async function handleRefreshCache() {
    await refreshCache.run(async () => {
      const res = await refreshSpTransCache();
      if (res.ok) {
        const st = await fetchSpTransCache().catch(() => null);
        if (st) setCache(st);
      }
      return res;
    }, { success: c.saved, error: c.offline });
  }

  async function handleAdd(cp: number) {
    await add.run(async () => {
      const res = await addSpTransStop({ cp });
      if (res.ok) await onReload();
      return res;
    }, { success: c.sptransStopAdded, error: c.offline });
  }

  const configured = status?.configured ?? Boolean(sptrans?.has_token);

  return (
    <article id="cfg-sptrans" className={`${cfgCard} gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={iconChip}>
            <span className="text-[18px]">🚌</span>
          </div>
          <div className="min-w-0">
            <h3 className="m-0 text-[15.5px] font-bold">{c.sptransTitle}</h3>
            <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
          </div>
        </div>
      </div>
      {saveToken.message ? <FieldStatus status={saveToken.status} message={saveToken.message} /> : null}

      <p className="m-0 text-[12.5px] leading-[1.5] text-ink2">{c.sptransLead}</p>

      <div className="flex flex-col gap-2">
        <TextField label={c.sptransTokenLabel} value={token} onChange={(e) => setToken(e.target.value)} placeholder={c.sptransTokenPh} autoComplete="off" hint={c.sptransTokenHint} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" loading={saveToken.busy} disabled={!token.trim()} onClick={() => void handleSaveToken()}>
            {saveToken.busy ? c.saving : c.sptransSaveToken}
          </Button>
          <span className="text-[11px] text-ink3">
            {configured ? `${c.sptransTokenConfigured}${status?.suffix ? ` (${status.suffix})` : sptrans?.suffix ? ` (${sptrans.suffix})` : ""}` : c.sptransTokenMissing}
          </span>
        </div>
      </div>

      <Fold summary={c.sptransSearchLabel}>
        <div className="flex flex-col gap-2">
          <TextField label={c.sptransSearchLabel} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.sptransSearchPh} autoComplete="off" />
          <p className="m-0 text-[11px] leading-snug text-ink3">{c.sptransSearchHint}</p>
          <div className="flex items-center justify-between gap-2 rounded-[10px] border border-edge bg-canvas px-3 py-2">
            <span className="text-[11px] text-ink3">
              {cache?.ready ? c.sptransCacheReady(cache.count) : c.sptransCacheEmpty}
            </span>
            <Button variant="ghost" className="shrink-0 px-2 py-1 text-[11px]" loading={refreshCache.busy} disabled={!configured} onClick={() => void handleRefreshCache()}>
              {refreshCache.busy ? c.sptransCacheRefreshing : c.sptransCacheRefresh}
            </Button>
          </div>
          {refreshCache.message ? <FieldStatus status={refreshCache.status} message={refreshCache.message} /> : null}
          {!configured ? <p className="m-0 text-[11px] leading-snug text-warn">{c.sptransNeedToken}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={search.busy} disabled={query.trim().length < 2 || !configured} onClick={() => void handleSearch()}>
              {search.busy ? c.sptransSearching : c.sptransSearch}
            </Button>
            <Button variant="secondary" loading={locate.busy} disabled={!configured} onClick={() => void handleLocation()}>
              {locate.busy ? c.sptransLocating : c.sptransUseLocation}
            </Button>
          </div>
          {search.message ? <FieldStatus status={search.status} message={search.message} /> : null}
          {locate.message ? <FieldStatus status={locate.status} message={locate.message} /> : null}
          {searched && (geoLabel || nearbyLabel) ? (
            <p className="m-0 text-[11px] font-[650] text-ink2">{geoLabel ? c.sptransNearLabel(geoLabel) : nearbyLabel}</p>
          ) : null}
          {searched && results !== null ? (
            results.length ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {results.map((r) => {
                  const already = stops.some((s) => s.cp === r.cp);
                  return (
                    <li key={r.cp} className="flex items-center justify-between gap-2 rounded-[10px] border border-edge bg-canvas px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[650]">{r.np}</p>
                        <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">
                          {r.distance_m != null ? `${c.sptransAtDistance(r.distance_m)} · ` : ""}{r.ed} · {r.cp}
                        </p>
                      </div>
                      <Button variant="ghost" className="shrink-0 px-2 py-1 text-[11px]" loading={add.busy} disabled={already} onClick={() => void handleAdd(r.cp)}>
                        {already ? "✓" : c.sptransAddStop}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="m-0 text-xs text-ink3">{c.sptransNoResults}</p>
            )
          ) : null}
          {add.message ? <FieldStatus status={add.status} message={add.message} /> : null}
        </div>
      </Fold>

      <Fold summary={`${c.sptransStopsLabel} (${stops.length})`}>
        {stops.length ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {stops.map((stop) => (
              <StopRow key={stop.id} stop={stop} c={c} onReload={onReload} />
            ))}
          </ul>
        ) : (
          <p className="m-0 text-xs text-ink3">{c.sptransEmpty}</p>
        )}
      </Fold>
    </article>
  );
}
