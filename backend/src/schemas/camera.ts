import { z } from "zod";

// Config da câmera IP local (protótipo). Guardada em backend/data/camera.json
// (gitignored) — nunca no firmware nem no git. Câmeras baratas tipo Yoosee/
// HiIP costumam exigir RTSP Digest + transporte UDP (o TCP interleaved quebra
// em vários firmwares clone — ver histórico da investigação desta feature).
export const CameraConfigSchema = z.object({
  host: z.string().default(""),
  port: z.number().int().min(1).max(65535).default(554),
  path: z.string().default("onvif1"),
  username: z.string().default("admin"),
  password: z.string().default(""),
});
export type CameraConfig = z.infer<typeof CameraConfigSchema>;

export const CameraConfigPatchSchema = CameraConfigSchema.partial();
export type CameraConfigPatch = z.infer<typeof CameraConfigPatchSchema>;

// Público: nunca devolve a senha (mesmo padrão dos outros secrets do config.json).
export const CameraConfigPublicSchema = z.object({
  configured: z.boolean(),
  host: z.string(),
  port: z.number().int(),
  path: z.string(),
  username: z.string(),
});
export type CameraConfigPublic = z.infer<typeof CameraConfigPublicSchema>;
