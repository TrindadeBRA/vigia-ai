/**
 * Provedor RetroAchievements: perfil completo de um usuário via Web API.
 * Docs: https://api-docs.retroachievements.org/
 * Endpoints usados:
 *  - API_GetUserSummary.php?y={key}&u={user}&g=3&a=5  (perfil + jogos recentes + conquistas recentes)
 *  - API_GetUserAwards.php?y={key}&u={user}           (contadores de mastery/beaten)
 *  - API_GetUserCompletionProgress.php?y={key}&u={user}&c=1&o=0 (total de jogos com progresso)
 */
import { utcNow } from "../formatting.js";
import { httpJson } from "../httpClient.js";
import { provider as providerCfg } from "../store.js";

const RA_BASE = "https://retroachievements.org/API";
const INVISIBLE = ["\ufeff", "\u200b", "\u200c", "\u200d", "\xa0"];

export const RA_USER_SUMMARY_URL = `${RA_BASE}/API_GetUserSummary.php`;
export const RA_USER_AWARDS_URL = `${RA_BASE}/API_GetUserAwards.php`;
export const RA_USER_COMPLETION_URL = `${RA_BASE}/API_GetUserCompletionProgress.php`;

export function cleanRaApiKey(raw: string): string | null {
  let text = raw.trim();
  for (const ch of INVISIBLE) text = text.split(ch).join("");
  text = [...text].filter((ch) => ch.charCodeAt(0) < 128).join("");
  text = text.split(/\s+/).filter(Boolean).join(" ");
  if (!text) return null;
  if (text.includes(" ")) return null;
  if (text.length < 8) return null;
  return text;
}

export function cleanRaUsername(raw: string): string | null {
  let text = raw.trim();
  for (const ch of INVISIBLE) text = text.split(ch).join("");
  text = text.split(/\s+/).filter(Boolean).join(" ");
  if (!text) return null;
  if (text.includes(" ")) return null;
  if (text.length < 1 || text.length > 64) return null;
  return text;
}

/**
 * Secret format: "username:apikey" ou "username|apikey" ou "username apikey"
 * Também aceita JSON: {"username":"...","key":"..."} ou {"u":"...","y":"..."}
 * Para compatibilidade, se secret não contém separador, tenta usar label como username.
 */
export function parseRaSecret(secret: string, labelFallback: string): { username: string; apiKey: string } | null {
  const raw = String(secret ?? "").trim();
  if (!raw) return null;

  // tenta JSON
  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const u = cleanRaUsername(String(obj.username ?? obj.u ?? obj.user ?? ""));
      const k = cleanRaApiKey(String(obj.key ?? obj.y ?? obj.apiKey ?? obj.apikey ?? ""));
      if (u && k) return { username: u, apiKey: k };
    } catch {}
  }

  // separadores explícitos
  for (const sep of [":", "|", ";"]) {
    if (raw.includes(sep)) {
      const idx = raw.indexOf(sep);
      const u = cleanRaUsername(raw.slice(0, idx));
      const k = cleanRaApiKey(raw.slice(idx + 1));
      if (u && k) return { username: u, apiKey: k };
    }
  }
  // espaço
  if (raw.includes(" ")) {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const u = cleanRaUsername(parts[0]);
      const k = cleanRaApiKey(parts.slice(1).join(""));
      if (u && k) return { username: u, apiKey: k };
    }
  }
  // sem separador: usa label como username, secret como key
  const key = cleanRaApiKey(raw);
  const userFromLabel = cleanRaUsername(labelFallback);
  if (key && userFromLabel) return { username: userFromLabel, apiKey: key };
  // se label vazio, tenta usar raw como username e espera que key esteja em outro lugar? não
  return null;
}

export function retroFail(msg: string): Record<string, unknown> {
  return {
    ok: false,
    error: msg,
    username: null,
    ulid: null,
    user_pic: null,
    member_since: null,
    motto: null,
    total_points: null,
    total_softcore_points: null,
    total_true_points: null,
    rank: null,
    total_ranked: null,
    status: null,
    rich_presence_msg: null,
    rich_presence_msg_date: null,
    last_game_id: null,
    last_game_title: null,
    last_game_console: null,
    last_game_image_icon: null,
    recently_played: [],
    recent_achievements: [],
    awards: null,
    completion_progress: null,
    updated_at: utcNow(),
  };
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function buildImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `https://retroachievements.org${path}`;
}

function buildBadgeUrl(badgeName: string | null): string | null {
  if (!badgeName) return null;
  const clean = String(badgeName).trim();
  if (!clean) return null;
  return `https://media.retroachievements.org/Badge/${clean}.png`;
}

