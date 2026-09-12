#include "net/spotify_client.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <cstring>

#include "core/state.h"
#include "net/parse.h"
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

static void addVigiaHeaders(HTTPClient &http)
{
  http.addHeader("X-Vigia-Device", "esp32");
  http.addHeader("X-Vigia-Screen", String(tft.width()) + "x" + String(tft.height()));
}

bool spotifyVisible()
{
  if (!customThemeActive()) return false;
  String j = customThemeCurrentJson();
  if (!j.length()) return false;
  return j.indexOf("\"spotify\"") >= 0;
}

// Capa 48×48 RGB565 = 4608 bytes — cabe em BSS, sem heap fragmentado.
constexpr int kCoverSize = 48;
static uint16_t g_cover[kCoverSize * kCoverSize];
static bool g_coverReady = false;
static String g_coverTrackId;
static uint32_t g_spotifyLastPollMs = 0;
static uint32_t g_spotifyForcePollAt = 0;
static String g_lastPaintKey;

bool spotifyCoverReady() { return g_coverReady; }
int spotifyCoverSize() { return g_coverReady ? kCoverSize : 0; }
const uint16_t *spotifyCoverPixels() { return g_cover; }

static void clearCover()
{
  g_coverReady = false;
  g_coverTrackId = "";
}

static String paintKey()
{
  const SpotifyData &s = g_snap.spotify;
  return String(s.configured) + "|" + String(s.ok) + "|" + String(s.isPlaying) + "|" +
         s.trackId + "|" + s.trackName + "|" + s.artists + "|" + String(g_coverReady);
}

static void maybeRefreshTheme()
{
  if (g_view != VIEW_THEME || !spotifyVisible()) return;
  String key = paintKey();
  if (key == g_lastPaintKey) return;
  g_lastPaintKey = key;
  uiRefreshData();
}

static bool fetchCover(const String &base, const String &trackId)
{
  if (!trackId.length())
  {
    clearCover();
    return false;
  }
  if (g_coverReady && g_coverTrackId == trackId) return true;

  HTTPClient http;
  http.setTimeout(6000);
  http.setConnectTimeout(3000);
  String url = base + "api/spotify/cover?size=" + String(kCoverSize);
  if (!http.begin(url)) return false;
  addVigiaHeaders(http);
  int code = http.GET();
  if (code == 204 || code == 404)
  {
    http.end();
    clearCover();
    return false;
  }
  if (code != 200)
  {
    http.end();
    Serial.printf("spotify: capa HTTP %d\n", code);
    return false;
  }
  const int expected = kCoverSize * kCoverSize * 2;
  int len = http.getSize();
  WiFiClient *stream = http.getStreamPtr();
  if (!stream)
  {
    http.end();
    return false;
  }
  if (len < 0) len = expected;
  if (len != expected)
  {
    Serial.printf("spotify: capa tamanho %d (esperado %d)\n", len, expected);
    http.end();
    return false;
  }
  uint8_t *raw = reinterpret_cast<uint8_t *>(g_cover);
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
    Serial.printf("spotify: capa incompleta %d/%d\n", got, expected);
    clearCover();
    return false;
  }
  g_coverReady = true;
  g_coverTrackId = trackId;
  return true;
}

void spotifyClientPoll()
{
  if (WiFi.status() != WL_CONNECTED) return;
  String base = originWithSlash(USAGE_URL);
  if (!base.length()) return;
  HTTPClient http;
  http.setTimeout(6000);
  http.setConnectTimeout(3000);
  String url = base + "api/spotify";
  if (!http.begin(url)) return;
  addVigiaHeaders(http);
  int code = http.GET();
  if (code != 200)
  {
    http.end();
    return;
  }
  String body = http.getString();
  http.end();
  JsonDocument doc;
  if (deserializeJson(doc, body))
  {
    Serial.println("spotify: JSON inválido");
    return;
  }
  SpotifyData &s = g_snap.spotify;
  s.hasData = true;
  s.ok = doc["ok"] | false;
  s.configured = doc["configured"] | false;
  s.error = doc["error"].isNull() ? "" : String(doc["error"].as<const char*>());
  s.isPlaying = doc["is_playing"] | false;
  s.progressMs = doc["progress_ms"].isNull() ? -1 : doc["progress_ms"].as<int>();
  JsonVariantConst track = doc["track"];
  if (!track.isNull() && track.is<JsonObjectConst>())
  {
    JsonObjectConst t = track.as<JsonObjectConst>();
    s.trackId = jsonText(t["id"]);
    s.trackName = asciiFold(jsonText(t["name"]));
    s.artists = asciiFold(jsonText(t["artists"]));
    s.album = asciiFold(jsonText(t["album"]));
    s.durationMs = t["duration_ms"].isNull() ? -1 : t["duration_ms"].as<int>();
  }
  else
  {
    s.trackId = "";
    s.trackName = "";
    s.artists = "";
    s.album = "";
    s.durationMs = -1;
  }
  if (s.configured && s.ok && s.trackId.length())
  {
    fetchCover(base, s.trackId);
  }
  else
  {
    clearCover();
  }
  maybeRefreshTheme();
}

void spotifyClientCommand(const char *action)
{
  if (!action || !action[0]) return;
  if (WiFi.status() != WL_CONNECTED) return;
  String base = originWithSlash(USAGE_URL);
  if (!base.length()) return;

  SpotifyData &s = g_snap.spotify;
  if (strcmp(action, "play") == 0) s.isPlaying = true;
  else if (strcmp(action, "pause") == 0) s.isPlaying = false;
  maybeRefreshTheme();

  HTTPClient http;
  http.setTimeout(6000);
  http.setConnectTimeout(3000);
  String url = base + "api/spotify/" + action;
  if (!http.begin(url)) return;
  addVigiaHeaders(http);
  http.addHeader("Content-Length", "0");
  int code = http.POST("");
  http.end();
  if (code != 200 && code != 204)
  {
    Serial.printf("spotify: POST %s -> HTTP %d\n", action, code);
  }
  // Próximo poll em ~400 ms pra reconciliar capa/faixa depois de next/previous.
  g_spotifyForcePollAt = millis() + 400;
}

void spotifyClientTick()
{
  if (!customThemeActive() || !spotifyVisible())
  {
    return;
  }
  if (g_view != VIEW_THEME)
  {
    return;
  }
  if (WiFi.status() != WL_CONNECTED) return;
  uint32_t now = millis();
  if (g_spotifyForcePollAt && (int32_t)(now - g_spotifyForcePollAt) >= 0)
  {
    g_spotifyForcePollAt = 0;
    g_spotifyLastPollMs = now;
    spotifyClientPoll();
    return;
  }
  if (now - g_spotifyLastPollMs < 5000) return;
  g_spotifyLastPollMs = now;
  spotifyClientPoll();
}
