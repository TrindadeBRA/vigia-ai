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
  Serial.printf("  opencode contas=%d\n", g_snap.opencodeCount);
  for (int i = 0; i < g_snap.opencodeCount; i++)
  {
    const OpenCodeAccount &o = g_snap.opencode[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d rolling=%.0f semana=%.0f mes=%.0f saldo=%d err=%s\n", i,
                  o.id.c_str(), o.label.length() ? o.label.c_str() : "-", o.ok ? 1 : 0,
                  o.rollingPercent, o.weeklyPercent, o.monthlyPercent, o.remainingCents,
                  o.error.length() ? o.error.c_str() : "-");
  }
  Serial.printf("  fal contas=%d\n", g_snap.falCount);
  for (int i = 0; i < g_snap.falCount; i++)
  {
    const FalAccount &f = g_snap.fal[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d pct=%.0f err=%s\n", i, f.id.c_str(),
                  f.label.length() ? f.label.c_str() : "-", f.ok ? 1 : 0, f.percent,
                  f.error.length() ? f.error.c_str() : "-");
  }
  Serial.printf("  bitcoin carteiras=%d\n", g_snap.bitcoinCount);
  for (int i = 0; i < g_snap.bitcoinCount; i++)
  {
    const BitcoinAccount &b = g_snap.bitcoin[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d btc=%.8f valorUsd=%d err=%s\n", i, b.id.c_str(),
                  b.label.length() ? b.label.c_str() : "-", b.ok ? 1 : 0, b.balanceBtc,
                  b.valueUsdCents, b.error.length() ? b.error.c_str() : "-");
  }
  Serial.printf("  adsense contas=%d\n", g_snap.adsenseCount);
  for (int i = 0; i < g_snap.adsenseCount; i++)
  {
    const AdsenseAccount &a = g_snap.adsense[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d hoje=%d carteira=%d err=%s\n", i, a.id.c_str(),
                  a.label.length() ? a.label.c_str() : "-", a.ok ? 1 : 0, a.todayCents,
                  a.unpaidCents, a.error.length() ? a.error.c_str() : "-");
  }
  if (g_snap.weather.hasData)
  {
    Serial.printf("  weather ok=%d temp=%.1f%s loc=%s code=%d err=%s\n", g_snap.weather.ok ? 1 : 0,
                  g_snap.weather.temperature, g_snap.weather.tempUnit.c_str(),
                  g_snap.weather.locationName.length() ? g_snap.weather.locationName.c_str() : "-",
                  g_snap.weather.weatherCode,
                  g_snap.weather.error.length() ? g_snap.weather.error.c_str() : "-");
  }
  if (g_snap.currencies.hasData)
  {
    Serial.printf("  currencies ok=%d base=%s itens=%d err=%s\n", g_snap.currencies.ok ? 1 : 0,
                  g_snap.currencies.base.length() ? g_snap.currencies.base.c_str() : "-",
                  g_snap.currencies.itemCount,
                  g_snap.currencies.error.length() ? g_snap.currencies.error.c_str() : "-");
    for (int i = 0; i < g_snap.currencies.itemCount; i++)
    {
      const CurrencyQuote &q = g_snap.currencies.items[i];
      Serial.printf("    [%d] %s %s ok=%d price=%.4f err=%s\n", i, q.code.c_str(),
                    q.label.length() ? q.label.c_str() : "-", q.ok ? 1 : 0, q.price,
                    q.error.length() ? q.error.c_str() : "-");
    }
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
  for (int i = 0; i < g_snap.opencodeCount; i++)
  {
    g_snap.opencode[i].ok = false;
    g_snap.opencode[i].error = msg;
  }
  for (int i = 0; i < g_snap.falCount; i++)
  {
    g_snap.fal[i].ok = false;
    g_snap.fal[i].error = msg;
  }
  for (int i = 0; i < g_snap.bitcoinCount; i++)
  {
    g_snap.bitcoin[i].ok = false;
    g_snap.bitcoin[i].error = msg;
  }
  for (int i = 0; i < g_snap.adsenseCount; i++)
  {
    g_snap.adsense[i].ok = false;
    g_snap.adsense[i].error = msg;
  }
  if (g_snap.weather.hasData)
  {
    g_snap.weather.ok = false;
    g_snap.weather.error = msg;
  }
  if (g_snap.currencies.hasData)
  {
    g_snap.currencies.ok = false;
    g_snap.currencies.error = msg;
    for (int i = 0; i < g_snap.currencies.itemCount; i++)
    {
      g_snap.currencies.items[i].ok = false;
      g_snap.currencies.items[i].error = msg;
    }
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

  g_snap.opencodeCount = 0;
  for (JsonVariantConst v : doc["opencode"].as<JsonArrayConst>())
  {
    if (g_snap.opencodeCount >= MAX_ACCOUNTS)
    {
      Serial.println("opencode: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    OpenCodeAccount &o = g_snap.opencode[g_snap.opencodeCount++];
    o.id = jsonText(acc["id"]);
    o.label = jsonText(acc["label"]);
    o.ok = acc["ok"] | false;
    o.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
    o.rollingPercent = jsonFloatOrNeg(acc["rolling_percent"]);
    o.rollingResets = jsonText(acc["rolling_resets_at"]);
    o.weeklyPercent = jsonFloatOrNeg(acc["weekly_percent"]);
    o.weeklyResets = jsonText(acc["weekly_resets_at"]);
    o.monthlyPercent = jsonFloatOrNeg(acc["monthly_percent"]);
    o.monthlyResets = jsonText(acc["monthly_resets_at"]);
    o.percent = jsonFloatOrNeg(acc["percent"]);
    o.limitCents = acc["limit_cents"].isNull() ? -1 : acc["limit_cents"].as<int>();
    o.usedCents = acc["used_cents"].isNull() ? -1 : acc["used_cents"].as<int>();
    o.remainingCents = acc["remaining_cents"].isNull() ? -1 : acc["remaining_cents"].as<int>();
  }

  g_snap.falCount = 0;
  for (JsonVariantConst v : doc["fal"].as<JsonArrayConst>())
  {
    if (g_snap.falCount >= MAX_ACCOUNTS)
    {
      Serial.println("fal: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    FalAccount &f = g_snap.fal[g_snap.falCount++];
    f.id = jsonText(acc["id"]);
    f.label = jsonText(acc["label"]);
    f.ok = acc["ok"] | false;
    f.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
    f.percent = jsonFloatOrNeg(acc["percent"]);
    f.limitCents = acc["limit_cents"].isNull() ? -1 : acc["limit_cents"].as<int>();
    f.usedCents = acc["used_cents"].isNull() ? -1 : acc["used_cents"].as<int>();
    f.remainingCents = acc["remaining_cents"].isNull() ? -1 : acc["remaining_cents"].as<int>();
  }

  g_snap.bitcoinCount = 0;
  for (JsonVariantConst v : doc["bitcoin"].as<JsonArrayConst>())
  {
    if (g_snap.bitcoinCount >= MAX_ACCOUNTS)
    {
      Serial.println("bitcoin: mais carteiras do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    BitcoinAccount &b = g_snap.bitcoin[g_snap.bitcoinCount++];
    b.id = jsonText(acc["id"]);
    b.label = jsonText(acc["label"]);
    b.ok = acc["ok"] | false;
    b.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
    b.address = jsonText(acc["address"]);
    b.balanceBtc = jsonFloatOrNeg(acc["balance_btc"]);
    b.priceUsdCents = acc["price_usd_cents"].isNull() ? -1 : acc["price_usd_cents"].as<int>();
    b.priceBrlCents = acc["price_brl_cents"].isNull() ? -1 : acc["price_brl_cents"].as<int>();
    b.valueUsdCents = acc["value_usd_cents"].isNull() ? -1 : acc["value_usd_cents"].as<int>();
    b.valueBrlCents = acc["value_brl_cents"].isNull() ? -1 : acc["value_brl_cents"].as<int>();
  }

  g_snap.adsenseCount = 0;
  for (JsonVariantConst v : doc["adsense"].as<JsonArrayConst>())
  {
    if (g_snap.adsenseCount >= MAX_ACCOUNTS)
    {
      Serial.println("adsense: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    AdsenseAccount &a = g_snap.adsense[g_snap.adsenseCount++];
    a.id = jsonText(acc["id"]);
    a.label = jsonText(acc["label"]);
    a.ok = acc["ok"] | false;
    a.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
    a.currency = jsonText(acc["currency"]);
    a.todayCents = acc["today_cents"].isNull() ? -1 : acc["today_cents"].as<int>();
    a.unpaidCents = acc["unpaid_cents"].isNull() ? -1 : acc["unpaid_cents"].as<int>();
    a.accountName = jsonText(acc["account_name"]);
  }

  // Clima (Open-Meteo) — objeto único, igual a moedas. Ausente/null = card some.
  {
    JsonVariantConst w = doc["weather"];
    if (!w.isNull() && w.is<JsonObjectConst>())
    {
      JsonObjectConst wo = w.as<JsonObjectConst>();
      WeatherData &wd = g_snap.weather;
      wd.hasData = true;
      wd.ok = wo["ok"] | false;
      wd.error = wo["error"].isNull() ? "" : String(wo["error"].as<const char *>());
      wd.temperature = -999;
      wd.feelsLike = -999;
      wd.humidity = -1;
      wd.windSpeed = -1;
      wd.precipitation = -1;
      wd.tempMax = -999;
      wd.tempMin = -999;
      wd.weatherCode = -1;
      wd.tempUnit = "C";
      wd.windUnit = "km/h";
      wd.precipUnit = "mm";
      wd.locationName = "";

      JsonVariantConst cur = wo["current"];
      if (!cur.isNull() && cur.is<JsonObjectConst>())
      {
        JsonObjectConst co = cur.as<JsonObjectConst>();
        if (!co["temperature_2m"].isNull())
          wd.temperature = co["temperature_2m"].as<float>();
        if (!co["apparent_temperature"].isNull())
          wd.feelsLike = co["apparent_temperature"].as<float>();
        if (!co["relative_humidity_2m"].isNull())
          wd.humidity = co["relative_humidity_2m"].as<float>();
        if (!co["wind_speed_10m"].isNull())
          wd.windSpeed = co["wind_speed_10m"].as<float>();
        if (!co["precipitation"].isNull())
          wd.precipitation = co["precipitation"].as<float>();
        if (!co["weather_code"].isNull())
          wd.weatherCode = co["weather_code"].as<int>();
      }
      JsonVariantConst cu = wo["current_units"];
      if (!cu.isNull() && cu.is<JsonObjectConst>())
      {
        JsonObjectConst cuo = cu.as<JsonObjectConst>();
        String u = jsonText(cuo["temperature_2m"]);
        if (u.length())
          wd.tempUnit = u;
        String wu = jsonText(cuo["wind_speed_10m"]);
        if (wu.length())
          wd.windUnit = wu;
        String pu = jsonText(cuo["precipitation"]);
        if (pu.length())
          wd.precipUnit = pu;
      }
      JsonVariantConst loc = wo["location"];
      if (!loc.isNull() && loc.is<JsonObjectConst>())
      {
        String n = jsonText(loc.as<JsonObjectConst>()["name"]);
        if (n.length())
          wd.locationName = n;
      }
      JsonVariantConst daily = wo["daily"];
      if (!daily.isNull() && daily.is<JsonObjectConst>())
      {
        JsonObjectConst d = daily.as<JsonObjectConst>();
        JsonVariantConst tmax = d["temperature_2m_max"];
        if (!tmax.isNull() && tmax.is<JsonArrayConst>())
        {
          JsonArrayConst arr = tmax.as<JsonArrayConst>();
          if (arr.size() > 0 && !arr[0].isNull())
            wd.tempMax = arr[0].as<float>();
        }
        JsonVariantConst tmin = d["temperature_2m_min"];
        if (!tmin.isNull() && tmin.is<JsonArrayConst>())
        {
          JsonArrayConst arr = tmin.as<JsonArrayConst>();
          if (arr.size() > 0 && !arr[0].isNull())
            wd.tempMin = arr[0].as<float>();
        }
      }
      if (wd.tempUnit.length() == 0 || wd.tempUnit == "celsius" || wd.tempUnit == "fahrenheit")
      {
        JsonVariantConst units = wo["units"];
        if (!units.isNull() && units.is<JsonObjectConst>())
        {
          String tu = jsonText(units.as<JsonObjectConst>()["temperature_unit"]);
          if (tu == "fahrenheit")
            wd.tempUnit = "F";
          else if (tu == "celsius")
            wd.tempUnit = "C";
        }
      }
      if (wd.tempUnit == "celsius" || wd.tempUnit == "°C")
        wd.tempUnit = "C";
      if (wd.tempUnit == "fahrenheit" || wd.tempUnit == "°F")
        wd.tempUnit = "F";
    }
    else
    {
      g_snap.weather.hasData = false;
      g_snap.weather.ok = false;
      g_snap.weather.error = "";
    }
  }

  // Moedas — objeto único (não lista de contas). Ausente/null = card some.
  {
    JsonVariantConst cu = doc["currencies"];
    if (!cu.isNull() && cu.is<JsonObjectConst>())
    {
      JsonObjectConst o = cu.as<JsonObjectConst>();
      g_snap.currencies.hasData = true;
      g_snap.currencies.ok = o["ok"] | false;
      g_snap.currencies.error = o["error"].isNull() ? "" : String(o["error"].as<const char *>());
      g_snap.currencies.base = jsonText(o["base"]);
      if (!g_snap.currencies.base.length())
      {
        g_snap.currencies.base = "BRL";
      }
      g_snap.currencies.itemCount = 0;
      for (JsonVariantConst v : o["items"].as<JsonArrayConst>())
      {
        if (g_snap.currencies.itemCount >= MAX_CURRENCY_ITEMS)
        {
          Serial.println("currencies: mais itens do que MAX_CURRENCY_ITEMS, ignorando o resto");
          break;
        }
        JsonObjectConst acc = v.as<JsonObjectConst>();
        CurrencyQuote &q = g_snap.currencies.items[g_snap.currencies.itemCount++];
        q.id = jsonText(acc["id"]);
        q.kind = jsonText(acc["kind"]);
        q.code = jsonText(acc["code"]);
        q.label = jsonText(acc["label"]);
        q.ok = acc["ok"] | false;
        q.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char *>());
        q.price = jsonFloatOrNeg(acc["price"]);
      }
    }
    else
    {
      g_snap.currencies.hasData = false;
      g_snap.currencies.ok = false;
      g_snap.currencies.error = "";
      g_snap.currencies.itemCount = 0;
    }
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
