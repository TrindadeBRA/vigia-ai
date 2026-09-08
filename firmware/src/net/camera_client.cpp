#include "net/camera_client.h"

#include "core/state.h"
#include "net/parse.h"
#include "ui/ui.h"
#include "version.h"

#ifdef WOKWI_SIM
#define USAGE_URL "http://host.wokwi.internal:8787/usage"
#else
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define USAGE_URL "http://192.168.1.10:8787/usage"
#endif
#endif

#include <HTTPClient.h>
#include <TJpg_Decoder.h>
#include <WiFi.h>

#include <ArduinoJson.h>
#include <cstdio>
#include <cstring>
#include <esp_task_wdt.h>

namespace
{

CameraListItem g_cameras[MAX_CAMERAS];
int g_count = 0;
int g_selected = 0;
bool g_ptzHeld = false;
uint32_t g_lastListMs = 0;
uint32_t g_nextListMs = 0;
bool g_wantLive = false;
uint32_t g_liveStartAt = 0;

String apiBase()
{
  String u = USAGE_URL;
  if (u.endsWith("/usage"))
  {
    u.remove(u.length() - 6);
  }
  if (!u.endsWith("/"))
  {
    u += "/";
  }
  return u;
}

void addDeviceHeaders(HTTPClient &http)
{
  http.addHeader("X-Vigia-Device", "esp32");
  http.addHeader("X-Vigia-Screen", String(tft.width()) + "x" + String(tft.height()));
  http.addHeader("X-Vigia-Firmware", FIRMWARE_VERSION);
}

int g_jpgOffX = 0;
int g_jpgOffY = 0;
int g_jpgScale = 2;

int streamReqW()
{
  int w = tft.width() / 2;
  if (w & 1)
  {
    w--;
  }
  return w < 80 ? tft.width() : w;
}

int streamReqH()
{
  int h = tft.height() / 2;
  if (h & 1)
  {
    h--;
  }
  return h < 80 ? tft.height() : h;
}

struct OverlayHole
{
  int16_t x, y, w, h;
};
constexpr int kMaxHoles = 9;
OverlayHole g_holes[kMaxHoles];
int g_holeCount = 0;

bool tileHitsHole(int dx, int dy, int w, int h)
{
  for (int i = 0; i < g_holeCount; i++)
  {
    const OverlayHole &r = g_holes[i];
    if (dx < r.x + r.w && dx + w > r.x && dy < r.y + r.h && dy + h > r.y)
    {
      return true;
    }
  }
  return false;
}

void pushTile(int x, int y, int w, int h, uint16_t *bitmap)
{
  const int s = g_jpgScale < 1 ? 1 : g_jpgScale;
  const int dx = g_jpgOffX + x * s;
  const int dy = g_jpgOffY + y * s;
  const int dw = w * s;
  const int dh = h * s;
  const int scrW = tft.width();
  const int scrH = tft.height();
  if (w <= 0 || h <= 0 || dw <= 0 || dh <= 0)
  {
    return;
  }
  if (dx >= scrW || dy >= scrH || dx + dw <= 0 || dy + dh <= 0)
  {
    return;
  }
  if (tileHitsHole(dx, dy, dw, dh))
  {
    return;
  }
  if (dx < 0 || dy < 0 || dx + dw > scrW || dy + dh > scrH)
  {
    return;
  }
  if (s == 1)
  {
    tft.pushImage(dx, dy, w, h, bitmap);
    return;
  }
  if (w * 2 > 64)
  {
    return;
  }
  uint16_t line[64];
  for (int row = 0; row < h; row++)
  {
    int n = 0;
    const uint16_t *src = bitmap + row * w;
    for (int col = 0; col < w; col++)
    {
      const uint16_t p = src[col];
      line[n++] = p;
      line[n++] = p;
    }
    const int sy = dy + row * 2;
    tft.pushImage(dx, sy, dw, 1, line);
    tft.pushImage(dx, sy + 1, dw, 1, line);
  }
}

bool jpgOutput(int16_t x, int16_t y, uint16_t w, uint16_t h, uint16_t *bitmap)
{
  esp_task_wdt_reset();
  if (w == 0 || h == 0 || !bitmap)
  {
    return true;
  }
  pushTile(x, y, (int)w, (int)h, bitmap);
  return true;
}

bool drawJpegFullscreen(const uint8_t *buf, int nread)
{
  if (!buf || nread < 16)
  {
    return false;
  }
  TJpgDec.setSwapBytes(true);
  TJpgDec.setCallback(jpgOutput);
  const int scrW = tft.width();
  const int scrH = tft.height();
  if (nread > 20000)
  {
    TJpgDec.setJpgScale(2);
  }
  else
  {
    TJpgDec.setJpgScale(1);
  }
  const int rw = streamReqW();
  const int rh = streamReqH();
  g_jpgScale = (rw * 2 <= scrW && rh * 2 <= scrH) ? 2 : 1;
  g_jpgOffX = (scrW - rw * g_jpgScale) / 2;
  g_jpgOffY = (scrH - rh * g_jpgScale) / 2;
  const bool ok = TJpgDec.drawJpg(0, 0, buf, (uint32_t)nread) == 0;
  yield();
  return ok;
}

constexpr int kJpegTry[] = {16 * 1024, 12 * 1024, 8 * 1024};
uint8_t *g_bufs[2] = {nullptr, nullptr};
int g_lens[2] = {0, 0};
int g_jpegCap = 0;
int g_bufCount = 0;
volatile int g_ready = -1;
volatile int g_busy = -1;
int g_fill = 0;
volatile bool g_streamStop = false;
volatile bool g_streamKick = false;
volatile bool g_fitCover = true;
char g_streamErr[64] = "";
char g_streamCamId[16] = "";

void setStreamErr(const char *msg)
{
  strncpy(g_streamErr, msg ? msg : "", sizeof(g_streamErr) - 1);
  g_streamErr[sizeof(g_streamErr) - 1] = 0;
}

bool parseCollector(String &host, uint16_t &port)
{
  String u = USAGE_URL;
  int scheme = u.indexOf("://");
  if (scheme >= 0)
  {
    u = u.substring(scheme + 3);
  }
  int slash = u.indexOf('/');
  if (slash >= 0)
  {
    u = u.substring(0, slash);
  }
  int colon = u.indexOf(':');
  if (colon < 0)
  {
    host = u;
    port = 80;
    return host.length() > 0;
  }
  host = u.substring(0, colon);
  port = (uint16_t)u.substring(colon + 1).toInt();
  if (port == 0)
  {
    port = 80;
  }
  return host.length() > 0;
}

bool allocJpegBufs()
{
  if (g_bufs[0] && g_jpegCap > 0 && g_bufCount > 0)
  {
    return true;
  }
  for (int i = 0; i < 2; i++)
  {
    free(g_bufs[i]);
    g_bufs[i] = nullptr;
  }
  g_jpegCap = 0;
  g_bufCount = 0;
  for (int t = 0; t < (int)(sizeof(kJpegTry) / sizeof(kJpegTry[0])); t++)
  {
    const int cap = kJpegTry[t];
    g_bufs[0] = (uint8_t *)malloc((size_t)cap);
    if (!g_bufs[0])
    {
      continue;
    }
    g_bufs[1] = (uint8_t *)malloc((size_t)cap);
    g_jpegCap = cap;
    g_bufCount = g_bufs[1] ? 2 : 1;
    Serial.printf("[camera] jpeg RAM %d x %d KB (heap %u)\n", g_bufCount, cap / 1024,
                  (unsigned)ESP.getFreeHeap());
    return true;
  }
  return false;
}

int pickFillSlot()
{
  int slot = g_fill;
  if (g_bufCount > 1 && slot == g_busy)
  {
    slot ^= 1;
  }
  if (slot == g_busy || !g_bufs[slot])
  {
    return -1;
  }
  return slot;
}

enum LivePhase
{
  LIVE_IDLE,
  LIVE_HDR,
  LIVE_BODY,
  LIVE_WAIT
};

WiFiClient g_live;
LivePhase g_livePhase = LIVE_IDLE;
char g_liveHdr[384];
int g_liveHdrLen = 0;
uint32_t g_livePhaseAt = 0;
int g_slot = -1;
int g_accLen = 0;
bool g_inJpeg = false;
bool g_drop = false;
bool g_pendingFf = false;
uint8_t g_prev = 0;

void liveResetParser()
{
  g_slot = -1;
  g_accLen = 0;
  g_inJpeg = false;
  g_drop = false;
  g_pendingFf = false;
  g_prev = 0;
}

void liveDisconnect(uint32_t retryMs)
{
  g_live.stop();
  g_liveHdrLen = 0;
  g_liveHdr[0] = 0;
  liveResetParser();
  g_livePhase = LIVE_WAIT;
  g_livePhaseAt = millis() + retryMs;
}

void liveIngest(const uint8_t *tmp, int n)
{
  for (int i = 0; i < n; i++)
  {
    uint8_t b = tmp[i];
    if (!g_inJpeg)
    {
      if (g_pendingFf && b == 0xd8)
      {
        g_pendingFf = false;
        g_slot = pickFillSlot();
        g_drop = g_slot < 0;
        g_inJpeg = true;
        g_prev = 0xd8;
        if (!g_drop)
        {
          g_bufs[g_slot][0] = 0xff;
          g_bufs[g_slot][1] = 0xd8;
          g_accLen = 2;
        }
        continue;
      }
      g_pendingFf = (b == 0xff);
      continue;
    }
    if (g_drop)
    {
      if (g_prev == 0xff && b == 0xd9)
      {
        g_inJpeg = false;
        g_drop = false;
      }
      g_prev = b;
      continue;
    }
    if (g_accLen >= g_jpegCap)
    {
      g_drop = true;
      g_prev = b;
      continue;
    }
    g_bufs[g_slot][g_accLen++] = b;
    if (g_accLen >= 4 && g_bufs[g_slot][g_accLen - 2] == 0xff && g_bufs[g_slot][g_accLen - 1] == 0xd9)
    {
      g_lens[g_slot] = g_accLen;
      g_ready = g_slot;
      if (g_bufCount > 1)
      {
        g_fill = g_slot ^ 1;
      }
      g_inJpeg = false;
      g_accLen = 0;
      g_slot = -1;
    }
  }
}

void livePump()
{
  if (g_streamKick)
  {
    g_streamKick = false;
    liveDisconnect(80);
  }

  if (g_livePhase == LIVE_WAIT)
  {
    if (millis() < g_livePhaseAt)
    {
      return;
    }
    g_livePhase = LIVE_IDLE;
  }

  if (g_livePhase == LIVE_IDLE)
  {
    if (WiFi.status() != WL_CONNECTED || !g_streamCamId[0])
    {
      setStreamErr("sem Wi-Fi");
      liveDisconnect(400);
      return;
    }
    String host;
    uint16_t port = 80;
    if (!parseCollector(host, port))
    {
      setStreamErr("USAGE_URL");
      liveDisconnect(800);
      return;
    }
#ifdef WOKWI_SIM
    const bool ok = g_live.connect(host.c_str(), port, 8000);
#else
    const bool ok = g_live.connect(host.c_str(), port, 2000);
#endif
    if (!ok)
    {
      setStreamErr("connect falhou");
      liveDisconnect(500);
      return;
    }
    g_live.setNoDelay(true);
    char req[256];
    snprintf(req, sizeof(req),
             "GET /api/camera/cameras/%s/stream?w=%d&h=%d&fit=%s HTTP/1.1\r\n"
             "Host: %s:%u\r\n"
             "X-Vigia-Device: esp32\r\n"
             "Connection: close\r\n\r\n",
             g_streamCamId, streamReqW(), streamReqH(), g_fitCover ? "cover" : "contain", host.c_str(),
             (unsigned)port);
    g_live.print(req);
    g_liveHdrLen = 0;
    g_liveHdr[0] = 0;
    g_livePhase = LIVE_HDR;
    g_livePhaseAt = millis();
    return;
  }

  if (g_livePhase == LIVE_HDR)
  {
    if (!g_live.connected() && !g_live.available())
    {
      setStreamErr("HTTP stream");
      liveDisconnect(600);
      return;
    }
    if (millis() - g_livePhaseAt > 5000)
    {
      setStreamErr("HTTP stream");
      liveDisconnect(600);
      return;
    }
    while (g_live.available())
    {
      int c = g_live.read();
      if (c < 0)
      {
        break;
      }
      if (g_liveHdrLen < (int)sizeof(g_liveHdr) - 1)
      {
        g_liveHdr[g_liveHdrLen++] = (char)c;
        g_liveHdr[g_liveHdrLen] = 0;
      }
      if (g_liveHdrLen >= 4 && strcmp(g_liveHdr + g_liveHdrLen - 4, "\r\n\r\n") == 0)
      {
        if (!strstr(g_liveHdr, "200"))
        {
          Serial.printf("[camera] stream hdr: %.80s\n", g_liveHdr);
          setStreamErr("HTTP stream");
          liveDisconnect(600);
          return;
        }
        setStreamErr("");
        liveResetParser();
        g_livePhase = LIVE_BODY;
        return;
      }
    }
    return;
  }

  if (g_livePhase != LIVE_BODY)
  {
    return;
  }
  if (!g_live.connected() && !g_live.available())
  {
    setStreamErr("stream caiu");
    liveDisconnect(250);
    return;
  }
  int got = 0;
  while (g_live.available() && got < 1024)
  {
    uint8_t tmp[256];
    int want = g_live.available();
    if (want > (int)sizeof(tmp))
    {
      want = (int)sizeof(tmp);
    }
    int n = g_live.read(tmp, want);
    if (n <= 0)
    {
      break;
    }
    liveIngest(tmp, n);
    got += n;
  }
}

} // namespace