async function fetchSummary(username: string, apiKey: string): Promise<Record<string, unknown>> {
  const url = `${RA_USER_SUMMARY_URL}?y=${encodeURIComponent(apiKey)}&u=${encodeURIComponent(username)}&g=3&a=5`;
  const data = await httpJson(url, { timeout: 15, provider: "RA" });
  if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error("resposta inesperada do RetroAchievements (summary)");
  return data as Record<string, unknown>;
}

async function fetchAwards(username: string, apiKey: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `${RA_USER_AWARDS_URL}?y=${encodeURIComponent(apiKey)}&u=${encodeURIComponent(username)}`;
    const data = await httpJson(url, { timeout: 15, provider: "RA" });
    if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchCompletion(username: string, apiKey: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `${RA_USER_COMPLETION_URL}?y=${encodeURIComponent(apiKey)}&u=${encodeURIComponent(username)}&c=1&o=0`;
    const data = await httpJson(url, { timeout: 15, provider: "RA" });
    if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseRaPayload(
  summary: Record<string, unknown>,
  awards: Record<string, unknown> | null,
  completion: Record<string, unknown> | null,
): Record<string, unknown> {
  const user = toStr(summary.User ?? summary.user) ?? toStr(summary.ULID ?? summary.ulid) ?? null;
  const ulid = toStr(summary.ULID ?? summary.ulid);
  const userPic = buildImageUrl(toStr(summary.UserPic ?? summary.userPic));
  const memberSince = toStr(summary.MemberSince ?? summary.memberSince);
  const motto = toStr(summary.Motto ?? summary.motto);
  const totalPoints = toInt(summary.TotalPoints ?? summary.totalPoints);
  const totalSoftcore = toInt(summary.TotalSoftcorePoints ?? summary.totalSoftcorePoints);
  const totalTrue = toInt(summary.TotalTruePoints ?? summary.totalTruePoints);
  const rank = toInt(summary.Rank ?? summary.rank);
  const totalRanked = toInt(summary.TotalRanked ?? summary.totalRanked);
  const status = toStr(summary.Status ?? summary.status);
  const richMsg = toStr(summary.RichPresenceMsg ?? summary.richPresenceMsg);
  const richDate = toStr(summary.RichPresenceMsgDate ?? summary.richPresenceMsgDate);
  const lastGameId = toInt(summary.LastGameID ?? summary.lastGameId ?? summary.LastGameID);

  // LastGame
  const lastGameRaw = (summary.LastGame ?? summary.lastGame) as Record<string, unknown> | null | undefined;
  let lastGameTitle: string | null = null;
  let lastGameConsole: string | null = null;
  let lastGameIcon: string | null = null;
  if (lastGameRaw && typeof lastGameRaw === "object" && !Array.isArray(lastGameRaw)) {
    lastGameTitle = toStr(lastGameRaw.Title ?? lastGameRaw.title);
    lastGameConsole = toStr(lastGameRaw.ConsoleName ?? lastGameRaw.consoleName);
    lastGameIcon = buildImageUrl(toStr(lastGameRaw.ImageIcon ?? lastGameRaw.imageIcon));
  }

  // RecentlyPlayed
  const recentlyRaw = (summary.RecentlyPlayed ?? summary.recentlyPlayed) as unknown;
  const recentlyPlayed: Array<Record<string, unknown>> = [];
  if (Array.isArray(recentlyRaw)) {
    for (const g of recentlyRaw.slice(0, 5)) {
      if (!g || typeof g !== "object" || Array.isArray(g)) continue;
      const gg = g as Record<string, unknown>;
      const awarded = (summary.Awarded ?? summary.awarded) as Record<string, unknown> | undefined;
      const gid = toInt(gg.GameID ?? gg.gameId);
      let numAchieved: number | null = null;
      let scoreAchieved: number | null = null;
      if (gid != null && awarded && typeof awarded === "object") {
        const aw = (awarded[String(gid)] ?? awarded[gid]) as Record<string, unknown> | undefined;
        if (aw && typeof aw === "object") {
          numAchieved = toInt(aw.NumAchieved ?? aw.numAchieved);
          scoreAchieved = toInt(aw.ScoreAchieved ?? aw.scoreAchieved);
        }
      }
      recentlyPlayed.push({
        game_id: gid,
        title: toStr(gg.Title ?? gg.title),
        console_name: toStr(gg.ConsoleName ?? gg.consoleName),
        image_icon: buildImageUrl(toStr(gg.ImageIcon ?? gg.imageIcon)),
        last_played: toStr(gg.LastPlayed ?? gg.lastPlayed),
        achievements_total: toInt(gg.AchievementsTotal ?? gg.achievementsTotal),
        num_achieved: numAchieved,
        score_achieved: scoreAchieved,
      });
    }
  }

  // RecentAchievements
  const recentRaw = (summary.RecentAchievements ?? summary.recentAchievements) as unknown;
  const recentAchievements: Array<Record<string, unknown>> = [];
  if (recentRaw && typeof recentRaw === "object" && !Array.isArray(recentRaw)) {
    const byGame = recentRaw as Record<string, unknown>;
    for (const [gameIdStr, achMap] of Object.entries(byGame)) {
      if (!achMap || typeof achMap !== "object" || Array.isArray(achMap)) continue;
      const gid = toInt(gameIdStr);
      for (const [, ach] of Object.entries(achMap as Record<string, unknown>)) {
        if (!ach || typeof ach !== "object" || Array.isArray(ach)) continue;
        const a = ach as Record<string, unknown>;
        recentAchievements.push({
          id: toInt(a.ID ?? a.id),
          game_id: toInt(a.GameID ?? a.gameId) ?? gid,
          game_title: toStr(a.GameTitle ?? a.gameTitle),
          title: toStr(a.Title ?? a.title),
          description: toStr(a.Description ?? a.description),
          points: toInt(a.Points ?? a.points),
          badge_name: toStr(a.BadgeName ?? a.badgeName),
          badge_url: buildBadgeUrl(toStr(a.BadgeName ?? a.badgeName)),
          date_awarded: toStr(a.DateAwarded ?? a.dateAwarded),
          hardcore: Boolean(a.HardcoreAchieved ?? a.hardcoreAchieved),
        });
      }
    }
    // ordena por data mais recente
    recentAchievements.sort((a, b) => String(b.date_awarded ?? "").localeCompare(String(a.date_awarded ?? "")));
  }

  // Awards
  let awardsOut: Record<string, unknown> | null = null;
  if (awards && typeof awards === "object") {
    awardsOut = {
      total_awards_count: toInt(awards.TotalAwardsCount ?? awards.totalAwardsCount),
      mastery_awards_count: toInt(awards.MasteryAwardsCount ?? awards.masteryAwardsCount),
      completion_awards_count: toInt(awards.CompletionAwardsCount ?? awards.completionAwardsCount),
      beaten_hardcore_awards_count: toInt(awards.BeatenHardcoreAwardsCount ?? awards.beatenHardcoreAwardsCount),
      beaten_softcore_awards_count: toInt(awards.BeatenSoftcoreAwardsCount ?? awards.beatenSoftcoreAwardsCount),
      event_awards_count: toInt(awards.EventAwardsCount ?? awards.eventAwardsCount),
      site_awards_count: toInt(awards.SiteAwardsCount ?? awards.siteAwardsCount),
    };
  }

  // Completion
  let completionOut: Record<string, unknown> | null = null;
  if (completion && typeof completion === "object") {
    completionOut = {
      total: toInt(completion.Total ?? completion.total),
      count: toInt(completion.Count ?? completion.count),
    };
  }

  return {
    ok: true,
    error: null,
    username: user,
    ulid,
    user_pic: userPic,
    member_since: memberSince,
    motto,
    total_points: totalPoints,
    total_softcore_points: totalSoftcore,
    total_true_points: totalTrue,
    rank,
    total_ranked: totalRanked,
    status,
    rich_presence_msg: richMsg,
    rich_presence_msg_date: richDate,
    last_game_id: lastGameId,
    last_game_title: lastGameTitle,
    last_game_console: lastGameConsole,
    last_game_image_icon: lastGameIcon,
    recently_played: recentlyPlayed,
    recent_achievements: recentAchievements.slice(0, 10),
    awards: awardsOut,
    completion_progress: completionOut,
    updated_at: utcNow(),
  };
}

export async function fetchRetroOne(rawSecret: string, label: string): Promise<Record<string, unknown>> {
  const parsed = parseRaSecret(rawSecret, label);
  if (!parsed) {
    return retroFail("Configure usuário e API key do RetroAchievements; cole no formato usuario:apikey ou use o campo extra com usuário na etiqueta");
  }
  const { username, apiKey } = parsed;
  let summary: Record<string, unknown>;
  try {
    summary = await fetchSummary(username, apiKey);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("401") || msg.includes("403")) return retroFail("API key inválida ou sem permissão — gere em https://retroachievements.org/controlpanel.php");
    if (msg.includes("404")) return retroFail(`Usuário não encontrado: ${username}`);
    return retroFail(msg);
  }

  // detecta erro da API (quando retorna {error: ...} ou string)
  if (summary && typeof summary === "object" && "error" in summary && typeof (summary as Record<string, unknown>).error === "string" && (summary as Record<string, unknown>).error) {
    return retroFail(String((summary as Record<string, unknown>).error));
  }

  const [awards, completion] = await Promise.all([fetchAwards(username, apiKey), fetchCompletion(username, apiKey)]);

  try {
    return parseRaPayload(summary, awards, completion);
  } catch (e) {
    return retroFail(`resposta RetroAchievements inesperada: ${String(e)}`);
  }
}

export async function fetchRetroachievementsAccounts(cfg: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const p = providerCfg(cfg, "retroachievements") as Record<string, unknown>;
  let accounts = Array.isArray(p.accounts) ? [...(p.accounts as unknown[])] : [];
  if (accounts.length === 0 && !p.hidden) {
    const legacy = String(p.paste_secret ?? "").trim();
    const label = String(p.local_label ?? "").trim();
    if (legacy) accounts = [{ id: "legacy", label, secret: legacy }];
  }
  const out: Array<Record<string, unknown>> = [];
  for (const accRaw of accounts) {
    const acc = accRaw as Record<string, unknown>;
    const secret = String(acc.secret ?? "").trim();
    const label = String(acc.label ?? "").trim();
    const aid = String(acc.id ?? "extra");
    const result = await fetchRetroOne(secret, label);
    out.push({ id: aid, label, ...result });
  }
  return out;
}

export function mockRetroPayload(): Record<string, unknown> {
  return {
    ok: true,
    error: null,
    username: "DemoPlayer",
    ulid: "00000000000000000000000000",
    user_pic: "https://retroachievements.org/UserPic/DemoPlayer.png",
    member_since: "2020-01-15 12:00:00",
    motto: "Jogando clássicos!",
    total_points: 12500,
    total_softcore_points: 3200,
    total_true_points: 45200,
    rank: 1234,
    total_ranked: 250000,
    status: "Offline",
    rich_presence_msg: "Jogando Super Mario World",
    rich_presence_msg_date: utcNow(),
    last_game_id: 10024,
    last_game_title: "Super Mario World",
    last_game_console: "SNES",
    last_game_image_icon: "https://retroachievements.org/Images/000001.png",
    recently_played: [
      {
        game_id: 10024,
        title: "Super Mario World",
        console_name: "SNES",
        image_icon: "https://retroachievements.org/Images/000001.png",
        last_played: "2026-09-03 20:15:00",
        achievements_total: 77,
        num_achieved: 42,
        score_achieved: 320,
      },
      {
        game_id: 11234,
        title: "Sonic the Hedgehog",
        console_name: "Mega Drive",
        image_icon: "https://retroachievements.org/Images/000002.png",
        last_played: "2026-09-02 18:30:00",
        achievements_total: 45,
        num_achieved: 45,
        score_achieved: 400,
      },
    ],
    recent_achievements: [
      {
        id: 123456,
        game_id: 10024,
        game_title: "Super Mario World",
        title: "Mestre do Castelo",
        description: "Complete o castelo sem levar dano",
        points: 25,
        badge_name: "123456",
        badge_url: "https://media.retroachievements.org/Badge/123456.png",
        date_awarded: "2026-09-03 20:14:00",
        hardcore: true,
      },
      {
        id: 123457,
        game_id: 10024,
        game_title: "Super Mario World",
        title: "Colecionador",
        description: "Colete 96 saídas",
        points: 50,
        badge_name: "123457",
        badge_url: "https://media.retroachievements.org/Badge/123457.png",
        date_awarded: "2026-09-03 19:50:00",
        hardcore: true,
      },
    ],
    awards: {
      total_awards_count: 42,
      mastery_awards_count: 12,
      completion_awards_count: 5,
      beaten_hardcore_awards_count: 20,
      beaten_softcore_awards_count: 3,
      event_awards_count: 1,
      site_awards_count: 1,
    },
    completion_progress: {
      total: 128,
      count: 5,
    },
    updated_at: utcNow(),
  };
}

export const clean_ra_api_key = cleanRaApiKey;
export const clean_ra_username = cleanRaUsername;
export const parse_ra_secret = parseRaSecret;
export const retro_fail = retroFail;
export const parse_ra_payload = parseRaPayload;
export const fetch_retro_one = fetchRetroOne;
export const fetch_retroachievements_accounts = fetchRetroachievementsAccounts;
export const mock_retro_payload = mockRetroPayload;
