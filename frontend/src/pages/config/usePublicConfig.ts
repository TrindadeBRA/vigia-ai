import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { fetchConfig } from "../../api/client";
import type { ConfigPublic } from "../../api/types";
import type { UsagePayload } from "../../api/types";
import type { Lang } from "../../i18n";
import { CONFIG_STR } from "./copy";

export type DisplayOutlet = {
  lang: Lang;
  data: UsagePayload | null;
  nowMs: number;
  driftMs: number;
};

/** @deprecated use DisplayOutlet */
export type ConfigOutlet = Pick<DisplayOutlet, "lang">;

export function usePublicConfig() {
  const ctx = useOutletContext<DisplayOutlet | ConfigOutlet | null>();
  const c = CONFIG_STR[ctx?.lang || "pt"];
  const [cfg, setCfg] = useState<ConfigPublic | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  const reload = useCallback(async () => {
    try {
      const d = await fetchConfig();
      setCfg(d);
      setPhase("ready");
    } catch {
      setPhase((p) => (p === "ready" ? "ready" : "error"));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { c, cfg, phase, reload, setPhase, lang: ctx?.lang || "pt" };
}
