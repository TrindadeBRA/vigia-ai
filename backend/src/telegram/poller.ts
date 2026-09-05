import { getBotToken, pollOnce } from "./bot.js";

export class TelegramPoller {
  private _task: Promise<void> | null = null;
  private _abort: AbortController | null = null;
  private _running = false;

  async start(): Promise<void> {
    if (this._running) return;
    if (!getBotToken()) return;
    this._running = true;
    this._abort = new AbortController();
    this._task = this.loop(this._abort.signal);
  }

  async stop(): Promise<void> {
    this._running = false;
    if (this._abort) {
      try {
        this._abort.abort();
      } catch {}
      this._abort = null;
    }
    if (this._task) {
      try {
        await this._task;
      } catch (e) {
        if (e !== null && typeof e === "object" && (e as Error).name === "AbortError") {
          // ignore
        }
      }
      this._task = null;
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  private async loop(signal: AbortSignal): Promise<void> {
    let offset = 0;
    while (this._running) {
      if (signal.aborted) return;
      const token = getBotToken();
      if (!token) return;
      try {
        offset = await pollOnce(token, offset, signal);
        if (signal.aborted) return;
      } catch (exc: unknown) {
        if (exc !== null && typeof exc === "object" && (exc as Error).name === "AbortError") {
          return;
        }
        if (signal.aborted) return;
        console.log(`[telegram] erro no polling: ${exc}`);
        try {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 5000);
            signal.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            }, { once: true });
          });
        } catch {
          return;
        }
      }
    }
  }
}
