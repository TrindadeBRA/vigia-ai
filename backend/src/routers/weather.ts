import type { FastifyInstance } from "fastify";
import {
  VALID_CURRENT,
  VALID_DAILY,
  VALID_HOURLY,
  VALID_TEMPERATURE_UNITS,
  VALID_WIND_UNITS,
  VALID_PRECIPITATION_UNITS,
  fetchWeatherData,
  mockWeatherPayload,
  searchCities,
} from "../providers/weather.js";
import { load, updateSync as update } from "../store.js";

export async function createWeatherRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/weather/config", async () => {
    const cfg = load() as Record<string, unknown>;
    const raw = (cfg.weather ?? {}) as Record<string, unknown>;
    return raw;
  });

  app.patch("/api/weather/config", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
    if (body.temperature_unit !== undefined && body.temperature_unit !== null && !VALID_TEMPERATURE_UNITS.has(String(body.temperature_unit))) {
      return reply.code(400).send({ ok: false, error: `temperature_unit inválido: ${body.temperature_unit}` });
    }
    if (body.wind_speed_unit !== undefined && body.wind_speed_unit !== null && !VALID_WIND_UNITS.has(String(body.wind_speed_unit))) {
      return reply.code(400).send({ ok: false, error: `wind_speed_unit inválido: ${body.wind_speed_unit}` });
    }
    if (body.precipitation_unit !== undefined && body.precipitation_unit !== null && !VALID_PRECIPITATION_UNITS.has(String(body.precipitation_unit))) {
      return reply.code(400).send({ ok: false, error: `precipitation_unit inválido: ${body.precipitation_unit}` });
    }
    if (body.current !== undefined && body.current !== null) {
      const invalid = (body.current as string[]).filter((x) => !VALID_CURRENT.has(x));
      if (invalid.length) return reply.code(400).send({ ok: false, error: `current inválido: ${invalid.join(", ")}` });
    }
    if (body.hourly !== undefined && body.hourly !== null) {
      const invalid = (body.hourly as string[]).filter((x) => !VALID_HOURLY.has(x));
      if (invalid.length) return reply.code(400).send({ ok: false, error: `hourly inválido: ${invalid.join(", ")}` });
    }
    if (body.daily !== undefined && body.daily !== null) {
      const invalid = (body.daily as string[]).filter((x) => !VALID_DAILY.has(x));
      if (invalid.length) return reply.code(400).send({ ok: false, error: `daily inválido: ${invalid.join(", ")}` });
    }

    update((cfg: Record<string, unknown>) => {
      const w = (cfg.weather ?? {}) as Record<string, unknown>;
      if (!cfg.weather) cfg.weather = w;
      const loc = (w.location ?? {}) as Record<string, unknown>;
      if (!w.location) w.location = loc;
      const units = (w.units ?? {}) as Record<string, unknown>;
      if (!w.units) w.units = units;
      const disp = (w.display ?? {}) as Record<string, unknown>;
      if (!w.display) w.display = disp;
      const fields = (disp.fields ?? {}) as Record<string, unknown>;
      if (!disp.fields) disp.fields = fields;

      if (body.enabled !== undefined && body.enabled !== null) { w.enabled = Boolean(body.enabled); w.hidden = !Boolean(body.enabled); }
      else if (body.hidden !== undefined && body.hidden !== null) { w.hidden = Boolean(body.hidden); w.enabled = !Boolean(body.hidden); }
      if (body.name !== undefined && body.name !== null) loc.name = String(body.name).trim();
      if (body.latitude !== undefined && body.latitude !== null) loc.latitude = Number(body.latitude);
      if (body.longitude !== undefined && body.longitude !== null) loc.longitude = Number(body.longitude);
      if (body.country !== undefined && body.country !== null) loc.country = String(body.country).trim();
      if (body.country_code !== undefined && body.country_code !== null) loc.country_code = String(body.country_code).trim();
      if (body.timezone !== undefined && body.timezone !== null) { const tz = String(body.timezone).trim() || "auto"; loc.timezone = tz; w.timezone = tz; }
      if (body.elevation !== undefined && body.elevation !== null) loc.elevation = Number(body.elevation);
      if (body.temperature_unit !== undefined && body.temperature_unit !== null) units.temperature_unit = String(body.temperature_unit);
      if (body.wind_speed_unit !== undefined && body.wind_speed_unit !== null) units.wind_speed_unit = String(body.wind_speed_unit);
      if (body.precipitation_unit !== undefined && body.precipitation_unit !== null) units.precipitation_unit = String(body.precipitation_unit);
      if (body.forecast_days !== undefined && body.forecast_days !== null) w.forecast_days = Number(body.forecast_days);
      if (body.past_days !== undefined && body.past_days !== null) w.past_days = Number(body.past_days);
      if (body.current !== undefined && body.current !== null) w.current = body.current;
      if (body.hourly !== undefined && body.hourly !== null) w.hourly = body.hourly;
      if (body.daily !== undefined && body.daily !== null) w.daily = body.daily;
      if (body.display_show_current !== undefined && body.display_show_current !== null) disp.show_current = Boolean(body.display_show_current);
      if (body.display_show_hourly !== undefined && body.display_show_hourly !== null) disp.show_hourly = Boolean(body.display_show_hourly);
      if (body.display_show_daily !== undefined && body.display_show_daily !== null) disp.show_daily = Boolean(body.display_show_daily);
      if (body.display_hourly_count !== undefined && body.display_hourly_count !== null) disp.hourly_count = Number(body.display_hourly_count);
      if (body.display_daily_count !== undefined && body.display_daily_count !== null) { disp.display_daily_count = Number(body.display_daily_count); disp.daily_count = Number(body.display_daily_count); }
      if (body.display_fields !== undefined && body.display_fields !== null) {
        for (const [k, v] of Object.entries(body.display_fields as Record<string, unknown>)) {
          if (k in fields) fields[k] = Boolean(v);
        }
      }
    });
    const cfg = load() as Record<string, unknown>;
    return (cfg.weather ?? {}) as Record<string, unknown>;
  });

  app.get("/api/weather/geocoding", async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, string>;
    const q = String(query.q ?? "");
    const count = Number(query.count ?? 5);
    const language = String(query.language ?? "pt");
    if (!q || q.trim().length < 2) return reply.code(400).send({ ok: false, error: "q deve ter pelo menos 2 caracteres" });
    try {
      const data = await searchCities(q, count, language);
      return data;
    } catch (exc) {
      return reply.code(502).send({ ok: false, error: String(exc) });
    }
  });

  app.get("/api/weather", async () => {
    const cfg = load() as Record<string, unknown>;
    const wcfg = (cfg.weather ?? {}) as Record<string, unknown>;
    if (cfg.mock && wcfg.enabled) return mockWeatherPayload();
    const data = await fetchWeatherData(wcfg);
    return data;
  });

  app.post("/api/weather/location", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
    const name = String(body.name ?? "").trim();
    const lat = body.latitude;
    const lon = body.longitude;
    if (lat === null || lat === undefined || lon === null || lon === undefined) return reply.code(400).send({ ok: false, error: "latitude e longitude são obrigatórios" });
    let latF: number, lonF: number;
    try { latF = Number(lat); lonF = Number(lon); if (Number.isNaN(latF) || Number.isNaN(lonF)) throw new Error(); } catch { return reply.code(400).send({ ok: false, error: "latitude/longitude inválidos" }); }
    if (!( -90 <= latF && latF <= 90 && -180 <= lonF && lonF <= 180)) return reply.code(400).send({ ok: false, error: "latitude/longitude fora do intervalo" });
    update((cfg: Record<string, unknown>) => {
      const w = (cfg.weather ?? {}) as Record<string, unknown>;
      if (!cfg.weather) cfg.weather = w;
      const loc = (w.location ?? {}) as Record<string, unknown>;
      if (!w.location) w.location = loc;
      loc.name = name;
      loc.latitude = latF;
      loc.longitude = lonF;
      if (body.country !== undefined && body.country !== null) loc.country = String(body.country).trim();
      if (body.country_code !== undefined && body.country_code !== null) loc.country_code = String(body.country_code).trim();
      if (body.timezone !== undefined && body.timezone !== null) { const tz = String(body.timezone).trim() || "auto"; loc.timezone = tz; w.timezone = tz; }
      if (body.elevation !== undefined && body.elevation !== null) { try { loc.elevation = Number(body.elevation); } catch {} }
      w.enabled = true;
      w.hidden = false;
    });
    const cfg = load() as Record<string, unknown>;
    return (cfg.weather ?? {}) as Record<string, unknown>;
  });
}
