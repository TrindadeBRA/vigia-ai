import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { copyFileSync, cpSync, createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { downloadedFirmwareDir, firmwareDir, inDocker } from "./config.js";
import { load, updateSync } from "./store.js";
import { VERSION } from "./version.js";

const PLACEHOLDER_SSID = new Set(["", "SUA_REDE", "YOUR_SSID", "Wokwi-GUEST"]);
const PLACEHOLDER_PASS = new Set(["", "SUA_SENHA", "YOUR_PASSWORD"]);

const FLASH_TIMEOUT_MS = 10 * 60 * 1000;
const FLASH_TRAILER = "__VIGIA_FLASH_EXIT__:";

let flashProc: ChildProcess | null = null;

export function cString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "").replace(/\n/g, "\\n");
}

function unescapeC(raw: string): string {
  return raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

export function parseSecretsH(source: string): { ssid: string; password: string; usageUrl: string } {
  const pick = (name: string): string => {
    const re = new RegExp(`#define\\s+${name}\\s+"((?:\\\\.|[^"\\\\])*)"`, "m");
    const m = source.match(re);
    return m ? unescapeC(m[1]) : "";
  };
  return {
    ssid: pick("WIFI_SSID"),
    password: pick("WIFI_PASSWORD"),
    usageUrl: pick("USAGE_URL"),
  };
}

export function renderSecretsH(ssid: string, password: string, usageUrl: string): string {
  return (
    "#pragma once\n\n" +
    "// Gerado pelo painel Vigia AI (Placa e rede). Não commitar com senha real.\n" +
    "// USAGE_URL: IP LAN do host do coletor — nunca 127.0.0.1 na ESP32.\n" +
    "// O firmware escuta SSE em /events (troca o path /usage → /events).\n\n" +
    `#define WIFI_SSID "${cString(ssid)}"\n` +
    `#define WIFI_PASSWORD "${cString(password)}"\n` +
    `#define USAGE_URL "${cString(usageUrl)}"\n`
  );
}

export function isPlaceholderSsid(ssid: string): boolean {
  return PLACEHOLDER_SSID.has(ssid.trim());
}

export function isPlaceholderPassword(password: string): boolean {
  return PLACEHOLDER_PASS.has(password);
}

function tryExec(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, { timeout: 2500, encoding: "utf8", windowsHide: true }).trim();
  } catch {
    return null;
  }
}

export function detectWifiSsid(): string | null {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return null;
  if (process.platform === "darwin") {
    for (const iface of ["en0", "en1", "en2"]) {
      const out = tryExec("ipconfig", ["getsummary", iface]);
      if (!out) continue;
      const m = out.match(/\bSSID\s*:\s*(.+)/);
      const ssid = m?.[1]?.trim() ?? "";
      if (ssid && ssid !== "<redacted>" && ssid !== "0") return ssid;
    }
    for (const iface of ["en0", "en1"]) {
      const out = tryExec("networksetup", ["-getairportnetwork", iface]);
      if (!out || /not associated/i.test(out)) continue;
      const m = out.match(/Current Wi-Fi Network:\s*(.+)/i);
      if (m?.[1]?.trim()) return m[1].trim();
    }
  }
  if (process.platform === "linux") {
    const iw = tryExec("iwgetid", ["-r"]);
    if (iw) return iw;
    const nm = tryExec("nmcli", ["-t", "-f", "active,ssid", "dev", "wifi"]);
    if (nm) {
      for (const line of nm.split("\n")) {
        if (line.startsWith("yes:") && line.slice(4).trim()) return line.slice(4).trim();
      }
    }
  }
  if (process.platform === "win32") {
    const out = tryExec("netsh", ["wlan", "show", "interfaces"]);
    if (out) {
      const m = out.match(/^\s*SSID\s*:\s*(.+)$/m);
      if (m?.[1]?.trim()) return m[1].trim();
    }
  }
  return null;
}

