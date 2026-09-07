import { z } from "zod";

// Config remota da mineração (protótipo — ver .agents/PLANO_MINERACAO.md).
// Guardada em backend/data/mining.json (gitignored), nunca no firmware nem no git.
export const MiningConfigSchema = z.object({
  enabled: z.boolean().default(false),
  poolUrl: z.string().default("public-pool.io"),
  poolPort: z.number().int().min(1).max(65535).default(3333),
  btcWallet: z.string().default(""),
  workerName: z.string().default(""),
});
export type MiningConfig = z.infer<typeof MiningConfigSchema>;

export const MiningConfigPatchSchema = MiningConfigSchema.partial();
export type MiningConfigPatch = z.infer<typeof MiningConfigPatchSchema>;

// Status: quem realmente decide se está minerando agora é a VIEW_MINER no
// device (entrar liga, sair desliga) — este relatório só chega enquanto a
// placa estiver de fato na rota. Fora dela, o painel mostra o último report
// como parado (ver `stale` em MiningStatusSchema).
export const MiningStatusValueSchema = z.enum([
  "idle",
  "no_wifi",
  "connecting",
  "mining",
  "pool_offline",
  "error",
]);
export type MiningStatusValue = z.infer<typeof MiningStatusValueSchema>;

export const MiningReportSchema = z.object({
  status: MiningStatusValueSchema,
  hashrateCurrent: z.number().nonnegative().default(0),
  hashrateAvg: z.number().nonnegative().default(0),
  sharesAccepted: z.number().int().nonnegative().default(0),
  sharesRejected: z.number().int().nonnegative().default(0),
  bestDifficulty: z.number().nonnegative().default(0),
  blockHeight: z.number().int().nonnegative().default(0),
  uptimeS: z.number().int().nonnegative().default(0),
  lastError: z.string().default(""),
});
export type MiningReport = z.infer<typeof MiningReportSchema>;

export const MiningStatusSchema = MiningReportSchema.extend({
  reportedAt: z.string().nullable(),
  stale: z.boolean(),
});
export type MiningStatus = z.infer<typeof MiningStatusSchema>;
