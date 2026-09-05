#!/usr/bin/env node
// Harness de paridade JSON — PLANO_NODE.md §5
// Compara GET /usage entre Python legado (8788) e Node (8787) com mesma config mock
// Uso: node scripts/diff-contract.mjs [--python-port 8788] [--node-port 8787] [--keep] [--quick]
// --quick: só testa framing SSE, não compara payload completo
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PY_PORT = parseInt(process.env.PY_PORT || "8788", 10);
const NODE_PORT = parseInt(process.env.NODE_PORT || "8787", 10);
const args = process.argv.slice(2);
const keep = args.includes("--keep");
const quick = args.includes("--quick");
const pyPortArg = args.indexOf("--python-port");
const nodePortArg = args.indexOf("--node-port");
const pyPort = pyPortArg !== -1 ? parseInt(args[pyPortArg + 1], 10) : PY_PORT;
const nodePort = nodePortArg !== -1 ? parseInt(args[nodePortArg + 1], 10) : NODE_PORT;

function defaultConfig() {
  return {
    version: 1,
    listen: { host: "127.0.0.1", port: 8787 },
    mock: true,
    paths: { claude_credentials: "", cursor_state_db: "", codex_auth: "" },
    providers: Object.fromEntries(
      ["claude","gpt","cursor","openrouter","deepseek","opencode","fal","bitcoin","adsense"].map(n => [n, { hidden: false, local_label: "", paste_secret: "", accounts: [] }])
    ),
    telegram: { bot_token: "", bot_username: "", chats: [] },
    alarms: [],
    weather: {
      enabled: false, hidden: false,
      location: { name: "", latitude: null, longitude: null, country: "", country_code: "", timezone: "auto", elevation: null },
      units: { temperature_unit: "celsius", wind_speed_unit: "kmh", precipitation_unit: "mm" },
      forecast_days: 7, past_days: 0, timezone: "auto",
      current: ["temperature_2m"], hourly: ["temperature_2m"], daily: ["weather_code"],
      display: { show_current: true, show_hourly: true, show_daily: true, hourly_count: 12, daily_count: 7, fields: { temperature: true, feels_like: true, humidity: true, precipitation: true, wind: true, pressure: true, cloud_cover: true, uv_index: true, sunrise_sunset: true } }
    },
    currencies: { enabled: false, hidden: false, base: "BRL", items: [] },
    wallpapers: { providers: { pexels_key: "", unsplash_key: "", wallhaven_key: "" }, selected_id: "" }
  };
}

const tmpPy = mkdtempSync(join(tmpdir(), "vigia-py-"));
const tmpNode = mkdtempSync(join(tmpdir(), "vigia-node-"));
const cfg = defaultConfig();
writeFileSync(join(tmpPy, "config.json"), JSON.stringify(cfg, null, 2));
writeFileSync(join(tmpNode, "config.json"), JSON.stringify(cfg, null, 2));
console.log(`[harness] tmpPy=${tmpPy} tmpNode=${tmpNode}`);
console.log(`[harness] pyPort=${pyPort} nodePort=${nodePort}`);

function waitForHealth(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryFetch = async () => {
      try {
        const r = await fetch(url);
        if (r.ok) { const j = await r.json(); if (j.ok) return resolve(j); }
      } catch {}
      if (Date.now() - start > timeoutMs) return reject(new Error(`timeout waiting ${url}`));
      setTimeout(tryFetch, 500);
    };
    tryFetch();
  });
}

