#include "net/parse.h"

#include "net/usage_client.h"

#include <ArduinoJson.h>

void usageClientLogSnapshot(const char *why)
{
  Serial.printf("usage %s\n", why);
  Serial.printf("  claude contas=%d\n", g_snap.claudeCount);
  for (int i = 0; i < g_snap.claudeCount; i++)
  {
    const ClaudeAccount &c = g_snap.claude[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d sessao=%.0f semana=%.0f err=%s\n", i,
                  c.id.c_str(), c.label.length() ? c.label.c_str() : "-", c.ok ? 1 : 0,
                  c.sessionPercent, c.weeklyPercent, c.error.length() ? c.error.c_str() : "-");
  }
  Serial.printf("  gpt contas=%d\n", g_snap.gptCount);
  for (int i = 0; i < g_snap.gptCount; i++)
  {
    const GptAccount &g = g_snap.gpt[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d sessao=%.0f semana=%.0f plan=%s err=%s\n", i,
                  g.id.c_str(), g.label.length() ? g.label.c_str() : "-", g.ok ? 1 : 0,
                  g.sessionPercent, g.weeklyPercent, g.plan.length() ? g.plan.c_str() : "-",
                  g.error.length() ? g.error.c_str() : "-");
  }
  Serial.printf("  cursor contas=%d\n", g_snap.cursorCount);
  for (int i = 0; i < g_snap.cursorCount; i++)
  {
    const CursorAccount &c = g_snap.cursor[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d pct=%.0f plan=%s err=%s\n", i, c.id.c_str(),
                  c.label.length() ? c.label.c_str() : "-", c.ok ? 1 : 0, c.percent,
                  c.plan.length() ? c.plan.c_str() : "-", c.error.length() ? c.error.c_str() : "-");
  }
  Serial.printf("  openrouter contas=%d\n", g_snap.openrouterCount);
  for (int i = 0; i < g_snap.openrouterCount; i++)
  {
    const OpenRouterAccount &o = g_snap.openrouter[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d pct=%.0f err=%s\n", i, o.id.c_str(),
                  o.label.length() ? o.label.c_str() : "-", o.ok ? 1 : 0, o.percent,
                  o.error.length() ? o.error.c_str() : "-");
  }
  Serial.printf("  deepseek contas=%d\n", g_snap.deepseekCount);
  for (int i = 0; i < g_snap.deepseekCount; i++)
  {
    const DeepSeekAccount &d = g_snap.deepseek[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d pct=%.0f err=%s\n", i, d.id.c_str(),
                  d.label.length() ? d.label.c_str() : "-", d.ok ? 1 : 0, d.percent,
                  d.error.length() ? d.error.c_str() : "-");
  }
  Serial.printf("  opencode_go contas=%d\n", g_snap.opencode_goCount);
  for (int i = 0; i < g_snap.opencode_goCount; i++)
  {
    const OpenCodeGoAccount &g = g_snap.opencode_go[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d rolling=%.0f semana=%.0f mes=%.0f err=%s\n", i,
                  g.id.c_str(), g.label.length() ? g.label.c_str() : "-", g.ok ? 1 : 0,
                  g.rollingPercent, g.weeklyPercent, g.monthlyPercent,
                  g.error.length() ? g.error.c_str() : "-");
  }
  Serial.printf("  opencode_zen contas=%d\n", g_snap.opencode_zenCount);
  for (int i = 0; i < g_snap.opencode_zenCount; i++)
  {
    const OpenCodeZenAccount &z = g_snap.opencode_zen[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d pct=%.0f err=%s\n", i, z.id.c_str(),
                  z.label.length() ? z.label.c_str() : "-", z.ok ? 1 : 0, z.percent,
                  z.error.length() ? z.error.c_str() : "-");
  }
}

