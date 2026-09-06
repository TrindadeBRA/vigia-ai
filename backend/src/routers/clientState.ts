import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../config.js";

// Blobs pequenos e sem CRUD por item (preferências de tela, rascunho do
// editor de tema, estado do easter egg) — GET devolve o JSON salvo (ou {}
// se nunca foi salvo), PUT substitui o arquivo inteiro. Generoso o
// suficiente pro rascunho de tema (ícones/textos/wallpaper id), pequeno
// pra qualquer outra coisa.
const MAX_BYTES = 2_000_000;

function registerBlobRoute(app: FastifyInstance, route: string, file: string): void {
    const filePath = () => join(dataDir(), file);

    app.get(route, async (_request, reply) => {
        const p = filePath();
        if (!existsSync(p)) return reply.type("application/json").send("{}");
        try {
            return reply.type("application/json").send(readFileSync(p));
        } catch {
            return reply.type("application/json").send("{}");
        }
    });

    app.put(route, async (request, reply) => {
        const body = request.body;
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
            return reply.code(400).send({ ok: false, error: "corpo precisa ser um objeto JSON" });
        }
        const raw = JSON.stringify(body);
        if (raw.length > MAX_BYTES) return reply.code(413).send({ ok: false, error: "corpo grande demais" });
        const p = filePath();
        mkdirSync(dataDir(), { recursive: true });
        const tmp = p + ".tmp";
        writeFileSync(tmp, raw, "utf-8");
        renameSync(tmp, p);
        return { ok: true };
    });
}

export async function createClientStateRoutes(app: FastifyInstance): Promise<void> {
    registerBlobRoute(app, "/api/prefs", "prefs.json");
    registerBlobRoute(app, "/api/theme-draft", "theme-draft.json");
    registerBlobRoute(app, "/api/retro", "retro.json");
}
