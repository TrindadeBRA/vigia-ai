import { describe, it, expect } from "vitest";
import { findNearby, haversineM, minutesUntil, parsePrevisaoParada, stopCacheAgeDays } from "./sptrans.js";

describe("minutesUntil", () => {
  it("retorna null para t ausente ou inválido", () => {
    expect(minutesUntil(null)).toBeNull();
    expect(minutesUntil(undefined)).toBeNull();
    expect(minutesUntil("")).toBeNull();
    expect(minutesUntil("agora")).toBeNull();
  });

  it("retorna 0 para o minuto atual de SP", () => {
    const nowSp = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    expect(minutesUntil(nowSp)).toBe(0);
  });

  it("rola +24h quando o horário já passou", () => {
    const nowSp = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    const [nh, nm] = nowSp.split(":").map(Number);
    const pastH = (nh + 23) % 24;
    const past = `${String(pastH).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
    expect(minutesUntil(past)).toBe(1380);
  });
});

const RAW_PREVISAO = {
  hr: "20:09",
  p: {
    cp: 4200953,
    np: "PARADA ROBERTO SELMI DEI B/C",
    py: -23.675901,
    px: -46.752812,
    l: [
      {
        c: "7021-10",
        cl: 1989,
        sl: 1,
        lt0: "TERM. JOAO DIAS",
        lt1: "JD. MARACA",
        qv: 1,
        vs: [{ p: "74558", t: "23:11", a: true, ta: "2017-05-07T23:09:05Z", py: -23.67603, px: -46.75891 }],
      },
      {
        c: "675K-10",
        cl: 198,
        sl: 1,
        lt0: "METRO STA CRUZ",
        lt1: "TERM. JD. ANGELA",
        qv: 0,
        vs: [],
      },
    ],
  },
};

describe("parsePrevisaoParada", () => {
  it("parseia linhas com next + mins", () => {
    const out = parsePrevisaoParada(RAW_PREVISAO, 4200953);
    expect(out.ok).toBe(true);
    expect(out.np).toBe("PARADA ROBERTO SELMI DEI B/C");
    expect(out.lines).toHaveLength(2);
    const first = out.lines[0];
    expect(first.c).toBe("7021-10");
    expect(first.next?.p).toBe("74558");
    expect(first.next?.t).toBe("23:11");
    expect(typeof first.next?.mins).toBe("number");
    expect(first.next?.a).toBe(true);
  });

  it("linha sem veículo tem next null", () => {
    const out = parsePrevisaoParada(RAW_PREVISAO, 4200953);
    const empty = out.lines.find((l) => l.cl === 198);
    expect(empty?.next).toBeNull();
    expect(empty?.vehicles).toEqual([]);
  });

  it("filtra só linhas monitoradas", () => {
    const out = parsePrevisaoParada(RAW_PREVISAO, 4200953, [198]);
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0].cl).toBe(198);
  });

  it("resposta sem ponto vira lista vazia ok", () => {
    const out = parsePrevisaoParada({ hr: "20:09", p: null }, 1);
    expect(out.ok).toBe(true);
    expect(out.lines).toEqual([]);
  });

  it("resposta malformada vira ok:false", () => {
    const out = parsePrevisaoParada([], 1);
    expect(out.ok).toBe(false);
  });
});

describe("haversineM", () => {
  it("mesmo ponto dá zero", () => {
    expect(haversineM(-23.55, -46.63, -23.55, -46.63)).toBe(0);
  });

  it("Sé x Paulista dá ~2,6 km", () => {
    const m = haversineM(-23.5505, -46.6333, -23.5614, -46.6559);
    expect(m).toBeGreaterThan(2000);
    expect(m).toBeLessThan(3500);
  });
});

describe("findNearby", () => {
  const stops = [
    { cp: 1, np: "LONGE", ed: "", py: -23.7, px: -46.7, cc: 1 },
    { cp: 2, np: "PERTO", ed: "", py: -23.5506, px: -46.6334, cc: 1 },
    { cp: 3, np: "MEDIO", ed: "", py: -23.56, px: -46.64, cc: 2 },
  ];

  it("ordena por distância com distance_m", () => {
    const out = findNearby(-23.5505, -46.6333, 10, stops);
    expect(out.map((s) => s.cp)).toEqual([2, 3, 1]);
    expect(out[0].distance_m).toBeGreaterThanOrEqual(0);
    expect(out[0].distance_m).toBeLessThan(out[2].distance_m);
  });

  it("respeita o limite", () => {
    expect(findNearby(-23.5505, -46.6333, 2, stops)).toHaveLength(2);
  });

  it("lista vazia sem banco", () => {
    expect(findNearby(-23.55, -46.63, 10, [])).toEqual([]);
  });
});

describe("stopCacheAgeDays", () => {
  it("null sem cache", () => {
    expect(stopCacheAgeDays(null)).toBeNull();
  });

  it("~0 para cache recém-criado", () => {
    const age = stopCacheAgeDays({ updated_at: new Date().toISOString(), count: 1, stops: [] });
    expect(age).not.toBeNull();
    expect(age as number).toBeLessThan(0.01);
  });
});
