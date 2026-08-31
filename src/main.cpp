#include <Arduino.h>
#include <TFT_eSPI.h>

#ifndef MOCK_USAGE
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
#endif

#include <ArduinoJson.h>

#include "input.h"
#include "ui.h"

#ifndef USAGE_POLL_MS
#define USAGE_POLL_MS 300000
#endif

#ifndef TFT_ROTATION
#define TFT_ROTATION 1
#endif

TFT_eSPI tft = TFT_eSPI();
UsageSnapshot g_snap;
bool g_requestRefresh = false;
bool g_requestCalibrate = false;
String g_netLine = "";

static uint32_t g_lastFetchMs = 0;
static bool g_wifiOnce = false;
static uint32_t g_wifiRetryMs = 0;
static bool g_wifiLogged = false;

static void applyMock() {
  g_snap.httpOk = true;
  g_snap.statusLine = "mock";
  g_snap.updatedAt = "2026-08-31T12:00:00Z";
  g_snap.claude.ok = true;
  g_snap.claude.sessionPercent = 42;
  g_snap.claude.weeklyPercent = 18;
  g_snap.claude.sessionResets = "2026-08-31T04:00:00Z";
  g_snap.claude.weeklyResets = "2026-09-04T03:00:00Z";
  g_snap.cursor.ok = true;
  g_snap.cursor.percent = 70;
  g_snap.cursor.otherPercent = 73;
  g_snap.cursor.usedCents = 0;
  g_snap.cursor.limitCents = 1000;
  g_snap.cursor.bonusCents = 0;
  g_snap.cursor.cycleEnd = "01/09";
  g_snap.cursor.plan = "pro";
  g_netLine = "simulador Wokwi";
}

static void logSnapshot(const char* why) {
  Serial.printf("usage %s\n", why);
  Serial.printf("  claude ok=%d sessao=%.0f semana=%.0f err=%s\n", g_snap.claude.ok ? 1 : 0,
                g_snap.claude.sessionPercent, g_snap.claude.weeklyPercent,
                g_snap.claude.error.length() ? g_snap.claude.error.c_str() : "-");
  Serial.printf("  cursor ok=%d pct=%.0f plan=%s err=%s\n", g_snap.cursor.ok ? 1 : 0,
                g_snap.cursor.percent,
                g_snap.cursor.plan.length() ? g_snap.cursor.plan.c_str() : "-",
                g_snap.cursor.error.length() ? g_snap.cursor.error.c_str() : "-");
}

#ifndef MOCK_USAGE
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
    g_snap.claude.ok = false;
    g_snap.claude.error = err.c_str();
    g_snap.cursor.ok = false;
    g_snap.cursor.error = err.c_str();
    return false;
  }

  g_snap.updatedAt = doc["updated_at"] | "";
  JsonObjectConst claude = doc["claude"];
  JsonObjectConst cursor = doc["cursor"];

  g_snap.claude.ok = claude["ok"] | false;
  g_snap.claude.error = claude["error"].isNull() ? "" : String(claude["error"].as<const char*>());
  g_snap.claude.sessionPercent = jsonFloatOrNeg(claude["session_percent"]);
  g_snap.claude.weeklyPercent = jsonFloatOrNeg(claude["weekly_percent"]);
  g_snap.claude.sessionResets = jsonText(claude["session_resets_at"]);
  g_snap.claude.weeklyResets = jsonText(claude["weekly_resets_at"]);

  g_snap.cursor.ok = cursor["ok"] | false;
  g_snap.cursor.error = cursor["error"].isNull() ? "" : String(cursor["error"].as<const char*>());
  g_snap.cursor.percent = jsonFloatOrNeg(cursor["percent"]);
  g_snap.cursor.otherPercent = jsonFloatOrNeg(cursor["other_percent"]);
  g_snap.cursor.usedCents = cursor["used_cents"].isNull() ? -1 : cursor["used_cents"].as<int>();
  g_snap.cursor.limitCents = cursor["limit_cents"].isNull() ? -1 : cursor["limit_cents"].as<int>();
  g_snap.cursor.bonusCents = cursor["bonus_cents"].isNull() ? -1 : cursor["bonus_cents"].as<int>();
  g_snap.cursor.cycleEnd = jsonText(cursor["cycle_end"]);
  g_snap.cursor.plan = jsonText(cursor["plan"]);

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