// Falha total (Wi-Fi fora do ar, HTTP != 200, JSON ilegivel): marca todas as
// contas ja conhecidas (de um /usage anterior bem-sucedido) como falhas, sem
// apagar id/label/contagem — o card de cada uma continua visivel, com erro,
// em vez de sumir. No boot, antes do primeiro /usage OK, as contagens ainda
// sao 0 (o firmware so descobre quantas contas existem depois do primeiro
// contato com o coletor) — a Início mostra vazio ate la, por alguns segundos.
void markAllAccountsFailed(const char *msg)
{
  for (int i = 0; i < g_snap.claudeCount; i++)
  {
    g_snap.claude[i].ok = false;
    g_snap.claude[i].error = msg;
  }
  for (int i = 0; i < g_snap.gptCount; i++)
  {
    g_snap.gpt[i].ok = false;
    g_snap.gpt[i].error = msg;
  }
  for (int i = 0; i < g_snap.cursorCount; i++)
  {
    g_snap.cursor[i].ok = false;
    g_snap.cursor[i].error = msg;
  }
  for (int i = 0; i < g_snap.openrouterCount; i++)
  {
    g_snap.openrouter[i].ok = false;
    g_snap.openrouter[i].error = msg;
  }
  for (int i = 0; i < g_snap.deepseekCount; i++)
  {
    g_snap.deepseek[i].ok = false;
    g_snap.deepseek[i].error = msg;
  }
  for (int i = 0; i < g_snap.opencode_goCount; i++)
  {
    g_snap.opencode_go[i].ok = false;
    g_snap.opencode_go[i].error = msg;
  }
  for (int i = 0; i < g_snap.opencode_zenCount; i++)
  {
    g_snap.opencode_zen[i].ok = false;
    g_snap.opencode_zen[i].error = msg;
  }
}

static float jsonFloatOrNeg(JsonVariantConst v)
{
  if (v.isNull())
  {
    return -1;
  }
  return v.as<float>();
}

String jsonText(JsonVariantConst v)
{
  if (v.isNull())
  {
    return "";
  }
  if (v.is<const char *>())
  {
    const char *p = v.as<const char *>();
    return p ? String(p) : "";
  }
  char buf[28];
  snprintf(buf, sizeof(buf), "%.0f", v.as<double>());
  return String(buf);
}

