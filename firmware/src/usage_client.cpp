#include "usage_client.h"

#include "ui.h"

#ifdef WOKWI_SIM
#define WIFI_SSID "Wokwi-GUEST"
#define WIFI_PASSWORD ""
#define USAGE_URL "http://host.wokwi.internal:8787/usage"
#else
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define WIFI_SSID "SUA_REDE"
#define WIFI_PASSWORD "SUA_SENHA"
#define USAGE_URL "http://192.168.1.10:8787/usage"
#endif
#endif
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClient.h>

#include <ArduinoJson.h>

void usageClientLogSnapshot(const char* why) {
  Serial.printf("usage %s\n", why);
  Serial.printf("  claude contas=%d\n", g_snap.claudeCount);
  for (int i = 0; i < g_snap.claudeCount; i++) {
    const ClaudeAccount& c = g_snap.claude[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d sessao=%.0f semana=%.0f err=%s\n", i,
                  c.id.c_str(), c.label.length() ? c.label.c_str() : "-", c.ok ? 1 : 0,
                  c.sessionPercent, c.weeklyPercent, c.error.length() ? c.error.c_str() : "-");
  }
  Serial.printf("  cursor contas=%d\n", g_snap.cursorCount);
  for (int i = 0; i < g_snap.cursorCount; i++) {
    const CursorAccount& c = g_snap.cursor[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d pct=%.0f plan=%s err=%s\n", i, c.id.c_str(),
                  c.label.length() ? c.label.c_str() : "-", c.ok ? 1 : 0, c.percent,
                  c.plan.length() ? c.plan.c_str() : "-", c.error.length() ? c.error.c_str() : "-");
  }
  Serial.printf("  openrouter contas=%d\n", g_snap.openrouterCount);
  for (int i = 0; i < g_snap.openrouterCount; i++) {
    const OpenRouterAccount& o = g_snap.openrouter[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d pct=%.0f err=%s\n", i, o.id.c_str(),
                  o.label.length() ? o.label.c_str() : "-", o.ok ? 1 : 0, o.percent,
                  o.error.length() ? o.error.c_str() : "-");
  }
  Serial.printf("  deepseek contas=%d\n", g_snap.deepseekCount);
  for (int i = 0; i < g_snap.deepseekCount; i++) {
    const DeepSeekAccount& d = g_snap.deepseek[i];
    Serial.printf("    [%d] id=%s label=%s ok=%d pct=%.0f err=%s\n", i, d.id.c_str(),
                  d.label.length() ? d.label.c_str() : "-", d.ok ? 1 : 0, d.percent,
                  d.error.length() ? d.error.c_str() : "-");
  }
}

// Falha total (Wi-Fi fora do ar, HTTP != 200, JSON ilegivel): marca todas as
// contas ja conhecidas (de um /usage anterior bem-sucedido) como falhas, sem
// apagar id/label/contagem — o card de cada uma continua visivel, com erro,
// em vez de sumir. No boot, antes do primeiro /usage OK, as contagens ainda
// sao 0 (o firmware so descobre quantas contas existem depois do primeiro
// contato com o coletor) — a Início mostra vazio ate la, por alguns segundos.
void markAllAccountsFailed(const char* msg) {
  for (int i = 0; i < g_snap.claudeCount; i++) {
    g_snap.claude[i].ok = false;
    g_snap.claude[i].error = msg;
  }
  for (int i = 0; i < g_snap.cursorCount; i++) {
    g_snap.cursor[i].ok = false;
    g_snap.cursor[i].error = msg;
  }
  for (int i = 0; i < g_snap.openrouterCount; i++) {
    g_snap.openrouter[i].ok = false;
    g_snap.openrouter[i].error = msg;
  }
  for (int i = 0; i < g_snap.deepseekCount; i++) {
    g_snap.deepseek[i].ok = false;
    g_snap.deepseek[i].error = msg;
  }
}

static bool g_wifiOnce = false;
static uint32_t g_wifiRetryMs = 0;
static bool g_wifiLogged = false;

static float jsonFloatOrNeg(JsonVariantConst v) {
  if (v.isNull()) {
    return -1;
  }
  return v.as<float>();
}

static String jsonText(JsonVariantConst v) {
  if (v.isNull()) {
    return "";
  }
  if (v.is<const char*>()) {
    const char* p = v.as<const char*>();
    return p ? String(p) : "";
  }
  char buf[28];
  snprintf(buf, sizeof(buf), "%.0f", v.as<double>());
  return String(buf);
}