int cameraCount() { return g_count; }

const CameraListItem *cameraAt(int i)
{
  if (i < 0 || i >= g_count)
  {
    return nullptr;
  }
  return &g_cameras[i];
}

int cameraSelectedIndex() { return g_selected; }

void cameraSetSelected(int i)
{
  if (i < 0 || i >= g_count)
  {
    return;
  }
  g_selected = i;
}

String cameraDisplayName(const CameraListItem &c)
{
  if (c.label.length())
  {
    return c.label;
  }
  if (c.host.length())
  {
    return c.host;
  }
  return c.id.length() ? c.id : String("Camera");
}

int cameraPtzCount()
{
  int n = 0;
  for (int i = 0; i < g_count; i++)
  {
    if (g_cameras[i].ptzEnabled)
    {
      n++;
    }
  }
  return n;
}

void cameraClientFetchList()
{
  g_nextListMs = millis() + 20000;
  if (WiFi.status() != WL_CONNECTED)
  {
    return;
  }
  String host;
  uint16_t port = 80;
  if (!parseCollector(host, port))
  {
    return;
  }

  WiFiClient client;
  client.setTimeout(40);
#ifdef WOKWI_SIM
  if (!client.connect(host.c_str(), port, 8000))
#else
  if (!client.connect(host.c_str(), port, 2000))
#endif
  {
    Serial.println("[camera] lista: connect falhou");
    return;
  }

  char req[192];
  snprintf(req, sizeof(req),
           "GET /api/camera/cameras HTTP/1.1\r\n"
           "Host: %s:%u\r\n"
           "X-Vigia-Device: esp32\r\n"
           "Connection: close\r\n\r\n",
           host.c_str(), (unsigned)port);
  client.print(req);

  char hdr[320];
  int hl = 0;
  hdr[0] = 0;
  uint32_t t0 = millis();
  bool hdrDone = false;
  while (client.connected() && millis() - t0 < 2500 && !hdrDone)
  {
    while (client.available())
    {
      int c = client.read();
      if (c < 0)
      {
        break;
      }
      if (hl < (int)sizeof(hdr) - 1)
      {
        hdr[hl++] = (char)c;
        hdr[hl] = 0;
      }
      if (hl >= 4 && strcmp(hdr + hl - 4, "\r\n\r\n") == 0)
      {
        hdrDone = true;
        break;
      }
    }
    if (!hdrDone)
    {
      delay(1);
    }
  }
  if (!strstr(hdr, "200"))
  {
    Serial.printf("[camera] lista hdr: %.80s\n", hdr);
    client.stop();
    return;
  }

  char body[1280];
  int bl = 0;
  t0 = millis();
  while (millis() - t0 < 2000 && bl < (int)sizeof(body) - 1)
  {
    while (client.available() && bl < (int)sizeof(body) - 1)
    {
      int c = client.read();
      if (c < 0)
      {
        break;
      }
      body[bl++] = (char)c;
    }
    if (!client.connected() && !client.available())
    {
      break;
    }
    delay(1);
  }
  client.stop();
  body[bl] = 0;

  JsonDocument doc;
  if (deserializeJson(doc, body, (size_t)bl))
  {
    Serial.println("[camera] lista invalida");
    return;
  }
  JsonArray arr = doc["cameras"].as<JsonArray>();
  int n = 0;
  if (!arr.isNull())
  {
    for (JsonVariant v : arr)
    {
      if (n >= MAX_CAMERAS)
      {
        break;
      }
      CameraListItem &c = g_cameras[n];
      c.id = jsonText(v["id"]);
      c.label = jsonText(v["label"]);
      c.host = jsonText(v["host"]);
      c.configured = v["configured"] | false;
      c.ptzEnabled = v["ptzEnabled"] | false;
      n++;
    }
  }
  g_count = n;
  if (g_selected >= g_count)
  {
    g_selected = 0;
  }
  g_lastListMs = millis();
}

