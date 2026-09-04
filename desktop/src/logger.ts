/** Log em arquivo com rotação simples — é o que o usuário manda quando algo quebra. */
import { appendFileSync, existsSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { logsDir } from "./paths";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 5;

function rotate(file: string): void {
  try {
    if (!existsSync(file) || statSync(file).size < MAX_BYTES) return;
    const oldest = `${file}.${MAX_FILES}`;
    if (existsSync(oldest)) unlinkSync(oldest);
    for (let i = MAX_FILES - 1; i >= 1; i -= 1) {
      const from = `${file}.${i}`;
      if (existsSync(from)) renameSync(from, `${file}.${i + 1}`);
    }
    renameSync(file, `${file}.1`);
  } catch {
    /* log nunca pode derrubar o app */
  }
}

export function makeLogger(name: string): (msg: string) => void {
  const file = join(logsDir(), `${name}.log`);
  return (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    process.stdout.write(`${name}: ${msg}\n`);
    try {
      rotate(file);
      appendFileSync(file, line);
    } catch {
      /* idem */
    }
  };
}

export function logFile(name: string): string {
  return join(logsDir(), `${name}.log`);
}
