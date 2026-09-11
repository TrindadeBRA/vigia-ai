import type { FastifyInstance } from "fastify";
import { createImage, deleteImage, loadImages, updateImage } from "../images.js";

// base64 infla ~4/3 sobre o binário; upload no painel já limita a 8MB de
// arquivo (ImageWidgetModal.tsx), então ~11MB de string + folga pro JSON.
const IMAGE_BODY_LIMIT = 16_000_000;
const MAX_SRC_LEN = 12_000_000;

function isValidSrc(s: string): boolean {
    if (s.startsWith("data:image/")) return true;
    try {
        const u = new URL(s);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

export async function createImagesRoutes(app: FastifyInstance): Promise<void> {
    app.get("/api/images", { schema: { tags: ["Imagens"] } }, async () => {
        const images = loadImages();
        return { images };
    });

    app.post("/api/images", { bodyLimit: IMAGE_BODY_LIMIT, schema: { tags: ["Imagens"] } }, async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        const src = String(body?.src ?? "").trim();
        if (!src) return reply.code(400).send({ ok: false, error: "src vazio" });
        if (src.length > MAX_SRC_LEN) return reply.code(400).send({ ok: false, error: "imagem muito grande" });
        if (!isValidSrc(src)) return reply.code(400).send({ ok: false, error: "src inválido — use http(s) ou data:image/" });
        const fit = body?.fit === "contain" ? "contain" : "cover";
        const label = body?.label != null ? String(body.label) : null;
        const countdownAt = body?.countdownAt ?? body?.countdown_at ?? null;
        const countdownLabel = body?.countdownLabel ?? body?.countdown_label ?? null;
        const image = createImage(src, { fit, label, countdownAt: countdownAt as string | null, countdownLabel: countdownLabel as string | null });
        return { ok: true, image };
    });

    app.patch("/api/images/:id", { bodyLimit: IMAGE_BODY_LIMIT, schema: { tags: ["Imagens"] } }, async (request, reply) => {
        const params = request.params as Record<string, string>;
        const id = String(params.id ?? "");
        if (!id) return reply.code(400).send({ ok: false, error: "id vazio" });
        const body = request.body as Record<string, unknown> | null;
        if (!body || (body.src === undefined && body.fit === undefined && body.label === undefined && body.transform === undefined && body.countdownAt === undefined && body.countdown_at === undefined && body.countdownLabel === undefined && body.countdown_label === undefined)) {
            return reply.code(400).send({ ok: false, error: "nada para atualizar" });
        }
        const patch: Record<string, unknown> = {};
        if (body.src !== undefined) {
            const s = String(body.src).trim();
            if (!s) return reply.code(400).send({ ok: false, error: "src vazio" });
            if (s.length > MAX_SRC_LEN) return reply.code(400).send({ ok: false, error: "imagem muito grande" });
            if (!isValidSrc(s)) return reply.code(400).send({ ok: false, error: "src inválido — use http(s) ou data:image/" });
            patch.src = s;
        }
        if (body.fit !== undefined) {
            const f = String(body.fit);
            if (f !== "cover" && f !== "contain") return reply.code(400).send({ ok: false, error: `fit inválido: ${f}` });
            patch.fit = f;
        }
        if (body.label !== undefined) patch.label = body.label == null ? null : String(body.label);
        if (body.countdownAt !== undefined || body.countdown_at !== undefined) patch.countdownAt = body.countdownAt ?? body.countdown_at;
        if (body.countdownLabel !== undefined || body.countdown_label !== undefined) patch.countdownLabel = body.countdownLabel ?? body.countdown_label;
        if (body.transform !== undefined) patch.transform = body.transform;
        const updated = updateImage(id, patch as never);
        if (!updated) return reply.code(404).send({ ok: false, error: "imagem não encontrada" });
        return { ok: true, image: updated };
    });

    app.delete("/api/images/:id", { schema: { tags: ["Imagens"] } }, async (request, reply) => {
        const params = request.params as Record<string, string>;
        const id = String(params.id ?? "");
        if (!id) return reply.code(400).send({ ok: false, error: "id vazio" });
        const ok = deleteImage(id);
        if (!ok) return reply.code(404).send({ ok: false, error: "imagem não encontrada" });
        return { ok: true };
    });
}
