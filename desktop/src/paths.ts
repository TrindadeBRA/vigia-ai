/** Onde ficam dados, logs e o sidecar — e a migração do backend/data do repo. */
import { app } from "electron";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Arquivos que o coletor grava em COLLECTOR_DATA (ver backend/app/store.py). */
const DATA_FILES = ["config.json", "theme.json", "board.json", "wallpapers.json", "theme_bg.raw"];
const DATA_DIRS = ["wallpapers"];

export const isPackaged = app.isPackaged;

/** Raiz do repo quando rodando sem empacotar (`npm run dev` a partir de desktop/). */
export function repoRoot(): string {
  return resolve(__dirname, "..", "..");
}

/**
 * Versão do app. Sem empacotar, app.getVersion() devolve a do Electron —
 * então lê o desktop/package.json.
 */
export function appVersion(): string {
  if (isPackaged) return app.getVersion();
  try {
    const pkg = JSON.parse(readFileSync(join(repoRoot(), "desktop", "package.json"), "utf8"));
    return String(pkg.version ?? app.getVersion());
  } catch {
    return app.getVersion();
  }
}

export function userDataDir(): string {
  return app.getPath("userData");
}

export function dataDir(): string {
  const dir = join(userDataDir(), "data");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function logsDir(): string {
  const dir = join(userDataDir(), "logs");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function pidFile(): string {
  return join(userDataDir(), "sidecar.pid");
}

/** Frontend buildado: em resources/wwwroot quando empacotado, frontend/dist no repo. */
export function frontendDist(): string {
  return isPackaged
    ? join(process.resourcesPath, "wwwroot")
    : join(repoRoot(), "frontend", "dist");
}

/** Binário do coletor empacotado pelo PyInstaller (só existe no build). */
export function sidecarBinary(): string | null {
  const name = process.platform === "win32" ? "vigia-collector.exe" : "vigia-collector";
  const candidates = isPackaged
    ? [join(process.resourcesPath, "sidecar", name)]
    : [
        join(repoRoot(), "desktop", "resources", "sidecar", name),
        join(repoRoot(), "build", "sidecar", name),
      ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Interpretador do venv, usado só em desenvolvimento. */
export function devPython(): string | null {
  const rel =
    process.platform === "win32"
      ? join("backend", ".venv", "Scripts", "python.exe")
      : join("backend", ".venv", "bin", "python");
  const p = join(repoRoot(), rel);
  return existsSync(p) ? p : null;
}

/**
 * Primeira execução: traz config e papéis de parede do backend/data do repo.
 * Sem isso, quem já usava `./dev up` abriria o app com as contas em branco.
 */
export function migrateLegacyData(log: (msg: string) => void): void {
  const target = dataDir();
  const marker = join(target, ".migrated");
  if (existsSync(marker)) return;

  const legacy = process.env.VIGIA_LEGACY_DATA || join(repoRoot(), "backend", "data");
  const alreadyHasData = readdirSync(target).some((f) => DATA_FILES.includes(f));
  if (alreadyHasData || !existsSync(legacy) || resolve(legacy) === resolve(target)) {
    writeFileSync(marker, new Date().toISOString());
    return;
  }

  let moved = 0;
  for (const file of DATA_FILES) {
    const src = join(legacy, file);
    if (existsSync(src)) {
      copyFileSync(src, join(target, file));
      moved += 1;
    }
  }
  for (const dir of DATA_DIRS) {
    const src = join(legacy, dir);
    if (existsSync(src)) {
      cpSync(src, join(target, dir), { recursive: true });
      moved += 1;
    }
  }
  writeFileSync(marker, new Date().toISOString());
  if (moved > 0) log(`migrados ${moved} itens de ${legacy} para ${target}`);
}
