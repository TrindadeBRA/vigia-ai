import { useCallback, useEffect, useState } from "react";
import { fetchCameras, removeCamera } from "../api/client";
import type { CameraItem } from "../api/types";

// Câmeras mudam pouco — poll de fundo mais espaçado que o padrão de 15s.
// O refresh no foco/visibilitychange cobre "voltei pra aba, quero ver na
// hora"; o poll é só rede de segurança pra edição feita em Configurações
// enquanto esta aba fica parada olhando o board.
const POLL_MS = 60000;

async function fetchCamerasQuiet(): Promise<CameraItem[]> {
  try {
    return await fetchCameras();
  } catch {
    return [];
  }
}

export function useCameras() {
  const [items, setItems] = useState<CameraItem[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const cameras = await fetchCamerasQuiet();
    setItems(cameras);
    setReady(true);
    return cameras;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function tick() {
      if (!document.hidden) {
        const cameras = await fetchCamerasQuiet();
        if (cancelled) return;
        setItems(cameras);
        setReady(true);
      }
      timer = window.setTimeout(tick, POLL_MS);
    }

    tick();

    const onFocus = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    try {
      await removeCamera(id);
    } catch {
      /* ignore */
    }
    await refresh();
  }, [refresh]);

  return { items, ready, refresh, remove };
}
