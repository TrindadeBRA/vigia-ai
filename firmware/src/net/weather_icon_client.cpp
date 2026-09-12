#include "net/weather_icon_client.h"

#include <HTTPClient.h>
#include <WiFi.h>

#include "core/state.h"
#include "ui/customtheme.h"
#include "ui/ui.h"

#ifdef WOKWI_SIM
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

// 48×48 RGB565 = 4608 bytes em BSS, igual à capa do Spotify.
constexpr int kIconSize = 48;
// Tem que bater com kBakedCard em ui/customtheme.cpp.
constexpr const char *kIconKeyHex = "1904";
constexpr uint32_t kRetryMs = 30000;

static uint16_t g_icon[kIconSize * kIconSize];
static bool g_iconReady = false;
static int g_iconCode = -1000;
static int g_failedCode = -1000;
static uint32_t g_failedAt = 0;

bool weatherIconReady() { return g_iconReady; }
int weatherIconSize() { return g_iconReady ? kIconSize : 0; }
const uint16_t *weatherIconPixels() { return g_icon; }

static String originWithSlash(const String &url)
{
  String u = url;
  int scheme = u.indexOf("://");
  if (scheme < 0) return "";
  int path = u.indexOf('/', scheme + 3);
  if (path >= 0) u = u.substring(0, path);
  u += "/";
  return u;
}

static bool weatherOnTheme()
{
  if (!customThemeActive()) return false;
  String j = customThemeCurrentJson();
  return j.length() && j.indexOf("\"weather\"") >= 0;
}

static bool fetchIcon(const String &base, int code)
{
  HTTPClient http;
  http.setTimeout(6000);
  http.setConnectTimeout(3000);
  String url = base + "api/weather/icon?code=" + String(code) + "&size=" + String(kIconSize) +
               "&key=" + kIconKeyHex;
  if (!http.begin(url)) return false;
  http.addHeader("X-Vigia-Device", "esp32");
  int status = http.GET();
  if (status != 200)
  {
    http.end();
    Serial.printf("clima: ícone HTTP %d\n", status);
    return false;
  }
  const int expected = kIconSize * kIconSize * 2;
  int len = http.getSize();
  WiFiClient *stream = http.getStreamPtr();
  if (!stream || (len >= 0 && len != expected))
  {
    Serial.printf("clima: ícone tamanho %d (esperado %d)\n", len, expected);
    http.end();
    return false;
  }
  // Baixa por cima do buffer atual: se falhar no meio, o ícone antigo já
  // está corrompido, então marca como não pronto.
  uint8_t *raw = reinterpret_cast<uint8_t *>(g_icon);
  int got = 0;
  while (got < expected)
  {
    int n = stream->readBytes(raw + got, expected - got);
    if (n <= 0) break;
    got += n;
  }
  http.end();
  if (got != expected)
  {
    Serial.printf("clima: ícone incompleto %d/%d\n", got, expected);
    g_iconReady = false;
    g_iconCode = -1000;
    return false;
  }
  g_iconReady = true;
  g_iconCode = code;
  return true;
}

void weatherIconTick()
{
  if (g_view != VIEW_THEME || WiFi.status() != WL_CONNECTED) return;
  const WeatherData &w = g_snap.weather;
  if (!w.hasData || !w.ok || w.weatherCode < 0) return;
  const int code = w.weatherCode;
  if (g_iconReady && g_iconCode == code) return;
  if (code == g_failedCode && millis() - g_failedAt < kRetryMs) return;
  if (!weatherOnTheme()) return;
  String base = originWithSlash(USAGE_URL);
  if (!base.length()) return;
  if (fetchIcon(base, code))
  {
    g_failedCode = -1000;
    uiRefreshData();
  }
  else
  {
    g_failedCode = code;
    g_failedAt = millis();
  }
}
