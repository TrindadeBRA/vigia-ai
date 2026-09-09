#include "net/spotify_client.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>

#include "core/state.h"
#include "net/parse.h"
#include "ui/customtheme.h"

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

bool spotifyVisible()
{
  if (!customThemeActive()) return false;
  // Verifica se tema tem ícone spotify

  // Evita incluir customtheme.h detalhado aqui — usa JSON cru
  String j = customThemeCurrentJson();
  if (!j.length()) return false;
  return j.indexOf("\"spotify\"") >= 0;
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
  http.addHeader("X-Vigia-Device", "esp32");
  http.addHeader("X-Vigia-Screen", String(tft.width()) + "x" + String(tft.height()));
  int code = http.GET();
  if (code != 200) {
    http.end();
    return;
  }
  String body = http.getString();
  http.end();
  JsonDocument doc;
  if (deserializeJson(doc, body)) {
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
  if (!track.isNull() && track.is<JsonObjectConst>()) {
    JsonObjectConst t = track.as<JsonObjectConst>();
    s.trackName = asciiFold(jsonText(t["name"]));
    s.artists = asciiFold(jsonText(t["artists"]));
    s.album = asciiFold(jsonText(t["album"]));
    s.durationMs = t["duration_ms"].isNull() ? -1 : t["duration_ms"].as<int>();
  } else {
    s.trackName = "";
    s.artists = "";
    s.album = "";
    s.durationMs = -1;
  }
  // Se tem track, marca ok; se não configurado, hasData true mas ok false
  if (s.configured && !s.ok) {
    // mantém erro
  }
  // Força repaint se estiver em VIEW_THEME e tem spotify visível
  if (g_view == VIEW_THEME && spotifyVisible()) {
    uiRefreshData();
  }
}

static uint32_t g_spotifyLastPollMs = 0;

void spotifyClientTick()
{
  if (!customThemeActive() || !spotifyVisible()) {
    return;
  }
  if (g_view != VIEW_THEME) {
    // Só polla quando a view de tema está visível — economiza heap e bateria
    return;
  }
  if (WiFi.status() != WL_CONNECTED) return;
  uint32_t now = millis();
  if (now - g_spotifyLastPollMs < 5000) return;
  g_spotifyLastPollMs = now;
  spotifyClientPoll();
}