export function findPio(): string | null {
  const env = (process.env.PIO || process.env.PLATFORMIO || "").trim();
  if (env && existsSync(env)) return env;
  const whichCmd = process.platform === "win32" ? "where" : "which";
  const which = tryExec(whichCmd, ["pio"]);
  if (which) {
    const first = which.split(/\r?\n/)[0]?.trim();
    if (first && existsSync(first)) return first;
  }
  const bundled = join(homedir(), ".platformio", "penv", "bin", process.platform === "win32" ? "pio.exe" : "pio");
  if (existsSync(bundled)) return bundled;
  return null;
}

export function secretsPath(): string {
  return join(firmwareDir(), "src", "secrets.h");
}

export function canWriteFirmware(): boolean {
  return existsSync(join(firmwareDir(), "platformio.ini"));
}

const SOURCE_MARKER = ".vigia-source.json";

export function usingDownloadedFirmware(): boolean {
  if (!canWriteFirmware()) return false;
  return resolve(firmwareDir()) === resolve(downloadedFirmwareDir());
}

function wantedFirmwareRef(): string {
  return `v${VERSION}`;
}

function writeSourceMarker(dest: string, ref: string): void {
  writeFileSync(join(dest, SOURCE_MARKER), JSON.stringify({ ref, downloaded_at: new Date().toISOString() }) + "\n", "utf8");
}

function readSourceMarker(dir: string): string | null {
  try {
    const raw = JSON.parse(readFileSync(join(dir, SOURCE_MARKER), "utf8")) as Record<string, unknown>;
    const ref = String(raw.ref ?? "").trim();
    return ref || null;
  } catch {
    return null;
  }
}

function storedFirmware(): { wifi_ssid: string; wifi_password: string } {
  const cfg = load();
  const fw = (typeof cfg.firmware === "object" && cfg.firmware !== null ? cfg.firmware : {}) as Record<string, unknown>;
  return {
    wifi_ssid: String(fw.wifi_ssid ?? ""),
    wifi_password: String(fw.wifi_password ?? ""),
  };
}

function fileSecrets(): { ssid: string; password: string } {
  const path = secretsPath();
  if (!existsSync(path)) return { ssid: "", password: "" };
  try {
    const parsed = parseSecretsH(readFileSync(path, "utf8"));
    return { ssid: parsed.ssid, password: parsed.password };
  } catch {
    return { ssid: "", password: "" };
  }
}

export function resolvedWifi(detected: string | null = null): {
  ssid: string;
  password: string;
  passwordSet: boolean;
} {
  const stored = storedFirmware();
  const file = fileSecrets();
  const ssid =
    (!isPlaceholderSsid(stored.wifi_ssid) && stored.wifi_ssid) ||
    (!isPlaceholderSsid(file.ssid) && file.ssid) ||
    detected ||
    "";
  const password = !isPlaceholderPassword(stored.wifi_password)
    ? stored.wifi_password
    : !isPlaceholderPassword(file.password)
      ? file.password
      : "";
  return { ssid, password, passwordSet: Boolean(password) };
}

export function flashReason(opts: { pio: string | null; canWrite: boolean }): string | null {
  if (inDocker()) return "Não dá pra gravar a USB de dentro do Docker. Rode o coletor no Mac (`./dev up`) com a ESP32 no cabo.";
  if (!opts.canWrite) {
    return "O firmware ainda não está neste computador. Use “Baixar firmware” (GitHub, tag desta versão) ou rode `./dev up` no checkout.";
  }
  if (!opts.pio) return "PlatformIO (`pio`) não encontrado. Instale em https://docs.platformio.org/ ou rode `./dev firmware flash` no terminal.";
  if (flashProc && flashProc.exitCode === null) return "Já tem uma gravação em andamento.";
  return null;
}