bool parseUsageJson(const String &body)
{
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err)
  {
    Serial.printf("JSON parse falhou: %s (%d bytes)\n", err.c_str(), body.length());
    g_snap.statusLine = "JSON";
    markAllAccountsFailed(err.c_str());
    return false;
  }

  g_snap.updatedAt = doc["updated_at"] | "";

  g_snap.claudeCount = 0;
  for (JsonVariantConst v : doc["claude"].as<JsonArrayConst>())
  {
    if (g_snap.claudeCount >= MAX_ACCOUNTS)
    {
      Serial.println("claude: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    ClaudeAccount &c = g_snap.claude[g_snap.claudeCount++];
    c.id = jsonText(acc["id"]);
    c.label = jsonText(acc["label"]);
    c.ok = acc["ok"] | false;
    c.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
    c.sessionPercent = jsonFloatOrNeg(acc["session_percent"]);
    c.sessionResets = jsonText(acc["session_resets_at"]);
    c.weeklyPercent = jsonFloatOrNeg(acc["weekly_percent"]);
    c.weeklyResets = jsonText(acc["weekly_resets_at"]);
    c.sonnetPercent = jsonFloatOrNeg(acc["sonnet_percent"]);
    c.sonnetResets = jsonText(acc["sonnet_resets_at"]);
    c.opusPercent = jsonFloatOrNeg(acc["opus_percent"]);
    c.opusResets = jsonText(acc["opus_resets_at"]);
  }

  g_snap.gptCount = 0;
  for (JsonVariantConst v : doc["gpt"].as<JsonArrayConst>())
  {
    if (g_snap.gptCount >= MAX_ACCOUNTS)
    {
      Serial.println("gpt: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    GptAccount &g = g_snap.gpt[g_snap.gptCount++];
    g.id = jsonText(acc["id"]);
    g.label = jsonText(acc["label"]);
    g.ok = acc["ok"] | false;
    g.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
    g.sessionPercent = jsonFloatOrNeg(acc["session_percent"]);
    g.sessionResets = jsonText(acc["session_resets_at"]);
    g.weeklyPercent = jsonFloatOrNeg(acc["weekly_percent"]);
    g.weeklyResets = jsonText(acc["weekly_resets_at"]);
    g.plan = jsonText(acc["plan"]);
  }

  g_snap.cursorCount = 0;
  for (JsonVariantConst v : doc["cursor"].as<JsonArrayConst>())
  {
    if (g_snap.cursorCount >= MAX_ACCOUNTS)
    {
      Serial.println("cursor: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    CursorAccount &c = g_snap.cursor[g_snap.cursorCount++];
    c.id = jsonText(acc["id"]);
    c.label = jsonText(acc["label"]);
    c.ok = acc["ok"] | false;
    c.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
    c.percent = jsonFloatOrNeg(acc["percent"]);
    c.otherPercent = jsonFloatOrNeg(acc["other_percent"]);
    c.usedCents = acc["used_cents"].isNull() ? -1 : acc["used_cents"].as<int>();
    c.limitCents = acc["limit_cents"].isNull() ? -1 : acc["limit_cents"].as<int>();
    c.remainingCents = acc["remaining_cents"].isNull() ? -1 : acc["remaining_cents"].as<int>();
    c.bonusCents = acc["bonus_cents"].isNull() ? -1 : acc["bonus_cents"].as<int>();
    c.requestsUsed = acc["requests_used"].isNull() ? -1 : acc["requests_used"].as<int>();
    c.requestsLimit = acc["requests_limit"].isNull() ? -1 : acc["requests_limit"].as<int>();
    c.cycleEnd = jsonText(acc["cycle_end"]);
    c.plan = jsonText(acc["plan"]);
  }

  g_snap.openrouterCount = 0;
  for (JsonVariantConst v : doc["openrouter"].as<JsonArrayConst>())
  {
    if (g_snap.openrouterCount >= MAX_ACCOUNTS)
    {
      Serial.println("openrouter: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    OpenRouterAccount &o = g_snap.openrouter[g_snap.openrouterCount++];
    o.id = jsonText(acc["id"]);
    o.label = jsonText(acc["label"]);
    o.ok = acc["ok"] | false;
    o.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
    o.percent = jsonFloatOrNeg(acc["percent"]);
    o.limitCents = acc["limit_cents"].isNull() ? -1 : acc["limit_cents"].as<int>();
    o.usedCents = acc["used_cents"].isNull() ? -1 : acc["used_cents"].as<int>();
    o.remainingCents = acc["remaining_cents"].isNull() ? -1 : acc["remaining_cents"].as<int>();
  }

  g_snap.deepseekCount = 0;
  for (JsonVariantConst v : doc["deepseek"].as<JsonArrayConst>())
  {
    if (g_snap.deepseekCount >= MAX_ACCOUNTS)
    {
      Serial.println("deepseek: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    DeepSeekAccount &d = g_snap.deepseek[g_snap.deepseekCount++];
    d.id = jsonText(acc["id"]);
    d.label = jsonText(acc["label"]);
    d.ok = acc["ok"] | false;
    d.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
    d.percent = jsonFloatOrNeg(acc["percent"]);
    d.limitCents = acc["limit_cents"].isNull() ? -1 : acc["limit_cents"].as<int>();
    d.usedCents = acc["used_cents"].isNull() ? -1 : acc["used_cents"].as<int>();
    d.remainingCents = acc["remaining_cents"].isNull() ? -1 : acc["remaining_cents"].as<int>();
  }

  g_snap.opencode_goCount = 0;
  for (JsonVariantConst v : doc["opencode_go"].as<JsonArrayConst>())
  {
    if (g_snap.opencode_goCount >= MAX_ACCOUNTS)
    {
      Serial.println("opencode_go: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    OpenCodeGoAccount &g = g_snap.opencode_go[g_snap.opencode_goCount++];
    g.id = jsonText(acc["id"]);
    g.label = jsonText(acc["label"]);
    g.ok = acc["ok"] | false;
    g.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
    g.rollingPercent = jsonFloatOrNeg(acc["rolling_percent"]);
    g.rollingResets = jsonText(acc["rolling_resets_at"]);
    g.weeklyPercent = jsonFloatOrNeg(acc["weekly_percent"]);
    g.weeklyResets = jsonText(acc["weekly_resets_at"]);
    g.monthlyPercent = jsonFloatOrNeg(acc["monthly_percent"]);
    g.monthlyResets = jsonText(acc["monthly_resets_at"]);
  }

  g_snap.opencode_zenCount = 0;
  for (JsonVariantConst v : doc["opencode_zen"].as<JsonArrayConst>())
  {
    if (g_snap.opencode_zenCount >= MAX_ACCOUNTS)
    {
      Serial.println("opencode_zen: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    OpenCodeZenAccount &z = g_snap.opencode_zen[g_snap.opencode_zenCount++];
    z.id = jsonText(acc["id"]);
    z.label = jsonText(acc["label"]);
    z.ok = acc["ok"] | false;
    z.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
    z.percent = jsonFloatOrNeg(acc["percent"]);
    z.limitCents = acc["limit_cents"].isNull() ? -1 : acc["limit_cents"].as<int>();
    z.usedCents = acc["used_cents"].isNull() ? -1 : acc["used_cents"].as<int>();
    z.remainingCents = acc["remaining_cents"].isNull() ? -1 : acc["remaining_cents"].as<int>();
  }

  if (g_snap.updatedAt.length() >= 16)
  {
    g_snap.statusLine = g_snap.updatedAt.substring(11, 16);
  }
  else
  {
    g_snap.statusLine = "ok";
  }
  return true;
}
