import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { fetchConfig } from "../../api/client";
import type { ConfigPublic } from "../../api/types";
import type { Lang } from "../../i18n";
import { CONFIG_STR } from "./copy";

export type ConfigOutlet = { lang: Lang };

export function usePublicConfig() {
  const ctx = useOutletContext<ConfigOutlet | null>();
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

  return { c, cfg, phase, reload, setPhase };
}
