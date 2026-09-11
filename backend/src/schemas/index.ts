// Contrato JSON do coletor (Zod) — dividido por domínio, ver CONTRATO_JSON.md.
// Cada consumidor pode importar do domínio específico (ex.: "./schemas/alarms.js")
// ou deste barrel, que reexporta tudo.
export * from "./alarms.js";
export * from "./apod.js";
export * from "./calendar.js";
export * from "./config.js";
export * from "./currencies.js";
export * from "./emulator.js";
export * from "./firmware.js";
export * from "./git.js";
export * from "./github.js";
export * from "./mining.js";
export * from "./retroachievements.js";
export * from "./rss.js";
export * from "./telegram.js";
export * from "./usage.js";
export * from "./weather.js";

