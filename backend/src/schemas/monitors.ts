import { z } from "zod";

// Registro de apps Vigia Monitor (auto-registro via HTTP, sem ADB — o ADB
// em routers/android.ts é do espelhamento, fluxo independente).
// Guardado em backend/data/monitors.json (gitignored).
// Cada aparelho informa o tamanho da tela para o editor gerar um canvas
// próprio; o canvas default continua sendo o da placa (theme.json).

export const MonitorRegisterSchema = z.object({
    // Id estável do aparelho (ex.: Settings.Secure.ANDROID_ID). Upsert por key.
    key: z.string().min(1).max(128),
    model: z.string().max(64).default(""),
    brand: z.string().max(64).default(""),
    // Tela cheia em pixels (o app manda displayMetrics; frações 0-1 do tema
    // resolvem o resto). Limites anti-abuso na conversão do fundo.
    screenW: z.number().int().min(80).max(4320),
    screenH: z.number().int().min(80).max(4320),
    densityDpi: z.number().int().min(60).max(1000).optional(),
    appVersion: z.string().max(32).default(""),
    label: z.string().max(64).default(""),
});
export type MonitorRegister = z.infer<typeof MonitorRegisterSchema>;

export const MonitorDeviceSchema = MonitorRegisterSchema.extend({
    id: z.string(),
    lastSeen: z.string(),
});
export type MonitorDevice = z.infer<typeof MonitorDeviceSchema>;

export const MonitorFileSchema = z.object({
    devices: z.array(MonitorDeviceSchema).default([]),
});
export type MonitorFile = z.infer<typeof MonitorFileSchema>;

export const MonitorPatchSchema = z.object({
    label: z.string().max(64),
});
export type MonitorPatch = z.infer<typeof MonitorPatchSchema>;

// Público: sem a key estável, com status online por lastSeen recente.
export const MonitorDevicePublicSchema = z.object({
    id: z.string(),
    label: z.string(),
    model: z.string(),
    brand: z.string(),
    screenW: z.number().int(),
    screenH: z.number().int(),
    portrait: z.object({ w: z.number().int(), h: z.number().int() }),
    landscape: z.object({ w: z.number().int(), h: z.number().int() }),
    appVersion: z.string(),
    lastSeen: z.string(),
    online: z.boolean().default(false),
});
export type MonitorDevicePublic = z.infer<typeof MonitorDevicePublicSchema>;
