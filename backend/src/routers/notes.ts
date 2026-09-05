import type { FastifyInstance } from "fastify";
import { createNote, deleteNote, loadNotes, NOTE_COLORS, updateNote } from "../notes.js";

export async function createNotesRoutes(app: FastifyInstance): Promise<void> {
    app.get("/api/notes", async () => {
        const notes = loadNotes();
        return { notes };
    });

    app.post("/api/notes", async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        const text = String(body?.text ?? "").trim();
        if (!text) return reply.code(400).send({ ok: false, error: "texto vazio" });
        if (text.length > 10000) return reply.code(400).send({ ok: false, error: "texto muito longo (máx 10000)" });
        const colorRaw = body?.color != null ? String(body.color) : "yellow";
        const color = (NOTE_COLORS as string[]).includes(colorRaw) ? colorRaw : "yellow";
        const createdBy = body?.createdBy != null ? String(body.createdBy) : null;
        const note = createNote(text, { color: color as never, createdBy });
        return { ok: true, note };
    });

    app.patch("/api/notes/:id", async (request, reply) => {
        const params = request.params as Record<string, string>;
        const id = String(params.id ?? "");
        if (!id) return reply.code(400).send({ ok: false, error: "id vazio" });
        const body = request.body as Record<string, unknown> | null;
        if (!body || (body.text === undefined && body.color === undefined)) {
            return reply.code(400).send({ ok: false, error: "nada para atualizar" });
        }
        const patch: Record<string, unknown> = {};
        if (body.text !== undefined) {
            const t = String(body.text);
            if (!t.trim()) return reply.code(400).send({ ok: false, error: "texto vazio" });
            if (t.length > 10000) return reply.code(400).send({ ok: false, error: "texto muito longo" });
            patch.text = t;
        }
        if (body.color !== undefined) {
            const c = String(body.color);
            if (!(NOTE_COLORS as string[]).includes(c)) return reply.code(400).send({ ok: false, error: `cor inválida: ${c}` });
            patch.color = c;
        }
        const updated = updateNote(id, patch as never);
        if (!updated) return reply.code(404).send({ ok: false, error: "nota não encontrada" });
        return { ok: true, note: updated };
    });

    app.delete("/api/notes/:id", async (request, reply) => {
        const params = request.params as Record<string, string>;
        const id = String(params.id ?? "");
        if (!id) return reply.code(400).send({ ok: false, error: "id vazio" });
        const ok = deleteNote(id);
        if (!ok) return reply.code(404).send({ ok: false, error: "nota não encontrada" });
        return { ok: true };
    });
}
