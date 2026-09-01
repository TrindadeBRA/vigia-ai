#include "net/usage_client.h"

#include "net/parse.h"
#include "ui/customtheme.h"
#include "ui/ui.h"

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

static bool g_wifiOnce = false;
static uint32_t g_wifiRetryMs = 0;
static bool g_wifiLogged = false;

static void updateNetLine()
{
  if (WiFi.status() == WL_CONNECTED)
  {
    g_netLine = String(WIFI_SSID) + "  " + WiFi.localIP().toString();
  }
  else
  {
    g_netLine = String("Wi-Fi: ") + WIFI_SSID;
  }
}

static String originWithSlash(const String &url)
{
  String u = url;
  int scheme = u.indexOf("://");
  if (scheme < 0)
  {
    return "";
  }
  int path = u.indexOf('/', scheme + 3);
  if (path >= 0)
  {
    u = u.substring(0, path);
  }
  u += "/";
  return u;
}

static bool urlLooksLan(const String &u)
{
  if (!u.startsWith("http://") && !u.startsWith("https://"))
  {
    return false;
  }
  if (u.indexOf("127.0.0.1") >= 0 || u.indexOf("localhost") >= 0)
  {
    return false;
  }
  if (u.indexOf(".internal") >= 0)
  {
    return false;
  }
  return true;
}

static void applyPanelUrl(const String &candidate)
{
  String next = originWithSlash(candidate);
  if (!urlLooksLan(next))
  {
    return;
  }
  if (next != g_panelUrl)
  {
    g_panelUrl = next;
    Serial.printf("painel LAN=%s\n", g_panelUrl.c_str());
    uiRefreshData();
  }
}

static uint32_t g_panelTriedMs = 0;

static void refreshPanelUrl()
{
  g_panelTriedMs = millis();
  applyPanelUrl(USAGE_URL);
  if (WiFi.status() != WL_CONNECTED)
  {
    return;
  }
  String health = originWithSlash(USAGE_URL) + "health";
  if (!health.length() || health == "health")
  {
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
  if (!http.begin(health))
  {
    return;
  }
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
    return;
  }
  applyPanelUrl(jsonText(doc["panel_lan"]));
}

static String usageEventsUrl()
{
  String u = USAGE_URL;
  if (u.endsWith("/usage"))
  {
    u.remove(u.length() - 6);
    u += "/events";
    return u;
  }
  if (u.endsWith("/events"))
  {
    return u;
  }
  if (!u.endsWith("/"))
  {
    u += "/";
  }
  u += "events";
  return u;
}

static HTTPClient g_http;
static WiFiClient *g_stream = nullptr;
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

static void sseClose()
{
  g_stream = nullptr;
  if (g_sseOpen)
  {
    g_http.end();
    g_sseOpen = false;
  }
  g_sseLine = "";
  g_sseData = "";
}

