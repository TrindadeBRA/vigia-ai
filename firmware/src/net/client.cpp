#include "net/usage_client.h"

#include "net/parse.h"
#include "version.h"
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
  // Quem manda no contador e o intervalo do coletor (USAGE_POLL_MS e so o
  // default de compilacao): com um coletor configurado em USAGE_INTERVAL_S
  // maior, o selo zerava e ficava parado esperando o evento seguinte.
  int interval = doc["interval_s"] | 0;
  if (interval > 0 && interval <= 3600)
  {
    uint32_t ms = (uint32_t)interval * 1000UL;
    if (ms != g_pollMs)
    {
      Serial.printf("coletor: intervalo do contador %ds\n", interval);
      g_pollMs = ms;
    }
  }
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
static bool g_ssePaused = false;
static String g_sseLine;
static String g_sseData;
static String g_sseEvent;
// A linha corrente e um "data:" e esta sendo escrita direto em g_sseData, sem
// passar por g_sseLine (ver sseAbsorb) — o payload de /usage ja passa de
// 20 KB e uma copia extra dele nao cabe no heap.
static bool g_sseInData = false;
static bool g_sseDataSkipSpace = false;
// Faltou heap no meio do evento: g_sseData esta truncado e o evento inteiro
// precisa ser descartado (nunca parsear pela metade).
static bool g_sseOom = false;
static bool g_pendingThemeReload = false;
static uint32_t g_lastThemeReloadMs = 0;
static uint32_t g_sseLastByteMs = 0;
static uint32_t g_sseLastEventMs = 0;
static uint32_t g_sseRetryAt = 0;
static uint32_t g_sseRetryWait = 2000;

#ifndef USAGE_POLL_MS
#define USAGE_POLL_MS 60000
#endif
#ifndef SSE_IDLE_MS
#define SSE_IDLE_MS (USAGE_POLL_MS + 30000)
#endif
// Watchdog do *evento*, nao do byte: o keep-alive do coletor (": ping" a cada
// 15 s) mantem g_sseLastByteMs sempre fresco, entao um socket vivo que parou
// de render evento completo nunca caia no SSE_IDLE_MS acima — era assim que a
// placa ficava com o contador travado em zero ate um refresh manual.
#ifndef SSE_EVENT_IDLE_MS
#define SSE_EVENT_IDLE_MS (USAGE_POLL_MS * 2 + 30000)
#endif
// Teto do payload de um evento. A String do Arduino nao guarda mais que
// 65535 bytes sem PSRAM (CAPACITY_MAX), entao o limite util fica bem abaixo.
#ifndef SSE_DATA_MAX
#define SSE_DATA_MAX 48000
#endif
// Cresce os buffers em blocos: a String realoca de 16 em 16 bytes, entao
// montar 22 KB byte-a-byte custava ~1400 reallocs (memcpy O(n^2)) e picotava
// o heap ate uma delas falhar em silencio.
#define SSE_GROW 2048
// Reserva do buffer do evento, feita na abertura do stream (heap menos
// fragmentado) — evita crescer/devolver 20+ KB a cada evento.
#ifndef SSE_DATA_RESERVE
#define SSE_DATA_RESERVE 24576
#endif
// Bytes drenados do socket por volta do loop(). Com 512 (valor antigo) um
// evento de 22 KB precisava de ~45 voltas so pra entrar.
#ifndef SSE_READ_BUDGET
#define SSE_READ_BUDGET 4096
#endif
// +1 porque String::concat(ptr, n) copia n+1 bytes (leva o terminador junto).
#define SSE_CHUNK 256

// Devolve o buffer ao heap de verdade — `s = ""` so zera o tamanho, a
// capacidade continua alocada.
static void sseFreeString(String &s)
{
  s = String();
}

// reserve() ja e no-op quando a capacidade atual da conta, entao pedir
// sempre o proximo multiplo de SSE_GROW da o crescimento amortizado sem
// precisar consultar capacity() (protegido na String do Arduino).
static bool sseGrow(String &s, size_t extra)
{
  const size_t need = s.length() + extra;
  const size_t want = ((need / SSE_GROW) + 1) * SSE_GROW;
  if (s.reserve(want))
  {
    return true;
  }
  return s.reserve(need);
}