void cameraClientOnShowList()
{
  const uint32_t now = millis();
  g_nextListMs = now + (g_count > 0 ? 12000 : 400);
}

void cameraClientPoll()
{
  if (g_view != VIEW_CAMERAS)
  {
    return;
  }
  if (WiFi.status() != WL_CONNECTED)
  {
    return;
  }
  const uint32_t now = millis();
  if (g_nextListMs == 0)
  {
    g_nextListMs = now + 400;
    return;
  }
  if (now < g_nextListMs)
  {
    return;
  }
  const int before = g_count;
  cameraClientFetchList();
  if (g_count != before)
  {
    uiRefreshData();
  }
}

void cameraClientEnterLive()
{
  g_ptzHeld = false;
  g_wantLive = false;
  cameraClientExitLive();
  const CameraListItem *c = cameraAt(g_selected);
  if (!c || !c->id.length())
  {
    setStreamErr("sem camera");
    return;
  }
  strncpy(g_streamCamId, c->id.c_str(), sizeof(g_streamCamId) - 1);
  g_streamCamId[sizeof(g_streamCamId) - 1] = 0;
  g_ready = -1;
  g_busy = -1;
  g_fill = 0;
  g_streamStop = false;
  g_streamKick = false;
  setStreamErr("");
  g_wantLive = true;
  g_liveStartAt = millis() + 400;
}