static void fetchUsage() {
  updateNetLine();
  Serial.println("coletor: buscando /usage");
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("coletor: sem Wi-Fi, aborta GET");
    g_snap.statusLine = "Wi-Fi";
    g_snap.claude.ok = false;
    g_snap.claude.error = "sem Wi-Fi";
    g_snap.cursor.ok = false;
    g_snap.cursor.error = "sem Wi-Fi";
    logSnapshot("wifi-down");
    uiPaint();
    return;
  }

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
    g_snap.claude.ok = false;
    g_snap.claude.error = "USAGE_URL";
    logSnapshot("url");
    uiPaint();
    return;
  }

  int code = http.GET();
  Serial.printf("coletor GET %s -> HTTP %d\n", USAGE_URL, code);
  if (code != 200) {
    g_snap.httpOk = false;
    g_snap.statusLine = "HTTP " + String(code);
    g_snap.claude.ok = false;
    g_snap.claude.error = "coletor HTTP " + String(code);
    g_snap.cursor.ok = false;
    g_snap.cursor.error = "coletor HTTP " + String(code);
    http.end();
    logSnapshot("http-erro");
    uiPaint();
    return;
  }

  String body = http.getString();
  http.end();
  Serial.printf("coletor: corpo %d bytes\n", body.length());
  g_snap.httpOk = parseUsageJson(body);
  logSnapshot(g_snap.httpOk ? "ok" : "parse");
  uiPaint();
}

static void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!g_wifiLogged) {
      Serial.printf("Wi-Fi conectado ip=%s rssi=%d dBm\n", WiFi.localIP().toString().c_str(),
                    WiFi.RSSI());
      g_wifiLogged = true;
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
#endif

void setup() {
  Serial.begin(115200);
  delay(200);

  tft.init();
  tft.setRotation(TFT_ROTATION);
  tft.resetViewport();
  tft.fillScreen(COL_BG);
  Serial.printf("tft %dx%d rot=%d\n", tft.width(), tft.height(), (int)TFT_ROTATION);
  uiInit();

#ifdef MOCK_USAGE
  applyMock();
  inputBegin();
  uiPaint();
  Serial.println("=== CONTROL-IA Wokwi (MOCK_USAGE) ===");
  Serial.println("Nao conecta no coletor. 'mock' no topo e esperado.");
  Serial.println("Dados reais: pio run -e esp32dev -t upload + python3 collector/server.py");
  logSnapshot("mock");
#else
#ifdef WOKWI_SIM
  Serial.println("=== CONTROL-IA Wokwi (coletor real) ===");
  Serial.println("Wi-Fi Wokwi-GUEST -> http://host.wokwi.internal:8787/usage");
#else
  Serial.println("=== CONTROL-IA hardware ===");
#endif
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(COL_ACCENT, COL_BG);
  tft.drawString("CONTROL-IA", tft.width() / 2, tft.height() / 2, 4);
  inputBegin();
  g_lastFetchMs = 0;
  ensureWifi();
#endif
}

void loop() {
  inputPoll();

#ifdef MOCK_USAGE
  if (g_requestRefresh) {
    g_requestRefresh = false;
    Serial.println("refresh mock (ainda sem coletor)");
    applyMock();
    uiPaint();
    logSnapshot("mock-refresh");
  }
  delay(25);
#else
  ensureWifi();
  uint32_t now = millis();
  bool due = (g_lastFetchMs == 0) || (now - g_lastFetchMs >= (uint32_t)USAGE_POLL_MS);
  if (g_requestRefresh) {
    Serial.println("refresh pedido (tela/serial r)");
    due = true;
    g_requestRefresh = false;
  }
  if (WiFi.status() == WL_CONNECTED && due) {
    fetchUsage();
    g_lastFetchMs = millis();
  } else if (WiFi.status() != WL_CONNECTED && now - g_lastFetchMs > 5000) {
    Serial.printf("aguardando Wi-Fi (status=%d)\n", (int)WiFi.status());
    g_lastFetchMs = now;
    g_snap.statusLine = "Wi-Fi";
    g_snap.claude.ok = false;
    g_snap.claude.error = "aguardando Wi-Fi";
    g_snap.cursor.ok = false;
    g_snap.cursor.error = "aguardando Wi-Fi";
    updateNetLine();
    uiPaint();
  }
  delay(20);
#endif
}
