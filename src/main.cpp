#include <Arduino.h>
#include <TFT_eSPI.h>

#ifndef MOCK_USAGE
#include <WiFi.h>
#endif

#include "input.h"
#include "ui.h"
#include "usage_client.h"

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

uint32_t g_lastFetchMs = 0;
uint32_t g_pollMs = USAGE_POLL_MS;
bool g_hasFetchedOk = false;
uint32_t g_lastFetchOkMs = 0;

static void applyMock() {
  g_snap.httpOk = true;
  g_snap.statusLine = "mock";
  g_snap.updatedAt = "2026-08-31T12:00:00Z";

  g_snap.claudeCount = 1;
  ClaudeAccount& claude = g_snap.claude[0];
  claude.id = "local";
  claude.ok = true;
  claude.sessionPercent = 42;
  claude.weeklyPercent = 18;
  claude.sessionResets = "2026-08-31T04:00:00Z";
  claude.weeklyResets = "2026-09-04T03:00:00Z";
  claude.sonnetPercent = 55;
  claude.sonnetResets = "2026-09-04T03:00:00Z";
  claude.opusPercent = 12;
  claude.opusResets = "2026-09-04T03:00:00Z";

  g_snap.cursorCount = 1;
  CursorAccount& cursor = g_snap.cursor[0];
  cursor.id = "local";
  cursor.ok = true;
  cursor.percent = 70;
  cursor.otherPercent = 73;
  cursor.usedCents = 0;
  cursor.limitCents = 1000;
  cursor.remainingCents = 1000;
  cursor.bonusCents = 200;
  cursor.requestsUsed = -1;
  cursor.requestsLimit = -1;
  cursor.cycleEnd = "01/09";
  cursor.plan = "pro";

  g_snap.openrouterCount = 1;
  OpenRouterAccount& openrouter = g_snap.openrouter[0];
  openrouter.id = "legacy";
  openrouter.ok = true;
  openrouter.percent = 66.6;
  openrouter.limitCents = 1000;
  openrouter.usedCents = 666;
  openrouter.remainingCents = 334;

  g_snap.deepseekCount = 1;
  DeepSeekAccount& deepseek = g_snap.deepseek[0];
  deepseek.id = "legacy";
  deepseek.ok = true;
  deepseek.percent = 25;
  deepseek.limitCents = 1000;
  deepseek.usedCents = 250;
  deepseek.remainingCents = 750;

  g_netLine = "simulador Wokwi";
  g_hasFetchedOk = true;
  g_lastFetchOkMs = millis();
}

void setup() {
  Serial.begin(115200);
  delay(200);

  tft.init();
  tft.setRotation(TFT_ROTATION);
  tft.resetViewport();
  uiInit();
  tft.fillScreen(COL_BG);
  Serial.printf("tft %dx%d rot=%d\n", tft.width(), tft.height(), (int)TFT_ROTATION);

  uiShowSplash();

#ifdef MOCK_USAGE
  applyMock();
  inputBegin();
  uiPaint();
  Serial.println("=== VIGIA AI Wokwi (MOCK_USAGE) ===");
  Serial.println("Nao conecta no coletor. 'mock' no topo e esperado.");
  Serial.println("Dados reais: pio run -e esp32dev -t upload + python3 collector/server.py");
  usageClientLogSnapshot("mock");
#else
#ifdef WOKWI_SIM
  Serial.println("=== VIGIA AI Wokwi (coletor real) ===");
  Serial.println("Wi-Fi Wokwi-GUEST -> http://host.wokwi.internal:8787/usage");
#else
  Serial.println("=== VIGIA AI hardware ===");
#endif
  inputBegin();
  g_lastFetchMs = 0;
  usageClientEnsureWifi();
  uiPaint();
#endif
}

void loop() {
  inputPoll();
  uiTickClock();
  uiTickEye();

#ifdef MOCK_USAGE
  if (g_requestRefresh) {
    g_requestRefresh = false;
    Serial.println("refresh mock (ainda sem coletor)");
    applyMock();
    uiPaint();
    usageClientLogSnapshot("mock-refresh");
  }
  delay(25);
#else
  usageClientEnsureWifi();
  uint32_t now = millis();
  bool due = (g_lastFetchMs == 0) || (now - g_lastFetchMs >= g_pollMs);
  if (g_requestRefresh) {
    Serial.println("refresh pedido (tela/serial r)");
    due = true;
    g_requestRefresh = false;
  }
  if (WiFi.status() == WL_CONNECTED && due) {
    usageClientFetch();
  } else if (WiFi.status() != WL_CONNECTED && now - g_lastFetchMs > 5000) {
    Serial.printf("aguardando Wi-Fi (status=%d)\n", (int)WiFi.status());
    g_lastFetchMs = now;
    g_snap.statusLine = "Wi-Fi";
    markAllAccountsFailed("aguardando Wi-Fi");
    uiRefreshData();
  }
  delay(20);
#endif
}
