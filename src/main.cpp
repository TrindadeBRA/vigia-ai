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
  g_snap.claude.ok = true;
  g_snap.claude.sessionPercent = 42;
  g_snap.claude.weeklyPercent = 18;
  g_snap.claude.sessionResets = "2026-08-31T04:00:00Z";
  g_snap.claude.weeklyResets = "2026-09-04T03:00:00Z";
  g_snap.claude.sonnetPercent = 55;
  g_snap.claude.sonnetResets = "2026-09-04T03:00:00Z";
  g_snap.claude.opusPercent = 12;
  g_snap.claude.opusResets = "2026-09-04T03:00:00Z";
  g_snap.cursor.ok = true;
  g_snap.cursor.percent = 70;
  g_snap.cursor.otherPercent = 73;
  g_snap.cursor.usedCents = 0;
  g_snap.cursor.limitCents = 1000;
  g_snap.cursor.remainingCents = 1000;
  g_snap.cursor.bonusCents = 200;
  g_snap.cursor.requestsUsed = -1;
  g_snap.cursor.requestsLimit = -1;
  g_snap.cursor.cycleEnd = "01/09";
  g_snap.cursor.plan = "pro";
  g_snap.openrouter.ok = true;
  g_snap.openrouter.percent = 66.6;
  g_snap.openrouter.limitCents = 1000;
  g_snap.openrouter.usedCents = 666;
  g_snap.openrouter.remainingCents = 334;
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
  tft.fillScreen(COL_BG);
  Serial.printf("tft %dx%d rot=%d\n", tft.width(), tft.height(), (int)TFT_ROTATION);
  uiInit();

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
    g_snap.claude.ok = false;
    g_snap.claude.error = "aguardando Wi-Fi";
    g_snap.cursor.ok = false;
    g_snap.cursor.error = "aguardando Wi-Fi";
    g_snap.openrouter.ok = false;
    g_snap.openrouter.error = "aguardando Wi-Fi";
    uiRefreshData();
  }
  delay(20);
#endif
}