static void sseHandleLine(const String &raw)
{
  String line = raw;
  if (line.endsWith("\r"))
  {
    line.remove(line.length() - 1);
  }
  if (line.length() == 0)
  {
    if (g_sseData.length())
    {
      Serial.printf("coletor SSE: %d bytes\n", g_sseData.length());
      g_snap.httpOk = parseUsageJson(g_sseData);
      if (g_snap.httpOk)
      {
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
  if (line[0] == ':')
  {
    return;
  }
  if (line.startsWith("data:"))
  {
    String chunk = line.substring(5);
    if (chunk.startsWith(" "))
    {
      chunk.remove(0, 1);
    }
    if (g_sseData.length())
    {
      g_sseData += "\n";
    }
    g_sseData += chunk;
  }
}

static void sseOpen()
{
  sseClose();
  if (WiFi.status() != WL_CONNECTED)
  {
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
  if (!g_http.begin(url))
  {
    Serial.println("coletor SSE: http.begin falhou");
    g_snap.statusLine = "URL";
    markAllAccountsFailed("USAGE_URL");
    g_lastFetchMs = millis();
    uiRefreshData();
    return;
  }
  g_http.addHeader("Accept", "text/event-stream");
  g_http.addHeader("Cache-Control", "no-cache");
  // Distingue a placa do /display (que também escuta /events) pro coletor
  // saber pra quem mandar o tema — ver device_ip em app/hub.py.
  g_http.addHeader("X-Vigia-Device", "esp32");
  // Resolução da tela (protótipo do tema — deixa o editor acertar o
  // tamanho do fundo sem o usuário precisar digitar o IP da placa).
  g_http.addHeader("X-Vigia-Screen", String(tft.width()) + "x" + String(tft.height()));
  g_http.useHTTP10(true);
  int code = g_http.GET();
  Serial.printf("coletor SSE GET -> HTTP %d\n", code);
  if (code != 200)
  {
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

void usageClientPoll()
{
  uint32_t now = millis();
  if (!g_sseOpen)
  {
    if (!g_panelUrl.length() && now - g_panelTriedMs > 15000)
    {
      refreshPanelUrl();
    }
    if (now < g_sseRetryAt)
    {
      return;
    }
    sseOpen();
    if (!g_sseOpen)
    {
      g_sseRetryAt = now + g_sseRetryWait;
      if (g_sseRetryWait < 30000)
      {
        g_sseRetryWait *= 2;
      }
    }
    return;
  }
  if (!g_http.connected() || g_stream == nullptr)
  {
    Serial.println("coletor SSE: caiu, reconecta");
    sseClose();
    g_sseRetryAt = now + g_sseRetryWait;
    return;
  }
  if (now - g_sseLastByteMs > SSE_IDLE_MS)
  {
    Serial.println("coletor SSE: silêncio demais, reconecta");
    sseClose();
    g_sseRetryAt = now + 1000;
    return;
  }
  int n = 0;
  while (g_stream->available() && n < 512)
  {
    char c = (char)g_stream->read();
    g_sseLastByteMs = now;
    n++;
    if (c == '\n')
    {
      sseHandleLine(g_sseLine);
      g_sseLine = "";
    }
    else
    {
      g_sseLine += c;
      if (g_sseLine.length() > 12000)
      {
        Serial.println("coletor SSE: linha enorme, descarta");
        sseClose();
        g_sseRetryAt = now + 2000;
        return;
      }
    }
  }
}

void usageClientFetch()
{
  updateNetLine();
  refreshPanelUrl();
  Serial.println("coletor: GET /usage (refresh)");
  if (WiFi.status() != WL_CONNECTED)
  {
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
  if (!http.begin(USAGE_URL))
  {
    Serial.printf("coletor: http.begin falhou URL=%s\n", USAGE_URL);
    g_snap.statusLine = "URL";
    markAllAccountsFailed("USAGE_URL");
    usageClientLogSnapshot("url");
    g_lastFetchMs = millis();
    uiRefreshData();
    return;
  }

  http.addHeader("X-Vigia-Device", "esp32");
  http.addHeader("X-Vigia-Screen", String(tft.width()) + "x" + String(tft.height()));
  int code = http.GET();
  Serial.printf("coletor GET %s -> HTTP %d\n", USAGE_URL, code);
  if (code != 200)
  {
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
  if (g_snap.httpOk)
  {
    g_hasFetchedOk = true;
    g_lastFetchOkMs = millis();
  }
  usageClientLogSnapshot(g_snap.httpOk ? "ok" : "parse");
  g_lastFetchMs = millis();
  uiRefreshData();
}

void usageClientEnsureWifi()
{
  updateNetLine();
  if (WiFi.status() == WL_CONNECTED)
  {
    if (!g_wifiLogged)
    {
      Serial.printf("Wi-Fi conectado ip=%s rssi=%d dBm\n", WiFi.localIP().toString().c_str(),
                    WiFi.RSSI());
      g_wifiLogged = true;
      refreshPanelUrl();
    }
    return;
  }
  g_wifiLogged = false;
  uint32_t now = millis();
  if (!g_wifiOnce)
  {
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
  if (now - g_wifiRetryMs > 15000)
  {
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

// GET <coletor>/api/theme/background — stream direto pro storage do tema
// (LittleFS ou RAM, ver ui/customtheme.h), nunca bufferiza a imagem inteira.
static bool themeClientFetchBackground(const String &base)
{
  HTTPClient http;
  // setTimeout() vira o timeout do WiFiClient usado por readBytes() abaixo —
  // cada chamada espera até esse tanto por *algum* byte, não é um prazo
  // único pra transferência inteira (~150-300 KB podem vir em várias
  // rajadas na rede simulada do Wokwi).
  http.setTimeout(20000);
  http.setConnectTimeout(5000);
  if (!http.begin(base + "api/theme/background"))
  {
    return false;
  }
  int code = http.GET();
  bool ok = false;
  if (code == 200)
  {
    int len = http.getSize();
    WiFiClient *stream = http.getStreamPtr();
    Serial.printf("tema: baixando fundo (%d bytes)\n", len);
    if (len > 0 && customThemeBeginBackgroundWrite())
    {
      uint8_t buf[1024];
      int remaining = len;
      ok = true;
      while (remaining > 0)
      {
        int want = remaining < (int)sizeof(buf) ? remaining : (int)sizeof(buf);
        int n = stream->readBytes(buf, want);
        if (n <= 0)
        {
          Serial.printf("tema: leitura do fundo parou em %d/%d bytes\n", len - remaining, len);
          ok = false;
          break;
        }
        if (!customThemeWriteBackgroundChunk(buf, n))
        {
          Serial.println("tema: gravação do fundo falhou (RAM/LittleFS cheios?)");
          ok = false;
          break;
        }
        remaining -= n;
      }
      customThemeEndBackgroundWrite(ok);
      Serial.println(ok ? "tema: fundo baixado" : "tema: download do fundo falhou");
    }
    else if (len <= 0)
    {
      Serial.println("tema: coletor não informou o tamanho do fundo (sem Content-Length?)");
    }
    else
    {
      Serial.println("tema: sem storage (RAM/LittleFS) pro fundo");
    }
  }
  else if (code != 404)
  {
    Serial.printf("tema: GET /api/theme/background -> HTTP %d\n", code);
  }
  http.end();
  return ok;
}

// Slideshow: polling periódico do índice do fundo.
// O coletor decide o índice via tempo (intervalo em minutos) — a placa só
// precisa verificar se o índice mudou e, se sim, baixar o novo fundo.
static int g_slideshowLastIndex = -1;
static uint32_t g_slideshowLastPollMs = 0;
static bool g_slideshowActive = false;

bool themeClientSlideshowActive() { return g_slideshowActive; }

void themeClientPollSlideshow()
{
  if (!customThemeActive())
    return;
  if (WiFi.status() != WL_CONNECTED)
    return;
  uint32_t now = millis();
  // Poll a cada 30s (não precisa ser preciso ao minuto; o coletor já
  // calcula o índice por tempo absoluto)
  if (now - g_slideshowLastPollMs < 30000 && g_slideshowLastIndex != -1)
    return;
  g_slideshowLastPollMs = now;

  String base = originWithSlash(USAGE_URL);
  if (!base.length())
    return;
  HTTPClient http;
  http.setTimeout(5000);
  http.setConnectTimeout(3000);
  if (!http.begin(base + "api/theme/background/index"))
  {
    return;
  }
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
    return;
  bool enabled = doc["enabled"] | false;
  g_slideshowActive = enabled;
  if (!enabled)
  {
    g_slideshowLastIndex = -1;
    return;
  }
  int idx = doc["index"] | 0;
  int count = doc["count"] | 0;
  if (count <= 1)
    return; // nada para rotacionar
  if (g_slideshowLastIndex == -1)
  {
    g_slideshowLastIndex = idx;
    return; // primeira leitura, não recarrega
  }
  if (idx != g_slideshowLastIndex)
  {
    Serial.printf("slideshow: índice %d -> %d, baixando novo fundo\n", g_slideshowLastIndex, idx);
    g_slideshowLastIndex = idx;
    if (themeClientFetchBackground(base))
    {
      if (customThemeActive() && g_view == VIEW_THEME)
      {
        paintCustomHome();
      }
      Serial.println("slideshow: fundo atualizado");
    }
  }
}

// Botão de recarregar no header (ui/nav.cpp) — puxa o tema que o painel
// salvou no coletor (POST /api/theme/meta feito por
// frontend/.../ThemeEditorPage.tsx) e aplica via ui/customtheme.h. Não é
// automático: só quando o usuário toca o ícone.
void themeClientReload()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("tema: sem Wi-Fi, aborta recarregar");
    return;
  }
  String base = originWithSlash(USAGE_URL);
  if (!base.length())
  {
    Serial.println("tema: USAGE_URL sem origem válida, aborta recarregar");
    return;
  }
  HTTPClient http;
  http.setTimeout(8000);
  http.setConnectTimeout(5000);
  if (!http.begin(base + "api/theme"))
  {
    Serial.println("tema: GET /api/theme http.begin falhou");
    return;
  }
  int code = http.GET();
  if (code != 200)
  {
    Serial.printf("tema: GET /api/theme -> HTTP %d\n", code);
    http.end();
    return;
  }
  String body = http.getString();
  http.end();
  JsonDocument doc;
  if (deserializeJson(doc, body))
  {
    Serial.println("tema: resposta do coletor inválida");
    return;
  }
  if (!(doc["active"] | false))
  {
    Serial.println("tema: coletor sem tema salvo");
    return;
  }
  if (doc["has_background"] | false)
  {
    if (!themeClientFetchBackground(base))
    {
      Serial.println("tema: falha ao baixar a imagem de fundo, segue só com o resto");
    }
  }
  String themeJson = jsonText(doc["theme"]);
  if (!themeJson.length() || !customThemeApplyMeta(themeJson))
  {
    Serial.println("tema: JSON do coletor inválido");
    return;
  }
  Serial.println("tema: recarregado do coletor");
}
