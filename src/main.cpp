#include <Arduino.h>
#include <TFT_eSPI.h>

#ifndef MOCK_USAGE
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define WIFI_SSID "SUA_REDE"
#define WIFI_PASSWORD "SUA_SENHA"
#define USAGE_URL "http://192.168.1.10:8787/usage"
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

TFT_eSPI tft = TFT_eSPI();
UsageSnapshot g_snap;
bool g_requestRefresh = false;
bool g_requestCalibrate = false;
String g_netLine = "";

static uint32_t g_lastFetchMs = 0;
static bool g_wifiOnce = false;
static uint32_t g_wifiRetryMs = 0;

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
  g_snap.cursor.percent = 35;
  g_snap.cursor.usedCents = 700;
  g_snap.cursor.limitCents = 2000;
  g_snap.cursor.cycleEnd = "2026-09-15T00:00:00Z";
  g_snap.cursor.plan = "pro";
  g_netLine = "simulador Wokwi";
}

#ifndef MOCK_USAGE
static float jsonFloatOrNeg(JsonVariantConst v) {
  if (v.isNull()) {
    return -1;
  }
  return v.as<float>();
}

static bool parseUsageJson(const String& body) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
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
  g_snap.claude.sessionResets =
      claude["session_resets_at"].isNull() ? "" : String(claude["session_resets_at"].as<const char*>());
  g_snap.claude.weeklyResets =
      claude["weekly_resets_at"].isNull() ? "" : String(claude["weekly_resets_at"].as<const char*>());

  g_snap.cursor.ok = cursor["ok"] | false;
  g_snap.cursor.error = cursor["error"].isNull() ? "" : String(cursor["error"].as<const char*>());
  g_snap.cursor.percent = jsonFloatOrNeg(cursor["percent"]);
  g_snap.cursor.usedCents = cursor["used_cents"].isNull() ? -1 : cursor["used_cents"].as<int>();
  g_snap.cursor.limitCents = cursor["limit_cents"].isNull() ? -1 : cursor["limit_cents"].as<int>();
  g_snap.cursor.cycleEnd =
      cursor["cycle_end"].isNull() ? "" : String(cursor["cycle_end"].as<const char*>());
  g_snap.cursor.plan = cursor["plan"].isNull() ? "" : String(cursor["plan"].as<const char*>());

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
  if (WiFi.status() != WL_CONNECTED) {
    g_snap.statusLine = "Wi-Fi";
    g_snap.claude.ok = false;
    g_snap.claude.error = "sem Wi-Fi";
    g_snap.cursor.ok = false;
    g_snap.cursor.error = "sem Wi-Fi";
    uiPaint();
    return;
  }

  HTTPClient http;
  http.setTimeout(8000);
  http.setConnectTimeout(5000);
  if (!http.begin(USAGE_URL)) {
    g_snap.statusLine = "URL";
    g_snap.claude.ok = false;
    g_snap.claude.error = "USAGE_URL";
    uiPaint();
    return;
  }

  int code = http.GET();
  Serial.printf("GET %s -> %d\n", USAGE_URL, code);
  if (code != 200) {
    g_snap.httpOk = false;
    g_snap.statusLine = "HTTP " + String(code);
    g_snap.claude.ok = false;
    g_snap.claude.error = "coletor HTTP " + String(code);
    g_snap.cursor.ok = false;
    g_snap.cursor.error = "coletor HTTP " + String(code);
    http.end();
    uiPaint();
    return;
  }

  String body = http.getString();
  http.end();
  g_snap.httpOk = parseUsageJson(body);
  uiPaint();
}

static void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }
  uint32_t now = millis();
  if (!g_wifiOnce) {
    Serial.printf("Wi-Fi SSID=%s\n", WIFI_SSID);
    Serial.printf("USAGE_URL=%s\n", USAGE_URL);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    g_wifiOnce = true;
    g_wifiRetryMs = now;
    return;
  }
  if (now - g_wifiRetryMs > 15000) {
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    g_wifiRetryMs = now;
  }
}
#endif

void setup() {
  Serial.begin(115200);
  delay(200);

  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_NAVY);
  uiInit();

#ifdef MOCK_USAGE
  applyMock();
  inputBegin();
  uiPaint();
  Serial.println("mock: clique na tela, botoes GPIO5/13 ou serial n/p/0-3/r");
#else
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(TFT_YELLOW, TFT_NAVY);
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
    applyMock();
    uiPaint();
  }
  delay(25);
#else
  ensureWifi();
  uint32_t now = millis();
  bool due = (g_lastFetchMs == 0) || (now - g_lastFetchMs >= (uint32_t)USAGE_POLL_MS);
  if (g_requestRefresh) {
    due = true;
    g_requestRefresh = false;
  }
  if (WiFi.status() == WL_CONNECTED && due) {
    fetchUsage();
    g_lastFetchMs = millis();
  } else if (WiFi.status() != WL_CONNECTED && now - g_lastFetchMs > 5000) {
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
