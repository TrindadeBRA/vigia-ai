/**
 * Apps macOS/Linux abertos pelo Finder/LaunchServices (inclusive o cask do
 * Homebrew) herdam um PATH mínimo do sistema, sem os diretórios que o
 * `.zprofile`/`.zshrc` do usuário adiciona num shell interativo — por isso
 * `ffmpeg` (câmera), `adb` (Android) etc. resolvem certinho rodando
 * `./dev up` num Terminal mas falham (ENOENT silencioso, sem log nenhum)
 * no app empacotado. Roda o shell de login do usuário uma vez no boot e
 * funde o PATH dele no do processo — mesma técnica dos pacotes
 * fix-path/shell-env, sem puxar dependência nova (a v5+ deles é ESM-only;
 * o resto do desktop é CommonJS).
 */
import { execFile } from "node:child_process";

const MARKER = "___VIGIA_PATH___";
const TIMEOUT_MS = 4000;

function shellPath(shell: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      shell,
      // ${PATH} com chaves — "$PATH" + o marcador colado ("$PATH___VIGIA...")
      // vira um nome de variável inválido pro shell (some, expande pra
      // vazio) e a extração falha em silêncio.
      ["-ilc", `echo "${MARKER}\${PATH}${MARKER}"`],
      { timeout: TIMEOUT_MS, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) {
          resolve(null);
          return;
        }
        const match = stdout.match(new RegExp(`${MARKER}(.*)${MARKER}`, "s"));
        resolve(match ? match[1].trim() : null);
      },
    ).on("error", () => resolve(null));
  });
}

function mergePath(current: string, extra: string): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const p of [...current.split(":"), ...extra.split(":")]) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    parts.push(p);
  }
  return parts.join(":");
}

/** No Windows o PATH de apps GUI já vem do registro — esse problema não existe lá. */
export async function fixPath(log: (msg: string) => void): Promise<void> {
  if (process.platform === "win32") return;
  const shell = process.env.SHELL || "/bin/zsh";
  const before = process.env.PATH || "";
  const fetched = await shellPath(shell);
  if (!fetched) {
    log(`fixPath: não consegui ler o PATH de ${shell} (login shell) — mantendo o do processo`);
    return;
  }
  const merged = mergePath(before, fetched);
  if (merged !== before) {
    process.env.PATH = merged;
    log(`fixPath: PATH ampliado com o do shell de login (${shell}): ${merged}`);
  }
}