static bool parseUsageJson(const String& body) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("JSON parse falhou: %s (%d bytes)\n", err.c_str(), body.length());
    g_snap.statusLine = "JSON";
    markAllAccountsFailed(err.c_str());
    return false;
  }

  g_snap.updatedAt = doc["updated_at"] | "";

  g_snap.claudeCount = 0;
  for (JsonVariantConst v : doc["claude"].as<JsonArrayConst>()) {
    if (g_snap.claudeCount >= MAX_ACCOUNTS) {
      Serial.println("claude: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    ClaudeAccount& c = g_snap.claude[g_snap.claudeCount++];
    c.id = jsonText(acc["id"]);
    c.label = jsonText(acc["label"]);
    c.ok = acc["ok"] | false;
    c.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char*>());
    c.sessionPercent = jsonFloatOrNeg(acc["session_percent"]);
    c.sessionResets = jsonText(acc["session_resets_at"]);
    c.weeklyPercent = jsonFloatOrNeg(acc["weekly_percent"]);
    c.weeklyResets = jsonText(acc["weekly_resets_at"]);
    c.sonnetPercent = jsonFloatOrNeg(acc["sonnet_percent"]);
    c.sonnetResets = jsonText(acc["sonnet_resets_at"]);
    c.opusPercent = jsonFloatOrNeg(acc["opus_percent"]);
    c.opusResets = jsonText(acc["opus_resets_at"]);
  }

  g_snap.cursorCount = 0;
  for (JsonVariantConst v : doc["cursor"].as<JsonArrayConst>()) {
    if (g_snap.cursorCount >= MAX_ACCOUNTS) {
      Serial.println("cursor: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    CursorAccount& c = g_snap.cursor[g_snap.cursorCount++];
    c.id = jsonText(acc["id"]);
    c.label = jsonText(acc["label"]);
    c.ok = acc["ok"] | false;
    c.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char*>());
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
  for (JsonVariantConst v : doc["openrouter"].as<JsonArrayConst>()) {
    if (g_snap.openrouterCount >= MAX_ACCOUNTS) {
      Serial.println("openrouter: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    OpenRouterAccount& o = g_snap.openrouter[g_snap.openrouterCount++];
    o.id = jsonText(acc["id"]);
    o.label = jsonText(acc["label"]);
    o.ok = acc["ok"] | false;
    o.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char*>());
    o.percent = jsonFloatOrNeg(acc["percent"]);
    o.limitCents = acc["limit_cents"].isNull() ? -1 : acc["limit_cents"].as<int>();
    o.usedCents = acc["used_cents"].isNull() ? -1 : acc["used_cents"].as<int>();
    o.remainingCents = acc["remaining_cents"].isNull() ? -1 : acc["remaining_cents"].as<int>();
  }

  g_snap.deepseekCount = 0;
  for (JsonVariantConst v : doc["deepseek"].as<JsonArrayConst>()) {
    if (g_snap.deepseekCount >= MAX_ACCOUNTS) {
      Serial.println("deepseek: mais contas do que MAX_ACCOUNTS, ignorando o resto");
      break;
    }
    JsonObjectConst acc = v.as<JsonObjectConst>();
    DeepSeekAccount& d = g_snap.deepseek[g_snap.deepseekCount++];
    d.id = jsonText(acc["id"]);
    d.label = jsonText(acc["label"]);
    d.ok = acc["ok"] | false;
    d.error = acc["error"].isNull() ? "" : String(acc["error"].as<const char*>());
    d.percent = jsonFloatOrNeg(acc["percent"]);
    d.limitCents = acc["limit_cents"].isNull() ? -1 : acc["limit_cents"].as<int>();
    d.usedCents = acc["used_cents"].isNull() ? -1 : acc["used_cents"].as<int>();
    d.remainingCents = acc["remaining_cents"].isNull() ? -1 : acc["remaining_cents"].as<int>();
  }

  if (g_snap.updatedAt.length() >= 16) {
    g_snap.statusLine = g_snap.updatedAt.substring(11, 16);
  } else {
    g_snap.statusLine = "ok";
  }
  return true;
}

static void updateNetLine() {
  if (WiFi.status() == WL_CONNECTED) {
    g_netLine = String(WIFI_SSID) + "  " + WiFi.localIP().toString();
  } else {
    g_netLine = String("Wi-Fi: ") + WIFI_SSID;
  }
}

static String originWithSlash(const String& url) {
  String u = url;
  int scheme = u.indexOf("://");
  if (scheme < 0) {
    return "";
  }
  int path = u.indexOf('/', scheme + 3);
  if (path >= 0) {
    u = u.substring(0, path);
  }
  u += "/";
  return u;
}

static bool urlLooksLan(const String& u) {
  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    return false;
  }
  if (u.indexOf("127.0.0.1") >= 0 || u.indexOf("localhost") >= 0) {
    return false;
  }
  if (u.indexOf(".internal") >= 0) {
    return false;
  }
  return true;
}

static void applyPanelUrl(const String& candidate) {
  String next = originWithSlash(candidate);
  if (!urlLooksLan(next)) {
    return;
  }
  if (next != g_panelUrl) {
    g_panelUrl = next;
    Serial.printf("painel LAN=%s\n", g_panelUrl.c_str());
    uiRefreshData();
  }
}

static uint32_t g_panelTriedMs = 0;

static void refreshPanelUrl() {
  g_panelTriedMs = millis();
  applyPanelUrl(USAGE_URL);
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  String health = originWithSlash(USAGE_URL) + "health";
  if (!health.length() || health == "health") {
    return;
  }
  HTTPClient http;
#ifdef WOKWI_SIM
  http.setTimeout(8000);
  http.setConnectTimeout(8000);
#else
  http.setTimeout(3000);
  http.setConnectTimeout(2500);
#endif
  if (!http.begin(health)) {
    return;
  }
  int code = http.GET();
  if (code != 200) {
    http.end();
    return;
  }
  String body = http.getString();
  http.end();
  JsonDocument doc;
  if (deserializeJson(doc, body)) {
    return;
  }
  applyPanelUrl(jsonText(doc["panel_lan"]));
}

static String usageEventsUrl() {
  String u = USAGE_URL;
  if (u.endsWith("/usage")) {
    u.remove(u.length() - 6);
    u += "/events";
    return u;
  }
  if (u.endsWith("/events")) {
    return u;
  }
  if (!u.endsWith("/")) {
    u += "/";
  }
  u += "events";
  return u;
}

static HTTPClient g_http;
static WiFiClient* g_stream = nullptr;
static bool g_sseOpen = false;
static String g_sseLine;
static String g_sseData;
static uint32_t g_sseLastByteMs = 0;
static uint32_t g_sseRetryAt = 0;
static uint32_t g_sseRetryWait = 2000;

#ifndef USAGE_POLL_MS
#define USAGE_POLL_MS 60000
#endif
#ifndef SSE_IDLE_MS
#define SSE_IDLE_MS (USAGE_POLL_MS + 30000)
#endif

static void sseClose() {
  g_stream = nullptr;
  if (g_sseOpen) {
    g_http.end();
    g_sseOpen = false;
  }
  g_sseLine = "";
  g_sseData = "";
}

static void sseHandleLine(const String& raw) {
  String line = raw;
  if (line.endsWith("\r")) {
    line.remove(line.length() - 1);
  }
  if (line.length() == 0) {
    if (g_sseData.length()) {
      Serial.printf("coletor SSE: %d bytes\n", g_sseData.length());
      g_snap.httpOk = parseUsageJson(g_sseData);
      if (g_snap.httpOk) {
        g_hasFetchedOk = true;
        g_lastFetchOkMs = millis();
      }
      usageClientLogSnapshot(g_snap.httpOk ? "sse-ok" : "sse-parse");
      g_lastFetchMs = millis();
      uiRefreshData();
      g_sseData = "";
    }
    return;
  }
  if (line[0] == ':') {
    return;
  }
  if (line.startsWith("data:")) {
    String chunk = line.substring(5);
    if (chunk.startsWith(" ")) {
      chunk.remove(0, 1);
    }
    if (g_sseData.length()) {
      g_sseData += "\n";
    }
    g_sseData += chunk;
  }
}

static void sseOpen() {
  sseClose();
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  String url = usageEventsUrl();
  Serial.printf("coletor SSE: conectando %s\n", url.c_str());
#ifdef WOKWI_SIM
  g_http.setTimeout(20000);
  g_http.setConnectTimeout(15000);
#else
  g_http.setTimeout(30000);
  g_http.setConnectTimeout(5000);
#endif
  if (!g_http.begin(url)) {
    Serial.println("coletor SSE: http.begin falhou");
    g_snap.statusLine = "URL";
    markAllAccountsFailed("USAGE_URL");
    g_lastFetchMs = millis();
    uiRefreshData();
    return;
  }
  g_http.addHeader("Accept", "text/event-stream");
  g_http.addHeader("Cache-Control", "no-cache");
  g_http.useHTTP10(true);
  int code = g_http.GET();
  Serial.printf("coletor SSE GET -> HTTP %d\n", code);
  if (code != 200) {
    g_snap.httpOk = false;
    g_snap.statusLine = "HTTP " + String(code);
    markAllAccountsFailed(("coletor HTTP " + String(code)).c_str());
    g_http.end();
    g_lastFetchMs = millis();
    uiRefreshData();
    return;
  }
  g_stream = g_http.getStreamPtr();
  g_sseOpen = true;
  g_sseLastByteMs = millis();
  g_sseRetryWait = 2000;
}

void usageClientPoll() {
  uint32_t now = millis();
  if (!g_sseOpen) {
    if (!g_panelUrl.length() && now - g_panelTriedMs > 15000) {
      refreshPanelUrl();
    }
    if (now < g_sseRetryAt) {
      return;
    }
    sseOpen();
    if (!g_sseOpen) {
      g_sseRetryAt = now + g_sseRetryWait;
      if (g_sseRetryWait < 30000) {
        g_sseRetryWait *= 2;
      }
    }
    return;
  }
  if (!g_http.connected() || g_stream == nullptr) {
    Serial.println("coletor SSE: caiu, reconecta");
    sseClose();
    g_sseRetryAt = now + g_sseRetryWait;
    return;
  }
  if (now - g_sseLastByteMs > SSE_IDLE_MS) {
    Serial.println("coletor SSE: silêncio demais, reconecta");
    sseClose();
    g_sseRetryAt = now + 1000;
    return;
  }
  int n = 0;
  while (g_stream->available() && n < 512) {
    char c = (char)g_stream->read();
    g_sseLastByteMs = now;
    n++;
    if (c == '\n') {
      sseHandleLine(g_sseLine);
      g_sseLine = "";
    } else {
      g_sseLine += c;
      if (g_sseLine.length() > 12000) {
        Serial.println("coletor SSE: linha enorme, descarta");
        sseClose();
        g_sseRetryAt = now + 2000;
        return;
      }
    }
  }
}

void usageClientFetch() {
  updateNetLine();
  refreshPanelUrl();
  Serial.println("coletor: GET /usage (refresh)");
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("coletor: sem Wi-Fi, aborta GET");
    g_snap.statusLine = "Wi-Fi";
    markAllAccountsFailed("sem Wi-Fi");
    usageClientLogSnapshot("wifi-down");
    g_lastFetchMs = millis();
    uiRefreshData();
    return;
  }

  sseClose();
  HTTPClient http;
#ifdef WOKWI_SIM
  http.setTimeout(20000);
  http.setConnectTimeout(15000);
#else
  http.setTimeout(8000);
  http.setConnectTimeout(5000);
#endif
  if (!http.begin(USAGE_URL)) {
    Serial.printf("coletor: http.begin falhou URL=%s\n", USAGE_URL);
    g_snap.statusLine = "URL";
    markAllAccountsFailed("USAGE_URL");
    usageClientLogSnapshot("url");
    g_lastFetchMs = millis();
    uiRefreshData();
    return;
  }

  int code = http.GET();
  Serial.printf("coletor GET %s -> HTTP %d\n", USAGE_URL, code);
  if (code != 200) {
    g_snap.httpOk = false;
    g_snap.statusLine = "HTTP " + String(code);
    markAllAccountsFailed(("coletor HTTP " + String(code)).c_str());
    http.end();
    usageClientLogSnapshot("http-erro");
    g_lastFetchMs = millis();
    uiRefreshData();
    return;
  }

  String body = http.getString();
  http.end();
  Serial.printf("coletor: corpo %d bytes\n", body.length());
  g_snap.httpOk = parseUsageJson(body);
  if (g_snap.httpOk) {
    g_hasFetchedOk = true;
    g_lastFetchOkMs = millis();
  }
  usageClientLogSnapshot(g_snap.httpOk ? "ok" : "parse");
  g_lastFetchMs = millis();
  uiRefreshData();
}

void usageClientEnsureWifi() {
  updateNetLine();
  if (WiFi.status() == WL_CONNECTED) {
    if (!g_wifiLogged) {
      Serial.printf("Wi-Fi conectado ip=%s rssi=%d dBm\n", WiFi.localIP().toString().c_str(),
                    WiFi.RSSI());
      g_wifiLogged = true;
      refreshPanelUrl();
    }
    return;
  }
  g_wifiLogged = false;
  uint32_t now = millis();
  if (!g_wifiOnce) {
    Serial.printf("Wi-Fi conectando SSID=%s\n", WIFI_SSID);
    Serial.printf("USAGE_URL=%s\n", USAGE_URL);
    WiFi.mode(WIFI_STA);
#ifdef WOKWI_SIM
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);
#else
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
#endif
    g_wifiOnce = true;
    g_wifiRetryMs = now;
    return;
  }
  if (now - g_wifiRetryMs > 15000) {
    Serial.println("Wi-Fi timeout, tentando de novo");
    WiFi.disconnect();
#ifdef WOKWI_SIM
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);
#else
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
#endif
    g_wifiRetryMs = now;
  }
}
