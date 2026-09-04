// Contrato JSON do coletor (Zod) — dividido por domínio, ver CONTRATO_JSON.md.
// Cada consumidor pode importar do domínio específico (ex.: "./schemas/alarms.js")
// ou deste barrel, que reexporta tudo.
export * from "./usage.js";
export * from "./weather.js";
export * from "./currencies.js";
export * from "./config.js";
export * from "./alarms.js";
export * from "./telegram.js";