// Concat que NAO falha em silencio: a String do Arduino devolve a string
// vazia/inalterada quando o realloc nao cabe, e era isso que fazia o evento
// sumir sem nenhum log.
static bool sseAppend(String &s, const char *p, size_t n)
{
  if (!n)
  {
    return true;
  }
  const size_t before = s.length();
  if (!sseGrow(s, n) || !s.concat(p, (unsigned int)n) || s.length() != before + n)
  {
    return false;
  }
  return true;
}

static void sseMarkOom(const char *what, size_t want)
{
  if (!g_sseOom)
  {
    Serial.printf("coletor SSE: sem heap pro %s (+%u bytes) — livre=%u maior_bloco=%u\n", what,
                  (unsigned)want, (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getMaxAllocHeap());
  }
  g_sseOom = true;
}

static void sseClose()
{
  g_stream = nullptr;
  if (g_sseOpen)
  {
    g_http.end();
    g_sseOpen = false;
  }
  sseFreeString(g_sseLine);
  sseFreeString(g_sseData);
  g_sseEvent = "";
  g_sseInData = false;
  g_sseDataSkipSpace = false;
  g_sseOom = false;
}

void usageClientPauseSse()
{
  if (g_ssePaused)
  {
    sseClose();
    return;
  }
  g_ssePaused = true;
  sseClose();
  Serial.println("coletor SSE: pausado (camera)");
}

void usageClientResumeSse()
{
  if (!g_ssePaused)
  {
    return;
  }
  g_ssePaused = false;
  g_sseRetryAt = 0;
  g_sseRetryWait = 2000;
  Serial.println("coletor SSE: retomado");
}

// Fim de linha: so as linhas curtas (":comentario", "event:") chegam aqui com
// conteudo — o corpo de um "data:" ja foi direto pro g_sseData.
static void sseHandleLine(String &line)
{
  if (line.endsWith("\r"))
  {
    line.remove(line.length() - 1);
  }
  if (line.length() == 0)
  {
    if (g_sseOom)
    {
      Serial.printf("coletor SSE: evento descartado por falta de heap (%d bytes lidos)\n",
                    g_sseData.length());
      sseFreeString(g_sseData);
      g_sseEvent = "";
      g_sseOom = false;
      // Fecha pra soltar tudo e voltar limpo em vez de arrastar um heap
      // picotado por horas.
      sseClose();
      g_sseRetryAt = millis() + 2000;
      return;
    }
    if (g_sseData.length())
    {
      if (g_sseEvent == "theme")
      {
        Serial.printf("coletor SSE: evento theme %d bytes\n", g_sseData.length());
        g_pendingThemeReload = true;
      }
      else
      {
        Serial.printf("coletor SSE: %d bytes (heap livre=%u)\n", g_sseData.length(),
                      (unsigned)ESP.getFreeHeap());
        g_snap.httpOk = parseUsageJson(g_sseData);
        if (g_snap.httpOk)
        {
          g_hasFetchedOk = true;
          g_lastFetchOkMs = millis();
        }
        usageClientLogSnapshot(g_snap.httpOk ? "sse-ok" : "sse-parse");
        g_lastFetchMs = millis();
        uiRefreshData();
      }
      g_sseLastEventMs = millis();
      // Mantem a capacidade reservada (bloco estavel, sem realocar a cada
      // evento) e so zera o conteudo.
      g_sseData = "";
      g_sseEvent = "";
    }
    else if (g_sseEvent.length())
    {
      // evento sem data (ex.: theme sem payload) — ainda dispara reload
      if (g_sseEvent == "theme")
      {
        Serial.println("coletor SSE: evento theme (sem data)");
        g_pendingThemeReload = true;
      }
      g_sseLastEventMs = millis();
      g_sseEvent = "";
    }
    return;
  }
  if (line[0] == ':')
  {
    return;
  }
  if (line.startsWith("event:"))
  {
    String ev = line.substring(6);
    ev.trim();
    g_sseEvent = ev;
    return;
  }
  // "data:" nao passa por aqui (ver sseAbsorb); qualquer outro campo do
  // protocolo (id:, retry:) o firmware ignora.
}

// Acumula um pedaco da linha corrente. Enquanto nao da pra saber se a linha e
// um "data:", vai pro g_sseLine (curto); assim que o prefixo fecha, o resto
// dela e tudo o que vier depois cai direto no g_sseData e o g_sseLine e
// devolvido ao heap na hora.
static bool sseAbsorb(const char *p, size_t n)
{
  if (g_sseInData)
  {
    if (g_sseDataSkipSpace && n && p[0] == ' ')
    {
      p++;
      n--;
      g_sseDataSkipSpace = false;
    }
    if (!n)
    {
      return true;
    }
    g_sseDataSkipSpace = false;
    if (g_sseOom)
    {
      return true; // ja perdido: consome sem alocar ate o fim do evento
    }
    if (g_sseData.length() + n > SSE_DATA_MAX)
    {
      Serial.printf("coletor SSE: payload passou de %d bytes, descarta\n", (int)SSE_DATA_MAX);
      sseMarkOom("payload", n);
      return true;
    }
    if (!sseAppend(g_sseData, p, n))
    {
      sseMarkOom("payload", n);
    }
    return true;
  }
  if (!sseAppend(g_sseLine, p, n))
  {
    sseMarkOom("cabecalho", n);
    return true;
  }
  if (g_sseLine.length() >= 5 && g_sseLine.startsWith("data:"))
  {
    const char *rest = g_sseLine.c_str() + 5;
    size_t restLen = g_sseLine.length() - 5;
    g_sseInData = true;
    g_sseDataSkipSpace = true;
    // Cada linha "data:" vira uma linha do payload (contrato do SSE).
    bool ok = g_sseData.length() ? sseAppend(g_sseData, "\n", 1) : true;
    if (ok && restLen)
    {
      if (rest[0] == ' ')
      {
        rest++;
        restLen--;
      }
      g_sseDataSkipSpace = false;
      ok = restLen ? sseAppend(g_sseData, rest, restLen) : true;
    }
    // Solta o buffer curto ANTES do payload crescer: era ele (uma copia
    // inteira do JSON) que estourava o heap junto com g_sseData e o
    // JsonDocument do parse.
    sseFreeString(g_sseLine);
    if (!ok)
    {
      sseMarkOom("payload", restLen);
    }
    return true;
  }
  if (g_sseLine.length() > SSE_GROW)
  {
    Serial.println("coletor SSE: linha de cabecalho enorme, descarta");
    sseFreeString(g_sseLine);
    sseMarkOom("cabecalho", 0);
  }
  return true;
}

static void sseFeed(const char *buf, size_t n)
{
  size_t i = 0;
  while (i < n)
  {
    const char *nl = (const char *)memchr(buf + i, '\n', n - i);
    const size_t chunk = nl ? (size_t)(nl - (buf + i)) : (n - i);
    if (chunk)
    {
      sseAbsorb(buf + i, chunk);
      i += chunk;
    }
    if (!nl)
    {
      return;
    }
    i++; // pula o \n
    if (g_sseInData)
    {
      // O corpo do "data:" ja esta em g_sseData; so fecha o modo e tira o \r
      // do CRLF, se veio.
      g_sseInData = false;
      g_sseDataSkipSpace = false;
      if (g_sseData.length() && g_sseData.charAt(g_sseData.length() - 1) == '\r')
      {
        g_sseData.remove(g_sseData.length() - 1);
      }
      continue;
    }
    sseHandleLine(g_sseLine);
    if (!g_sseOpen)
    {
      return; // sseHandleLine fechou (descarte por heap)
    }
    g_sseLine = "";
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
  g_http.addHeader("X-Vigia-Firmware", FIRMWARE_VERSION);
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
  g_sseLastEventMs = millis();
  g_sseRetryWait = 2000;
  // Pega o bloco do payload agora, com o heap ainda inteiro.
  if (!g_sseData.reserve(SSE_DATA_RESERVE))
  {
    Serial.printf("coletor SSE: reserva de %d bytes falhou — livre=%u maior_bloco=%u\n",
                  (int)SSE_DATA_RESERVE, (unsigned)ESP.getFreeHeap(),
                  (unsigned)ESP.getMaxAllocHeap());
  }
}

void usageClientPoll()
{
  if (g_ssePaused)
  {
    return;
  }
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
  if (now - g_sseLastEventMs > SSE_EVENT_IDLE_MS)
  {
    Serial.printf("coletor SSE: %lus sem evento completo (socket vivo), reconecta\n",
                  (unsigned long)((now - g_sseLastEventMs) / 1000));
    sseClose();
    g_sseRetryAt = now + 1000;
    return;
  }
  char buf[SSE_CHUNK + 1];
  int budget = SSE_READ_BUDGET;
  while (budget > 0)
  {
    int avail = g_stream->available();
    if (avail <= 0)
    {
      break;
    }
    int want = avail < SSE_CHUNK ? avail : SSE_CHUNK;
    if (want > budget)
    {
      want = budget;
    }
    int n = g_stream->read((uint8_t *)buf, (size_t)want);
    if (n <= 0)
    {
      break;
    }
    buf[n] = 0; // String::concat(ptr, n) le n+1 bytes
    budget -= n;
    g_sseLastByteMs = millis();
    sseFeed(buf, (size_t)n);
    if (!g_sseOpen)
    {
      return;
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
  http.addHeader("X-Vigia-Firmware", FIRMWARE_VERSION);
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

static void addVigiaDeviceHeaders(HTTPClient &http)
{
  http.addHeader("X-Vigia-Device", "esp32");
  http.addHeader("X-Vigia-Screen", String(tft.width()) + "x" + String(tft.height()));
  http.addHeader("X-Vigia-Firmware", FIRMWARE_VERSION);
}

// GET <coletor>/api/theme/background — stream direto pro storage do tema
// (LittleFS ou RAM, ver ui/customtheme.h), nunca bufferiza a imagem inteira.
// Manda a resolução da tela (e ?w=&h= na metade) pra o coletor devolver o RAW
// certo: 240×160 no hardware, 160×120 no Wokwi.
static bool themeClientFetchBackground(const String &base)
{
  HTTPClient http;
  // setTimeout() vira o timeout do WiFiClient usado por readBytes() abaixo —
  // cada chamada espera até esse tanto por *algum* byte, não é um prazo
  // único pra transferência inteira (~150-300 KB podem vir em várias
  // rajadas na rede simulada do Wokwi).
  http.setTimeout(20000);
  http.setConnectTimeout(5000);
  const int w = customThemeCanvasWidth();
  const int h = customThemeCanvasHeight();
  const int expected = w * h * 2;
  String url = base + "api/theme/background?w=" + String(w) + "&h=" + String(h);
  if (!http.begin(url))
  {
    return false;
  }
  addVigiaDeviceHeaders(http);
  int code = http.GET();
  bool ok = false;
  if (code == 200)
  {
    int len = http.getSize();
    WiFiClient *stream = http.getStreamPtr();
    Serial.printf("tema: baixando fundo (%d bytes, esperado %d)\n", len, expected);
    if (len != expected)
    {
      Serial.printf("tema: tamanho do fundo não bate com a tela (%dx%d)\n", w, h);
    }
    else if (len > 0 && customThemeBeginBackgroundWrite())
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

static bool themeClientFetchAnim(const String &base)
{
  HTTPClient http;
  http.setTimeout(20000);
  http.setConnectTimeout(5000);
  const int w = customThemeCanvasAnimWidth();
  const int h = customThemeCanvasAnimHeight();
  const int frameBytes = (int)customThemeAnimFrameBytes();
  int expected = (int)customThemeAnimExpectedBytes();
  if (expected <= 0 || frameBytes <= 0)
  {
    Serial.println("tema: theme.json GIF sem tamanho de animação esperado");
    return false;
  }
  String url = base + "api/theme/background/anim?w=" + String(w) + "&h=" + String(h);
  if (!http.begin(url))
  {
    return false;
  }
  addVigiaDeviceHeaders(http);
  int code = http.GET();
  bool ok = false;
  if (code == 200)
  {
    int len = http.getSize();
    WiFiClient *stream = http.getStreamPtr();
    Serial.printf("tema: baixando animação (%d bytes, esperado %d)\n", len, expected);
    // theme.json pode ter frame_count 12 (default do editor) e o RAW ter
    // menos frames — ou o Fastify mandar chunked (getSize() == -1). Sem isso
    // a placa descarta o GIF e cai no 1º frame estático.
    if (len > 0 && (len % frameBytes) == 0)
    {
      const int frames = len / frameBytes;
      if (frames >= 2 && frames <= 12 && frames * frameBytes != expected)
      {
        Serial.printf("tema: frame_count json=%d arquivo=%d, usa o arquivo\n", expected / frameBytes, frames);
        customThemeSetGifFrameCount(frames);
        expected = (int)customThemeAnimExpectedBytes();
      }
    }
    if (len < 0)
    {
      len = expected;
    }
    if (len != expected)
    {
      Serial.printf("tema: tamanho da animação não bate (%dx%d, frames no json)\n", w, h);
    }
    else if (len > 0 && customThemeBeginAnimWrite())
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
          Serial.printf("tema: leitura da animação parou em %d/%d bytes\n", len - remaining, len);
          ok = false;
          break;
        }
        if (!customThemeWriteAnimChunk(buf, n))
        {
          Serial.println("tema: gravação da animação falhou (RAM/LittleFS cheios?)");
          ok = false;
          break;
        }
        remaining -= n;
      }
      customThemeEndAnimWrite(ok);
      Serial.println(ok ? "tema: animação baixada" : "tema: download da animação falhou");
    }
    else if (len <= 0)
    {
      Serial.println("tema: coletor não informou o tamanho da animação (sem Content-Length?)");
    }
    else
    {
      Serial.println("tema: sem storage (RAM/LittleFS) pra animação");
    }
  }
  else if (code != 404)
  {
    Serial.printf("tema: GET /api/theme/background/anim -> HTTP %d\n", code);
  }
  http.end();
  return ok;
}

// Auto-refresh do tema via SSE (backend envia `event: theme` ao salvar
// em /api/theme/meta ou trocar o wallpaper). Enquanto a VIEW_THEME
// estiver visível o firmware recarrega sozinho; fora dela o evento é
// ignorado (o tema já será baixado quando o usuário entrar na view).
void themeClientTick()
{
  if (g_ssePaused)
  {
    g_pendingThemeReload = false;
    return;
  }
  if (g_pendingThemeReload)
  {
    if (g_view != VIEW_THEME)
    {
      // Se não está na VIEW_THEME, só limpa o flag — sem poll de
      // fallback pra recuperar esse update perdido (decisão consciente:
      // evita trocar de tela sozinho, o que seria disruptivo). O tema só
      // sincroniza de novo no próximo `event: theme` recebido com a
      // VIEW_THEME já aberta.
      g_pendingThemeReload = false;
      return;
    }
    uint32_t now = millis();
    // debounce 1.5s — vários saves rápidos no editor geram um único reload
    if (now - g_lastThemeReloadMs < 1500)
    {
      return;
    }
    g_pendingThemeReload = false;
    g_lastThemeReloadMs = now;
    if (WiFi.status() != WL_CONNECTED)
    {
      Serial.println("tema: SSE pediu reload mas sem Wi-Fi, adiando");
      g_pendingThemeReload = true;
      return;
    }
    Serial.println("tema: auto-reload via SSE");
    themeClientReload();
    return;
  }
  // Sem fallback periódico: só recarrega quando o backend envia
  // `event: theme` (após POST /api/theme/meta no clique em Salvar).
  // Isso evita que ajustes de background no editor disparem reload
  // antes do usuário confirmar.
}

// Botão de recarregar no header (ui/nav.cpp) — puxa o tema que o painel
// salvou no coletor (POST /api/theme/meta feito por
// frontend/.../ThemeEditorPage.tsx) e aplica via ui/customtheme.h. Também
// usado pelo auto-refresh via SSE (themeClientTick).
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
  addVigiaDeviceHeaders(http);
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
  String themeJson = jsonText(doc["theme"]);
  bool gif = false;
  if (themeJson.length())
  {
    JsonDocument themeDoc;
    if (!deserializeJson(themeDoc, themeJson))
    {
      gif = jsonText(themeDoc["background"]["type"]) == "gif";
    }
  }
  if (gif)
  {
    if (!themeJson.length() || !customThemeApplyMeta(themeJson))
    {
      Serial.println("tema: JSON do coletor inválido");
      return;
    }
    if (!themeClientFetchAnim(base))
    {
      Serial.println("tema: falha ao baixar a animação, tenta fundo estático");
      if (doc["has_background"] | false)
      {
        themeClientFetchBackground(base);
      }
    }
    customThemeInvalidateBackground();
    uiPaint();
    Serial.println("tema: recarregado do coletor (gif)");
    return;
  }
  if (doc["has_background"] | false)
  {
    if (!themeClientFetchBackground(base))
    {
      Serial.println("tema: falha ao baixar a imagem de fundo, segue só com o resto");
    }
  }
  if (!themeJson.length() || !customThemeApplyMeta(themeJson))
  {
    Serial.println("tema: JSON do coletor inválido");
    return;
  }
  Serial.println("tema: recarregado do coletor");
}