export function firmwarePublic(usageUrl: string): Record<string, unknown> {
  const detected = detectWifiSsid();
  const wifi = resolvedWifi(detected);
  const canWrite = canWriteFirmware();
  const pio = findPio();
  const path = canWrite ? secretsPath() : null;
  const reason = flashReason({ pio, canWrite });
  const downloaded = usingDownloadedFirmware();
  const wantedRef = wantedFirmwareRef();
  const sourceRef = downloaded ? readSourceMarker(firmwareDir()) : canWrite ? "checkout" : null;
  const sourceStale = downloaded && sourceRef !== wantedRef;
  return {
    wifi_ssid: wifi.ssid,
    wifi_password: wifi.password,
    wifi_password_set: wifi.passwordSet,
    detected_ssid: detected,
    usage_url: usageUrl,
    secrets_path: path,
    secrets_present: Boolean(path && existsSync(path)),
    can_write: canWrite,
    needs_source: !canWrite,
    can_update_source: !canWrite || downloaded,
    source_ref: sourceRef,
    wanted_ref: wantedRef,
    source_stale: sourceStale,
    can_flash: reason === null,
    pio,
    in_docker: inDocker(),
    running: Boolean(flashProc && flashProc.exitCode === null),
    reason,
  };
}

export function saveFirmwareWifi(input: { wifi_ssid?: string; wifi_password?: string | null }, usageUrl: string): {
  ok: boolean;
  error?: string;
  secrets_path: string | null;
  wrote_secrets: boolean;
  ssid: string;
  password: string;
} {
  const current = resolvedWifi();
  const ssid = input.wifi_ssid !== undefined ? input.wifi_ssid.trim() : current.ssid;
  let password = current.password;
  if (input.wifi_password !== undefined && input.wifi_password !== null) {
    // Campo vazio = manter a senha já salva (o browser zera o input no blur do botão).
    if (input.wifi_password !== "" && input.wifi_password !== "********") password = input.wifi_password;
  }
  if (isPlaceholderSsid(ssid)) {
    return { ok: false, error: "Preencha o nome da Wi-Fi.", secrets_path: null, wrote_secrets: false, ssid, password };
  }
  if (/[\r\n]/.test(ssid) || /[\r\n]/.test(password)) {
    return { ok: false, error: "SSID e senha não podem ter quebra de linha.", secrets_path: null, wrote_secrets: false, ssid, password };
  }

  updateSync((cfg) => {
    cfg.firmware = { wifi_ssid: ssid, wifi_password: password };
  });

  const canWrite = canWriteFirmware();
  if (!canWrite) {
    return {
      ok: true,
      secrets_path: null,
      wrote_secrets: false,
      ssid,
      password,
    };
  }
  const srcDir = join(firmwareDir(), "src");
  mkdirSync(srcDir, { recursive: true });
  const path = secretsPath();
  writeFileSync(path, renderSecretsH(ssid, password, usageUrl), "utf8");
  return { ok: true, secrets_path: path, wrote_secrets: true, ssid, password };
}

export function isFlashRunning(): boolean {
  return Boolean(flashProc && flashProc.exitCode === null);
}