function spawnPy() {
  const env = { ...process.env, COLLECTOR_DATA: tmpPy, HOST: "127.0.0.1", PORT: String(pyPort), PYTHONPATH: "backend-python-legacy", USAGE_INTERVAL_S: "60" };
  const child = spawn("backend-python-legacy/.venv/bin/python", ["-m", "app.main"], { env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", d => process.stdout.write(`[py] ${d}`));
  child.stderr.on("data", d => process.stderr.write(`[py-err] ${d}`));
  child.on("exit", (c,s) => console.log(`[py] exit code=${c} signal=${s}`));
  return child;
}
function spawnNode() {
  const env = { ...process.env, COLLECTOR_DATA: tmpNode, HOST: "127.0.0.1", PORT: String(nodePort), USAGE_INTERVAL_S: "60" };
  const child = spawn("node", ["backend/dist/main.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", d => process.stdout.write(`[node] ${d}`));
  child.stderr.on("data", d => process.stderr.write(`[node-err] ${d}`));
  child.on("exit", (c,s) => console.log(`[node] exit code=${c} signal=${s}`));
  return child;
}

function stripVolatile(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripVolatile);
  const out = {};
  for (const [k,v] of Object.entries(obj)) {
    if (k === "updated_at") continue;
    // updated_at inside nested? only top-level per schema, but be safe
    out[k] = stripVolatile(v);
  }
  return out;
}

function deepDiff(a,b, path="") {
  const diffs = [];
  if (typeof a !== typeof b) { diffs.push(`${path}: tipo ${typeof a} vs ${typeof b}`); return diffs; }
  if (a === null || b === null) { if (a !== b) diffs.push(`${path}: null mismatch ${a} vs ${b}`); return diffs; }
  if (typeof a !== "object") { if (a !== b) diffs.push(`${path}: valor ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); return diffs; }
  if (Array.isArray(a) !== Array.isArray(b)) { diffs.push(`${path}: array vs object`); return diffs; }
  if (Array.isArray(a)) {
    if (a.length !== b.length) diffs.push(`${path}: tamanho array ${a.length} vs ${b.length}`);
    const len = Math.min(a.length, b.length);
    for (let i=0;i<len;i++) diffs.push(...deepDiff(a[i], b[i], `${path}[${i}]`));
    return diffs;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (!(k in a)) diffs.push(`${path}.${k}: ausente em Node/Python A`);
    else if (!(k in b)) diffs.push(`${path}.${k}: ausente em Node/Python B`);
    else diffs.push(...deepDiff(a[k], b[k], path ? `${path}.${k}` : k));
  }
  return diffs;
}

async function main() {
  const py = spawnPy();
  const node = spawnNode();
  let failed = false;
  try {
    console.log("[harness] aguardando health...");
    await Promise.all([
      waitForHealth(`http://127.0.0.1:${pyPort}/health`),
      waitForHealth(`http://127.0.0.1:${nodePort}/health`)
    ]);
    console.log("[harness] ambos saudáveis, buscando /usage...");
    // dá 1s extra pra primeiro ciclo mock completar
    await new Promise(r => setTimeout(r, 1000));
    const [pyRes, nodeRes] = await Promise.all([
      fetch(`http://127.0.0.1:${pyPort}/usage`).then(r => r.json()),
      fetch(`http://127.0.0.1:${nodePort}/usage`).then(r => r.json())
    ]);
    const pyStripped = stripVolatile(pyRes);
    const nodeStripped = stripVolatile(nodeRes);
    const diffs = deepDiff(pyStripped, nodeStripped);
    if (diffs.length === 0) {
      console.log("[harness] ✅ PARIDADE OK — payloads idênticos (exceto updated_at)");
    } else {
      console.error(`[harness] ❌ DIVERGÊNCIA: ${diffs.length} diferenças`);
      for (const d of diffs.slice(0, 50)) console.error("  -", d);
      if (diffs.length > 50) console.error(`  ... e mais ${diffs.length-50}`);
      // dump parcial
      writeFileSync(join(tmpdir(), "vigia-py-usage.json"), JSON.stringify(pyRes, null, 2));
      writeFileSync(join(tmpdir(), "vigia-node-usage.json"), JSON.stringify(nodeRes, null, 2));
      console.error(`[harness] dumps em /tmp/vigia-*-usage.json`);
      failed = true;
    }

    if (!quick) {
      // também checa SSE framing (§6.1)
      console.log("[harness] checando SSE framing...");
      const checkSse = async (port, label) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(`http://127.0.0.1:${port}/events`, { signal: ctrl.signal, headers: { Accept: "text/event-stream" } });
        if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
          console.error(`[harness] ${label} SSE header falhou: ${res.status} ${res.headers.get("content-type")}`);
          return false;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let sawConnected = false;
        let sawUsage = false;
        const deadline = Date.now() + 3500;
        try {
          while (Date.now() < deadline) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            if (buf.includes(": connected\n\n")) sawConnected = true;
            if (buf.includes("event: usage\ndata:")) sawUsage = true;
            if (sawConnected && sawUsage) break;
          }
        } catch {}
        clearTimeout(t);
        try { ctrl.abort(); } catch {}
        try { await reader.cancel(); } catch {}
        console.log(`[harness] ${label} SSE: connected=${sawConnected} usage=${sawUsage} -> ${sawConnected&&sawUsage?"OK":"FALHA"}`);
        return sawConnected && sawUsage;
      };
      const [pySse, nodeSse] = await Promise.all([checkSse(pyPort, "py"), checkSse(nodePort, "node")]);
      if (!pySse || !nodeSse) failed = true;
    }

    // health contract
    const [pyH, nodeH] = await Promise.all([
      fetch(`http://127.0.0.1:${pyPort}/health`).then(r=>r.json()),
      fetch(`http://127.0.0.1:${nodePort}/health`).then(r=>r.json())
    ]);
    const healthDiff = deepDiff({ok:pyH.ok, version:pyH.version? "x":"", panel:pyH.panel, display:pyH.display, usage:pyH.usage, events:pyH.events}, {ok:nodeH.ok, version:nodeH.version?"x":"", panel:nodeH.panel, display:nodeH.display, usage:nodeH.usage, events:nodeH.events});
    if (healthDiff.length) { console.error("[harness] health divergente", healthDiff); failed = true; }
    else console.log("[harness] health OK");

  } catch (e) {
    console.error("[harness] erro:", e);
    failed = true;
  } finally {
    console.log("[harness] encerrando servidores...");
    try { py.kill("SIGTERM"); } catch {}
    try { node.kill("SIGTERM"); } catch {}
    await new Promise(r=>setTimeout(r, 1500));
    try { py.kill("SIGKILL"); } catch {}
    try { node.kill("SIGKILL"); } catch {}
    if (!keep) {
      rmSync(tmpPy, { recursive: true, force: true });
      rmSync(tmpNode, { recursive: true, force: true });
    } else console.log(`[harness] mantidos ${tmpPy} ${tmpNode}`);
  }
  process.exit(failed ? 1 : 0);
}
main();
