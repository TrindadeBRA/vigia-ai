import { z } from "zod";

// Config de câmeras IP locais (protótipo). Guardada em backend/data/camera.json
// (gitignored) — nunca no firmware nem no git. Câmeras baratas tipo Yoosee/
// HiIP costumam exigir RTSP Digest + transporte UDP (o TCP interleaved quebra
// em vários firmwares clone — ver histórico da investigação desta feature).
// Suporta múltiplas câmeras; câmeras com motor PTZ falam ONVIF SOAP numa porta
// separada da porta RTSP (ver providers/onvifPtz.ts).
export const CameraItemSchema = z.object({
  id: z.string(),
  label: z.string().default(""),
  host: z.string().default(""),
  port: z.number().int().min(1).max(65535).default(554),
  path: z.string().default("onvif1"),
  username: z.string().default("admin"),
  password: z.string().default(""),
  ptzEnabled: z.boolean().default(false),
  onvifPort: z.number().int().min(1).max(65535).default(5000),
});
export type CameraItem = z.infer<typeof CameraItemSchema>;

export const CamerasFileSchema = z.object({
  cameras: z.array(CameraItemSchema).default([]),
});
export type CamerasFile = z.infer<typeof CamerasFileSchema>;

export const CameraCreateSchema = z.object({
  label: z.string().default(""),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(554),
  path: z.string().default("onvif1"),
  username: z.string().default("admin"),
  password: z.string().default(""),
  ptzEnabled: z.boolean().default(false),
  onvifPort: z.number().int().min(1).max(65535).default(5000),
});
export type CameraCreate = z.infer<typeof CameraCreateSchema>;

export const CameraPatchSchema = CameraItemSchema.omit({ id: true }).partial();
export type CameraPatch = z.infer<typeof CameraPatchSchema>;

// Público: nunca devolve a senha (mesmo padrão dos outros secrets do config.json).
export const CameraItemPublicSchema = z.object({
  id: z.string(),
  label: z.string(),
  host: z.string(),
  port: z.number().int(),
  path: z.string(),
  username: z.string(),
  ptzEnabled: z.boolean(),
  onvifPort: z.number().int(),
  configured: z.boolean(),
});
export type CameraItemPublic = z.infer<typeof CameraItemPublicSchema>;

// Campos RTSP relevantes pra decidir se um stream/snapshot em cache precisa
// ser derrubado depois de um PATCH (mudar só label/ptzEnabled não precisa).
export const RTSP_FIELDS = ["host", "port", "path", "username", "password"] as const;
