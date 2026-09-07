import { z } from "zod";

// Config de dispositivos Android via ADB (protótipo inspirado no scrcpy).
// Guardada em backend/data/android.json (gitignored) — nunca no firmware.
// Cada dispositivo pode ser USB (serial) ou TCP/IP (host:port). O coletor
// usa o binário `adb` do host para descobrir, conectar e espelhar.

export const AndroidDeviceSchema = z.object({
    id: z.string(),
    label: z.string().default(""),
    // Conexão TCP/IP manual (ex.: 192.168.1.10:5555). Se vazio, é USB.
    host: z.string().default(""),
    port: z.number().int().min(1).max(65535).default(5555),
    // Serial USB/ADB (ex.: emulator-5554, 14ed...). Preenchido após discovery.
    serial: z.string().default(""),
    // Se true, tenta `adb connect host:port` automaticamente no boot.
    autoConnect: z.boolean().default(false),
});
export type AndroidDevice = z.infer<typeof AndroidDeviceSchema>;

export const AndroidFileSchema = z.object({
    devices: z.array(AndroidDeviceSchema).default([]),
});
export type AndroidFile = z.infer<typeof AndroidFileSchema>;

export const AndroidCreateSchema = z.object({
    label: z.string().default(""),
    host: z.string().default(""),
    port: z.number().int().min(1).max(65535).default(5555),
    serial: z.string().default(""),
    autoConnect: z.boolean().default(false),
});
export type AndroidCreate = z.infer<typeof AndroidCreateSchema>;

export const AndroidPatchSchema = AndroidDeviceSchema.omit({ id: true }).partial();
export type AndroidPatch = z.infer<typeof AndroidPatchSchema>;

// Público: sem segredos, mas com status ao vivo (online/offline).
export const AndroidDevicePublicSchema = z.object({
    id: z.string(),
    label: z.string(),
    host: z.string(),
    port: z.number().int(),
    serial: z.string(),
    autoConnect: z.boolean(),
    configured: z.boolean(),
    // Preenchido em tempo real via `adb devices`
    online: z.boolean().default(false),
    state: z.string().default("offline"),
    model: z.string().nullable().default(null),
});
export type AndroidDevicePublic = z.infer<typeof AndroidDevicePublicSchema>;

export const AndroidInputSchema = z.object({
    action: z.enum(["tap", "swipe", "key", "text", "back", "home", "menu", "power", "wake", "sleep"]),
    x: z.number().min(0).max(10000).optional(),
    y: z.number().min(0).max(10000).optional(),
    x2: z.number().min(0).max(10000).optional(),
    y2: z.number().min(0).max(10000).optional(),
    duration: z.number().min(0).max(5000).optional(),
    keycode: z.number().int().min(0).max(1000).optional(),
    text: z.string().max(500).optional(),
});
export type AndroidInput = z.infer<typeof AndroidInputSchema>;
