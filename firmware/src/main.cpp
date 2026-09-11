#include <Arduino.h>
#include <TFT_eSPI.h>
#include <WiFi.h>

// Árvore: core/ (estado) · net/ (Wi-Fi/SSE/JSON) · input/ (toque/serial) · ui/ (tema, nav, views/).
#include "input/input.h"
#include "mining/mining_task.h"
#include "net/camera_client.h"
#include "net/mining_client.h"
#include "net/spotify_client.h"
#include "net/theme_server.h"
#include "net/usage_client.h"
#include "ui/ui.h"

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
String g_panelUrl = "";

uint32_t g_lastFetchMs = 0;
uint32_t g_pollMs = USAGE_POLL_MS;
bool g_hasFetchedOk = false;
uint32_t g_lastFetchOkMs = 0;

void setup()
{
  Serial.begin(115200);
  delay(200);

  tft.init();
  tft.setRotation(TFT_ROTATION);
  tft.resetViewport();
  uiInit();
  tft.fillScreen(COL_BG);
  Serial.printf("tft %dx%d rot=%d\n", tft.width(), tft.height(), (int)TFT_ROTATION);

  uiShowSplash();

#ifdef WOKWI_SIM
  Serial.println("=== VIGIA AI Wokwi (coletor real, SSE) ===");
  Serial.println("Wi-Fi Wokwi-GUEST -> http://host.wokwi.internal:8787/events");
#else
  Serial.println("=== VIGIA AI hardware (SSE) ===");
#endif
  inputBegin();
  g_lastFetchMs = 0;
  usageClientEnsureWifi();
  themeServerBegin();
  // Estado de loading pos-splash — espelha o Skeleton da web
  // (frontend/src/components/skeleton/bodies.tsx -> OverviewBody) enquanto
  // o coletor ainda nao respondeu / os conectores nao voltaram.
  // Wi-Fi ja foi disparado acima, entao a animacao cobre o tempo de conexao.
  uiShowLoading();
  uiPaint();
}

void loop()
{
  if (g_view == VIEW_CAMERA)
  {
    inputPoll();
    cameraClientTickLive();
    uiTickCamera();
    cameraClientTickLive();
    delay(1);
    return;
  }
  if (g_view == VIEW_CAMERAS)
  {
    inputPoll();
    uiTickClock();
    cameraClientPoll();
    delay(20);
    return;
  }

  inputPoll();
  uiTickClock();
  uiTickEye();
  uiTickMiner();
  uiTickCamera();
  themeServerHandle();
  miningTaskTick();
  miningClientPoll();
  cameraClientPoll();
  spotifyClientTick();

  usageClientEnsureWifi();
  uint32_t now = millis();
  if (WiFi.status() == WL_CONNECTED)
  {
    if (g_requestRefresh)
    {
      Serial.println("refresh pedido (tela/serial r)");
      g_requestRefresh = false;
      usageClientFetch();
    }
    if (g_view != VIEW_CAMERAS)
    {
      usageClientPoll();
    }
    themeClientTick();
  }
  else if (now - g_lastFetchMs > 5000)
  {
    Serial.printf("aguardando Wi-Fi (status=%d)\n", (int)WiFi.status());
    g_lastFetchMs = now;
    g_snap.statusLine = "Wi-Fi";
    markAllAccountsFailed("aguardando Wi-Fi");
    uiRefreshData();
  }
  delay(20);
}
