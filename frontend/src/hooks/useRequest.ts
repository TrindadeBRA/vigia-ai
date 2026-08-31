import { useCallback, useEffect, useRef, useState } from "react";

export type RequestStatus = "idle" | "loading" | "success" | "error";

type ResultLike = { ok?: boolean; error?: string };

type RunOpts<T> = {
  success?: string | ((result: T) => string);
  error?: string;
};

export function useRequest() {
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [message, setMessage] = useState("");
  const timerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const fail = useCallback((msg: string) => {
    window.clearTimeout(timerRef.current);
    setStatus("error");
    setMessage(msg);
  }, []);

  const run = useCallback(async <T extends ResultLike | void>(fn: () => Promise<T>, opts: RunOpts<T> = {}): Promise<T | undefined> => {
    window.clearTimeout(timerRef.current);
    setStatus("loading");
    setMessage("");
    try {
      const result = await fn();
      const failed = Boolean(result && typeof result === "object" && "ok" in result && result.ok === false);
      if (failed) {
        const err = (result && typeof result === "object" && result.error) || opts.error || "";
        setStatus("error");
        setMessage(err);
        return result;
      }
      const successMsg = typeof opts.success === "function" ? opts.success(result) : opts.success || "";
      setStatus("success");
      setMessage(successMsg);
      timerRef.current = window.setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 2800);
      return result;
    } catch {
      setStatus("error");
      setMessage(opts.error || "");
      return undefined;
    }
  }, []);

  return {
    status,
    message,
    busy: status === "loading",
    run,
    fail,
  };
}