export function startFlash(onData: (chunk: string) => void): Promise<number> {
  if (isFlashRunning()) return Promise.reject(new Error("Já tem uma gravação em andamento."));
  const pio = findPio();
  if (!pio) return Promise.reject(new Error("PlatformIO (`pio`) não encontrado."));
  if (!canWriteFirmware()) return Promise.reject(new Error("Pasta firmware/ não encontrada."));

  return new Promise((resolve, reject) => {
    const proc = spawn(pio, ["run", "-e", "esp32dev", "-t", "upload"], {
      cwd: firmwareDir(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    flashProc = proc;
    const timer = setTimeout(() => proc.kill("SIGKILL"), FLASH_TIMEOUT_MS);
    const push = (buf: Buffer) => onData(buf.toString("utf8"));
    proc.stdout?.on("data", push);
    proc.stderr?.on("data", push);
    proc.on("error", (err) => {
      clearTimeout(timer);
      flashProc = null;
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      flashProc = null;
      const exit = code ?? 1;
      onData(`\n${FLASH_TRAILER}${exit}\n`);
      resolve(exit);
    });
  });
}

export { FLASH_TRAILER };

export function firmwareArchiveUrls(): { tag: string; main: string } {
  return {
    tag: `https://codeload.github.com/TrindadeBRA/vigia-ai/tar.gz/refs/tags/v${VERSION}`,
    main: "https://codeload.github.com/TrindadeBRA/vigia-ai/tar.gz/refs/heads/main",
  };
}

function findFirmwareRoot(root: string, depth = 0): string | null {
  if (existsSync(join(root, "platformio.ini"))) return root;
  if (existsSync(join(root, "firmware", "platformio.ini"))) return join(root, "firmware");
  if (depth >= 2) return null;
  let names: string[] = [];
  try {
    names = readdirSync(root);
  } catch {
    return null;
  }
  for (const name of names) {
    const p = join(root, name);
    try {
      if (statSync(p).isDirectory()) {
        const found = findFirmwareRoot(p, depth + 1);
        if (found) return found;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function copyFirmwareTree(src: string, dest: string): void {
  const secretsPath = join(dest, "src", "secrets.h");
  const keepSecrets = existsSync(secretsPath) ? readFileSync(secretsPath) : null;
  const staging = `${dest}.new`;
  rmSync(staging, { recursive: true, force: true });
  cpSync(src, staging, {
    recursive: true,
    filter: (from) => {
      const name = basename(from);
      return name !== ".pio" && name !== ".git" && name !== "secrets.h" && name !== SOURCE_MARKER;
    },
  });
  rmSync(dest, { recursive: true, force: true });
  cpSync(staging, dest, { recursive: true });
  rmSync(staging, { recursive: true, force: true });
  if (keepSecrets) {
    mkdirSync(join(dest, "src"), { recursive: true });
    writeFileSync(secretsPath, keepSecrets);
  }
}

export function installFirmwareFromArchive(archivePath: string, ref = wantedFirmwareRef()): { dest: string; ref: string } {
  const extractDir = mkdtempSync(join(tmpdir(), "vigia-fw-extract-"));
  try {
    execFileSync("tar", ["-xzf", archivePath, "-C", extractDir], { timeout: 60_000, windowsHide: true });
    const src = findFirmwareRoot(extractDir);
    if (!src) throw new Error("O arquivo baixado não tem a pasta firmware/.");
    const dest = downloadedFirmwareDir();
    copyFirmwareTree(src, dest);
    if (!existsSync(join(dest, "platformio.ini"))) {
      throw new Error("A cópia do firmware ficou incompleta.");
    }
    writeSourceMarker(dest, ref);
    return { dest, ref };
  } finally {
    rmSync(extractDir, { recursive: true, force: true });
  }
}

async function saveUrlToFile(url: string, dest: string): Promise<void> {
  if (url.startsWith("file:")) {
    copyFileSync(fileURLToPath(url), dest);
    return;
  }
  const res = await fetch(url, {
    headers: { "User-Agent": `vigia-ai-collector/${VERSION}` },
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const err = new Error(`GitHub HTTP ${res.status} ao baixar o firmware.`) as Error & { httpStatus?: number };
    err.httpStatus = res.status;
    throw err;
  }
  if (!res.body) throw new Error("Resposta vazia ao baixar o firmware.");
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
}

export async function downloadFirmwareSource(): Promise<{ ok: boolean; dest?: string; error?: string; ref?: string }> {
  const work = mkdtempSync(join(tmpdir(), "vigia-fw-dl-"));
  const archive = join(work, "firmware.tar.gz");
  const override = (process.env.VIGIA_FIRMWARE_ARCHIVE_URL || "").trim();
  try {
    if (override) {
      await saveUrlToFile(override, archive);
      const { dest, ref } = installFirmwareFromArchive(archive, "local");
      return { ok: true, dest, ref };
    }
    const urls = firmwareArchiveUrls();
    try {
      await saveUrlToFile(urls.tag, archive);
      const tag = wantedFirmwareRef();
      const { dest, ref } = installFirmwareFromArchive(archive, tag);
      return { ok: true, dest, ref };
    } catch (err) {
      const status = err && typeof err === "object" && "httpStatus" in err ? Number((err as { httpStatus?: number }).httpStatus) : 0;
      if (status !== 404) throw err;
      await saveUrlToFile(urls.main, archive);
      const { dest, ref } = installFirmwareFromArchive(archive, "main");
      return { ok: true, dest, ref };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