void cameraClientTickLive()
{
  if (!g_wantLive || g_view != VIEW_CAMERA)
  {
    return;
  }
  if ((int32_t)(millis() - g_liveStartAt) < 0)
  {
    return;
  }
  if (!allocJpegBufs())
  {
    setStreamErr("sem RAM");
    g_wantLive = false;
    return;
  }
  livePump();
}

void cameraClientExitLive()
{
  g_wantLive = false;
  if (g_ptzHeld)
  {
    cameraClientSendPtz("stop");
  }
  g_ptzHeld = false;
  g_streamStop = true;
  g_live.stop();
  g_livePhase = LIVE_IDLE;
  g_liveHdrLen = 0;
  liveResetParser();
  g_ready = -1;
  g_busy = -1;
  g_streamCamId[0] = 0;
}

bool cameraClientPtzHeld() { return g_ptzHeld; }

void cameraClientSetPtzHeld(bool held) { g_ptzHeld = held; }

bool cameraClientSendPtz(const char *action)
{
  const CameraListItem *c = cameraAt(g_selected);
  if (!c || !c->id.length() || !c->ptzEnabled)
  {
    return false;
  }
  if (WiFi.status() != WL_CONNECTED)
  {
    return false;
  }
  JsonDocument doc;
  doc["action"] = action;
  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.setTimeout(4000);
  http.setConnectTimeout(2000);
  String url = apiBase() + "api/camera/cameras/" + c->id + "/ptz";
  if (!http.begin(url))
  {
    return false;
  }
  addDeviceHeaders(http);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  http.end();
  if (code != 200)
  {
    Serial.printf("[camera] POST ptz %s -> HTTP %d\n", action, code);
    return false;
  }
  return true;
}

