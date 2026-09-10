import type { FastifyInstance } from "fastify";
import { firmwareDir, inDocker } from "../config.js";
import {
  firmwarePublic,
  isFlashRunning,
  renderSecretsH,
  saveFirmwareWifi,
  startFlash,
} from "../firmware.js";
import { lanIPv4 } from "../netutil.js";
import { FirmwareWifiPatchSchema } from "../schemas/firmware.js";

function usageLan(listenPort: number): string {
  const ips = lanIPv4();
  const local = `http://127.0.0.1:${listenPort}/usage`;
  return ips.length ? `http://${ips[0]}:${listenPort}/usage` : local;
}

function listenPortOf(app: FastifyInstance): number {
  return (app as unknown as { listenPort?: number }).listenPort ?? 8787;
}

export async function createFirmwareRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/firmware", { schema: { tags: ["Firmware"] } }, async () => {
    return firmwarePublic(usageLan(listenPortOf(app)));
  });

  app.put("/api/firmware", { schema: { tags: ["Firmware"] } }, async (request, reply) => {
    const parsed = FirmwareWifiPatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ ok: false, error: "dados inválidos" });
    const out = saveFirmwareWifi(parsed.data, usageLan(listenPortOf(app)));
    if (!out.ok) return reply.code(400).send({ ok: false, error: out.error ?? "não foi possível gravar" });
    return {
      ok: true,
      secrets_path: out.secrets_path,
      wrote_secrets: out.wrote_secrets,
      firmware: firmwarePublic(usageLan(listenPortOf(app))),
    };
  });

  app.post("/api/firmware/file", { schema: { tags: ["Firmware"] } }, async (request, reply) => {
    const parsed = FirmwareWifiPatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ ok: false, error: "dados inválidos" });
    const saved = saveFirmwareWifi(parsed.data, usageLan(listenPortOf(app)));
    if (!saved.ok) return reply.code(400).send({ ok: false, error: saved.error ?? "não foi possível gravar" });
    const body = renderSecretsH(saved.ssid, saved.password, usageLan(listenPortOf(app)));
    return reply.type("text/plain; charset=utf-8").send(body);
  });

  app.post("/api/firmware/flash", { schema: { tags: ["Firmware"] } }, async (request, reply) => {
    if (inDocker()) {
      return reply.code(400).send({ ok: false, error: "Não dá pra gravar a USB de dentro do Docker." });
    }
    if (isFlashRunning()) {
      return reply.code(409).send({ ok: false, error: "Já tem uma gravação em andamento." });
    }
    const parsed = FirmwareWifiPatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ ok: false, error: "dados inválidos" });
    const url = usageLan(listenPortOf(app));
    const preview = firmwarePublic(url);
    if (!preview.can_flash) {
      return reply.code(400).send({ ok: false, error: preview.reason ?? "Não é possível gravar a placa daqui." });
    }
    const saved = saveFirmwareWifi(parsed.data, url);
    if (!saved.ok) return reply.code(400).send({ ok: false, error: saved.error ?? "não foi possível gravar o secrets.h" });
    if (!saved.wrote_secrets) {
      return reply.code(400).send({
        ok: false,
        error: `Não achei firmware/ em ${firmwareDir()}. Rode o coletor no checkout do Vigia.`,
      });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    });
    try {
      await startFlash((chunk) => {
        reply.raw.write(chunk);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reply.raw.write(`\n${msg}\n`);
    }
    reply.raw.end();
  });
}
