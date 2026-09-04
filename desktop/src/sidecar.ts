/**
 * Ciclo de vida do coletor FastAPI rodando como processo filho.
 *
 * Contrato com backend/app/desktop.py: uma linha `VIGIA_READY {...}` ou
 * `VIGIA_ERROR {...}` na stdout, e encerramento quando a stdin fecha.
 */
import { ChildProcess, spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

import { dataDir, devPython, frontendDist, pidFile, repoRoot, sidecarBinary } from "./paths";

/** Espelha os códigos de saída de backend/app/desktop.py. */
const EXIT_PORT_IN_USE = 3;

const BACKOFF_MS = [1000, 2000, 5000, 15000, 30000];
const MAX_RESTARTS = BACKOFF_MS.length;
const READY_TIMEOUT_MS = 30_000;
const GRACEFUL_STOP_MS = 10_000;

export type ReadyInfo = {
  version: string;
  host: string;
  port: number;
  lan: string[];
  data_dir: string;
  pid: number;
};

export type SidecarFailure = {
  code: "port_in_use" | "bind_failed" | "startup_failed" | "missing_runtime" | "timeout" | "crashed";
  detail: string;
  port?: number;
};

export type SidecarOptions = {
  host: string;
  port: number;
  log: (msg: string) => void;
};

export declare interface Sidecar {
  on(event: "ready", cb: (info: ReadyInfo) => void): this;
  on(event: "failed", cb: (failure: SidecarFailure) => void): this;
  on(event: "restarting", cb: (attempt: number, delayMs: number) => void): this;
}

export class Sidecar extends EventEmitter {
  private child: ChildProcess | null = null;
  /** Muda a cada spawn. Handlers de um filho antigo saem cedo. */
  private generation = 0;
  private restarts = 0;
  private stopping = false;
  private readyInfo: ReadyInfo | null = null;
  private restartTimer: NodeJS.Timeout | null = null;

  constructor(private opts: SidecarOptions) {
    super();
  }

  get info(): ReadyInfo | null {
    return this.readyInfo;
  }

  get running(): boolean {
    return this.child !== null && this.child.exitCode === null;
  }

  /** Mata um coletor que sobrou de uma execução anterior (crash, queda de energia). */
  static killOrphan(log: (msg: string) => void): void {
    const file = pidFile();
    if (!existsSync(file)) return;
    const pid = Number(readFileSync(file, "utf8").trim());
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0); // existe?
        log(`matando coletor órfão pid=${pid}`);
        killTree(pid);
      } catch {
        /* já morreu */
      }
    }
    try {
      unlinkSync(file);
    } catch {
      /* ignora */
    }
  }

  start(): void {
    if (this.running) return;
    this.stopping = false;

    const command = resolveCommand();
    if (!command) {
      this.emit("failed", {
        code: "missing_runtime",
        detail:
          "Coletor não encontrado. Em desenvolvimento rode `./dev up` uma vez para criar " +
          "backend/.venv; no app empacotado o binário deveria estar em resources/sidecar.",
      } satisfies SidecarFailure);
      return;
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOST: this.opts.host,
      PORT: String(this.opts.port),
      COLLECTOR_DATA: dataDir(),
      VIGIA_FRONTEND_DIST: frontendDist(),
      PYTHONUNBUFFERED: "1",
    };

    this.opts.log(`iniciando coletor: ${command.exe} ${command.args.join(" ")} (:${this.opts.port})`);
    const child = spawn(command.exe, command.args, {
      cwd: command.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.generation += 1;
    const gen = this.generation;
    const mine = () => gen === this.generation;
    this.child = child;
    if (child.pid) writeFileSync(pidFile(), String(child.pid));

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled || !mine()) return;
      settled = true;
      this.opts.log("coletor não respondeu o handshake em 30s");
      this.emit("failed", { code: "timeout", detail: "o coletor não respondeu em 30 segundos" });
      this.kill();
    }, READY_TIMEOUT_MS);

    createInterface({ input: child.stdout! }).on("line", (line) => {
      if (!mine()) return;
      if (line.startsWith("VIGIA_READY ")) {
        settled = true;
        clearTimeout(timeout);
        this.restarts = 0;
        this.readyInfo = JSON.parse(line.slice("VIGIA_READY ".length)) as ReadyInfo;
        this.opts.log(`coletor pronto em ${this.readyInfo.host}:${this.readyInfo.port}`);
        this.emit("ready", this.readyInfo);
        return;
      }
      if (line.startsWith("VIGIA_ERROR ")) {
        settled = true;
        clearTimeout(timeout);
        const err = JSON.parse(line.slice("VIGIA_ERROR ".length)) as SidecarFailure & { port?: number };
        this.opts.log(`coletor falhou: ${err.code} — ${err.detail}`);
        this.emit("failed", err);
        return;
      }
      this.opts.log(`[coletor] ${line}`);
    });

    createInterface({ input: child.stderr! }).on("line", (line) => this.opts.log(`[coletor] ${line}`));

    child.on("error", (err) => {
      clearTimeout(timeout);
      if (!mine()) return;
      this.opts.log(`falha ao executar o coletor: ${err.message}`);
      this.emit("failed", { code: "crashed", detail: err.message });
    });

    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      if (!mine()) return; // já fomos substituídos por um spawn novo
      this.child = null;
      this.readyInfo = null;
      if (this.stopping) return;
      this.opts.log(`coletor saiu (code=${code} signal=${signal})`);
      // Porta ocupada não se resolve tentando de novo — quem decide é a UI.
      if (code === EXIT_PORT_IN_USE) return;
      this.scheduleRestart(`saiu com código ${code ?? signal}`);
    });
  }

  private scheduleRestart(reason: string): void {
    if (this.restarts >= MAX_RESTARTS) {
      this.emit("failed", {
        code: "crashed",
        detail: `o coletor parou ${MAX_RESTARTS} vezes seguidas (${reason})`,
      } satisfies SidecarFailure);
      return;
    }
    const delay = BACKOFF_MS[this.restarts];
    this.restarts += 1;
    this.emit("restarting", this.restarts, delay);
    this.opts.log(`reiniciando o coletor em ${delay}ms (tentativa ${this.restarts})`);
    this.restartTimer = setTimeout(() => this.start(), delay);
  }

  /** Troca de porta/host pelo painel: reinicia com a configuração nova. */
  async restart(opts?: Partial<Pick<SidecarOptions, "host" | "port">>): Promise<void> {
    this.opts = { ...this.opts, ...opts };
    this.restarts = 0;
    await this.stop();
    this.start();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    const child = this.child;
    if (!child || child.exitCode !== null) {
      this.child = null;
      return;
    }
    // A partir daqui este filho não fala mais pelo Sidecar.
    this.generation += 1;
    // Fechar a stdin é o caminho limpo e funciona no Windows (ver app/desktop.py).
    try {
      child.stdin?.end();
    } catch {
      /* ignora */
    }
    const died = await waitForExit(child, GRACEFUL_STOP_MS);
    if (!died) {
      this.opts.log(`coletor não encerrou em ${GRACEFUL_STOP_MS}ms — matando`);
      this.kill();
      await waitForExit(child, 3000);
    }
    this.child = null;
    this.readyInfo = null;
    try {
      unlinkSync(pidFile());
    } catch {
      /* ignora */
    }
  }

  private kill(): void {
    const pid = this.child?.pid;
    if (pid) killTree(pid);
  }
}

function waitForExit(child: ChildProcess, ms: number): Promise<boolean> {
  return new Promise((done) => {
    if (child.exitCode !== null) return done(true);
    const timer = setTimeout(() => done(false), ms);
    child.once("exit", () => {
      clearTimeout(timer);
      done(true);
    });
  });
}

/** PyInstaller cria processo filho: no Windows só taskkill /T pega a árvore toda. */
function killTree(pid: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* já morreu */
  }
  setTimeout(() => {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* já morreu */
    }
  }, 3000).unref();
}

/** Binário empacotado quando existir; venv do repo em desenvolvimento. */
function resolveCommand(): { exe: string; args: string[]; cwd: string } | null {
  const binary = sidecarBinary();
  if (binary) return { exe: binary, args: [], cwd: repoRoot() };
  const python = devPython();
  if (python) return { exe: python, args: ["-m", "app.desktop"], cwd: `${repoRoot()}/backend` };
  return null;
}