bool cameraClientConsumeFrame()
{
  static uint32_t lastMs = 0;
  const uint32_t now = millis();
  if (now - lastMs < 50)
  {
    return false;
  }
  int idx = g_ready;
  if (idx < 0 || idx > 1 || !g_bufs[idx] || g_lens[idx] < 16)
  {
    return false;
  }
  g_ready = -1;
  g_busy = idx;
  bool ok = drawJpegFullscreen(g_bufs[idx], g_lens[idx]);
  g_busy = -1;
  if (ok)
  {
    lastMs = now;
  }
  return ok;
}

const char *cameraClientLiveError() { return g_streamErr; }

bool cameraClientFitCover() { return g_fitCover; }

void cameraClientToggleFit()
{
  g_fitCover = !g_fitCover;
  g_ready = -1;
  g_streamKick = true;
}

void cameraClientClearOverlayHoles() { g_holeCount = 0; }

void cameraClientAddOverlayHole(int x, int y, int w, int h)
{
  if (g_holeCount >= kMaxHoles || w <= 0 || h <= 0)
  {
    return;
  }
  OverlayHole &r = g_holes[g_holeCount++];
  r.x = (int16_t)x;
  r.y = (int16_t)y;
  r.w = (int16_t)w;
  r.h = (int16_t)h;
}
