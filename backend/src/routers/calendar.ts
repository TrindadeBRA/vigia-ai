import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { deleteCalendarIcsFile, fetchCalendarSource, MAX_ICS_BYTES, saveCalendarIcsFile } from "../providers/calendar.js";
import { load, updateSync as update } from "../store.js";

function clampLimit(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(50, Math.trunc(n)));
}

function normalizeUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  if (s.toLowerCase().startsWith("webcal://")) s = "https://" + s.slice(9);
  return s;
}

export async function createCalendarRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/calendar/config", { schema: { tags: ["Calendário"] } }, async () => {
    const cfg = load() as Record<string, unknown>;
    return (cfg.calendar ?? { enabled: false, hidden: false, calendars: [] }) as Record<string, unknown>;
  });

  app.patch("/api/calendar/config", { schema: { tags: ["Calendário"] } }, async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
    update((cfg: Record<string, unknown>) => {
      const c = (cfg.calendar ?? {}) as Record<string, unknown>;
      if (!cfg.calendar) cfg.calendar = c;
      if (body.enabled !== undefined && body.enabled !== null) { c.enabled = Boolean(body.enabled); c.hidden = !Boolean(body.enabled); }
      else if (body.hidden !== undefined && body.hidden !== null) { c.hidden = Boolean(body.hidden); c.enabled = !Boolean(body.hidden); }
    });
    const cfg = load() as Record<string, unknown>;
    return (cfg.calendar ?? {}) as Record<string, unknown>;
  });

  app.post("/api/calendar/calendars", { schema: { tags: ["Calendário"] } }, async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body.url !== "string" || !String(body.url).trim()) {
      return reply.code(400).send({ ok: false, error: "url é obrigatória (link público do calendário)" });
    }
    const url = normalizeUrl(String(body.url));
    const label = String(body.label ?? "").trim();
    const kind = body.kind === "tasks" ? "tasks" : "events";
    const limit = body.limit != null ? clampLimit(body.limit) : 5;

    try { new URL(url); } catch { return reply.code(400).send({ ok: false, error: "URL inválida" }); }
    if (!/^https?:\/\//i.test(url)) return reply.code(400).send({ ok: false, error: "URL deve ser http(s) ou webcal" });

    // valida que o ICS é acessível antes de salvar
    const probeId = randomBytes(4).toString("hex");
    const probe = await fetchCalendarSource({ id: probeId, url, label, kind, limit });
    if (!probe.ok) {
      return reply.code(400).send({ ok: false, error: probe.error || "Não foi possível acessar o calendário" });
    }

    const id = randomBytes(4).toString("hex");
    update((cfg: Record<string, unknown>) => {
      const c = (cfg.calendar ?? {}) as Record<string, unknown>;
      if (!cfg.calendar) cfg.calendar = c;
      const list = Array.isArray(c.calendars) ? [...(c.calendars as unknown[])] : [];
      list.push({ id, url, label, kind, limit, sourceType: "url" });
      c.calendars = list;
      c.enabled = true;
      c.hidden = false;
    });
    const cfg = load() as Record<string, unknown>;
    return { ok: true, id, config: cfg.calendar };
  });

  // POST — envia um arquivo .ics local (sem link público disponível, ex.:
  // agenda corporativa cujo admin do Workspace desabilitou o endereço secreto).
  app.post("/api/calendar/calendars/upload", { schema: { tags: ["Calendário"] } }, async (request, reply) => {
    const contentType = String(request.headers["content-type"] ?? "");
    if (!contentType.includes("multipart/form-data")) {
      return reply.code(400).send({ ok: false, error: "envie como multipart/form-data (campo file)" });
    }
    const anyRequest = request as unknown as {
      parts: () => AsyncIterableIterator<
        | { type: "file"; fieldname: string; toBuffer: () => Promise<Buffer> }
        | { type: "field"; fieldname: string; value: unknown }
      >;
    };
    let fileBuf: Buffer | null = null;
    let label = "";
    let kind: "events" | "tasks" = "events";
    let limit = 5;
    for await (const part of anyRequest.parts()) {
      if (part.type === "file") {
        if (!fileBuf && part.fieldname === "file") fileBuf = await part.toBuffer();
        else await part.toBuffer();
      } else if (part.fieldname === "label") {
        label = String(part.value ?? "").trim();
      } else if (part.fieldname === "kind") {
        kind = String(part.value ?? "") === "tasks" ? "tasks" : "events";
      } else if (part.fieldname === "limit") {
        limit = clampLimit(part.value);
      }
    }
    if (!fileBuf || fileBuf.length === 0) {
      return reply.code(400).send({ ok: false, error: "campo file (.ics) obrigatório" });
    }
    if (fileBuf.length > MAX_ICS_BYTES) {
      return reply.code(413).send({ ok: false, error: "arquivo .ics muito grande" });
    }

    const id = randomBytes(4).toString("hex");
    saveCalendarIcsFile(id, fileBuf);
    const validated = await fetchCalendarSource({ id, url: "", label, kind, limit, sourceType: "file" });
    if (!validated.ok) {
      deleteCalendarIcsFile(id);
      return reply.code(400).send({ ok: false, error: validated.error || "arquivo .ics inválido" });
    }

    update((cfg: Record<string, unknown>) => {
      const c = (cfg.calendar ?? {}) as Record<string, unknown>;
      if (!cfg.calendar) cfg.calendar = c;
      const list = Array.isArray(c.calendars) ? [...(c.calendars as unknown[])] : [];
      list.push({ id, url: "", label, kind, limit, sourceType: "file" });
      c.calendars = list;
      c.enabled = true;
      c.hidden = false;
    });
    const cfg = load() as Record<string, unknown>;
    return { ok: true, id, config: cfg.calendar };
  });

  app.patch("/api/calendar/calendars/:id", { schema: { tags: ["Calendário"] } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });

    const cfg = load() as Record<string, unknown>;
    const c = (cfg.calendar ?? {}) as Record<string, unknown>;
    const list = Array.isArray(c.calendars) ? c.calendars as Array<Record<string, unknown>> : [];
    const idx = list.findIndex((r) => String(r.id) === id);
    if (idx === -1) return reply.code(404).send({ ok: false, error: "calendário não encontrado" });

    const current = list[idx];
    const isFile = current.sourceType === "file";
    const nextLabel = body.label != null ? String(body.label).trim() : String(current.label ?? "");
    const nextKind = body.kind != null ? (body.kind === "tasks" ? "tasks" : "events") : String(current.kind ?? "events");
    const nextLimit = body.limit != null ? clampLimit(body.limit) : Number(current.limit ?? 5);

    // Calendário enviado como arquivo: sem link pra editar/revalidar, só label/kind/limit.
    if (isFile) {
      update((cfg2: Record<string, unknown>) => {
        const cc = (cfg2.calendar ?? {}) as Record<string, unknown>;
        const ll = Array.isArray(cc.calendars) ? cc.calendars as Array<Record<string, unknown>> : [];
        const i = ll.findIndex((r) => String(r.id) === id);
        if (i === -1) return;
        ll[i] = { ...ll[i], label: nextLabel, kind: nextKind, limit: nextLimit };
        cc.calendars = ll;
      });
      const updated = load() as Record<string, unknown>;
      return { ok: true, config: updated.calendar };
    }

    const nextUrl = body.url != null ? normalizeUrl(String(body.url).trim()) : String(current.url);
    if (!nextUrl) return reply.code(400).send({ ok: false, error: "url não pode ser vazia" });
    try { new URL(nextUrl); } catch { return reply.code(400).send({ ok: false, error: "URL inválida" }); }

    if (nextUrl !== String(current.url)) {
      const probe = await fetchCalendarSource({ id, url: nextUrl, label: nextLabel, kind: nextKind as "events" | "tasks", limit: nextLimit, sourceType: "url" });
      if (!probe.ok) return reply.code(400).send({ ok: false, error: probe.error || "Não foi possível acessar o calendário" });
    }

    update((cfg2: Record<string, unknown>) => {
      const cc = (cfg2.calendar ?? {}) as Record<string, unknown>;
      const ll = Array.isArray(cc.calendars) ? cc.calendars as Array<Record<string, unknown>> : [];
      const i = ll.findIndex((r) => String(r.id) === id);
      if (i === -1) return;
      ll[i] = { ...ll[i], url: nextUrl, label: nextLabel, kind: nextKind, limit: nextLimit, sourceType: "url" };
      cc.calendars = ll;
    });
    const updated = load() as Record<string, unknown>;
    return { ok: true, config: updated.calendar };
  });

  app.delete("/api/calendar/calendars/:id", { schema: { tags: ["Calendário"] } }, async (request) => {
    const { id } = request.params as { id: string };
    update((cfg: Record<string, unknown>) => {
      const c = (cfg.calendar ?? {}) as Record<string, unknown>;
      if (!cfg.calendar) cfg.calendar = c;
      const list = Array.isArray(c.calendars) ? c.calendars as Array<Record<string, unknown>> : [];
      const removed = list.find((r) => String(r.id) === id);
      if (removed && removed.sourceType === "file") deleteCalendarIcsFile(id);
      c.calendars = list.filter((r) => String(r.id) !== id);
    });
    return { ok: true };
  });

  app.get("/api/calendar", { schema: { tags: ["Calendário"] } }, async () => {
    const cfg = load() as Record<string, unknown>;
    const c = (cfg.calendar ?? {}) as Record<string, unknown>;
    if (c.hidden || !c.enabled) return { ok: true, error: null, updated_at: null, calendars: [] };
    if (cfg.mock) {
      const { mockCalendarPayload } = await import("../providers/calendar.js");
      return mockCalendarPayload();
    }
    const { fetchCalendarSources } = await import("../providers/calendar.js");
    const { utcNow } = await import("../formatting.js");
    try {
      const calendars = await fetchCalendarSources(cfg);
      const ok = calendars.every((x) => x.ok);
      return { ok, error: ok ? null : calendars.find((x) => !x.ok)?.error || null, updated_at: utcNow(), calendars };
    } catch (e) {
      const { utcNow: now } = await import("../formatting.js");
      return { ok: false, error: String(e), updated_at: now(), calendars: [] };
    }
  });

  // preview: testa uma URL sem salvar
  app.post("/api/calendar/preview", { schema: { tags: ["Calendário"] } }, async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body.url !== "string" || !String(body.url).trim()) {
      return reply.code(400).send({ ok: false, error: "url é obrigatória" });
    }
    const url = normalizeUrl(String(body.url).trim());
    const kind = body.kind === "tasks" ? "tasks" : "events";
    const limit = body.limit != null ? clampLimit(body.limit) : 5;
    const result = await fetchCalendarSource({ id: "preview", url, label: String(body.label ?? ""), kind, limit });
    return result;
  });
}
