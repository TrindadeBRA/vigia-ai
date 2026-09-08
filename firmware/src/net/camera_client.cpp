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
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

#include <ArduinoJson.h>

namespace
{

CameraListItem g_cameras[MAX_CAMERAS];
int g_count = 0;
int g_selected = 0;
bool g_ptzHeld = false;
uint32_t g_lastListMs = 0;

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

struct OverlayHole
{
  int16_t x, y, w, h;
};
constexpr int kMaxHoles = 9;
OverlayHole g_holes[kMaxHoles];
int g_holeCount = 0;

bool pointInHole(int x, int y)
{
  for (int i = 0; i < g_holeCount; i++)
  {
    const OverlayHole &r = g_holes[i];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
    {
      return true;
    }
  }
  return false;
}

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

void pushTile(int dx, int dy, int w, int h, uint16_t *bitmap)
{
  const int scrW = tft.width();
  const int scrH = tft.height();
  if (w <= 0 || h <= 0)
  {
    return;
  }
  if (dx >= scrW || dy >= scrH || dx + w <= 0 || dy + h <= 0)
  {
    return;
  }
  const bool clip = dx < 0 || dy < 0 || dx + w > scrW || dy + h > scrH;
  if (!clip && !tileHitsHole(dx, dy, w, h))
  {
    tft.pushImage(dx, dy, w, h, bitmap);
    return;
  }
  for (int row = 0; row < h; row++)
  {
    const int sy = dy + row;
    if (sy < 0 || sy >= scrH)
    {
      continue;
    }
    int col = 0;
    while (col < w)
    {
      const int sx = dx + col;
      if (sx < 0 || sx >= scrW || pointInHole(sx, sy))
      {
        col++;
        continue;
      }
      const int start = col;
      while (col < w)
      {
        const int xx = dx + col;
        if (xx < 0 || xx >= scrW || pointInHole(xx, sy))
        {
          break;
        }
        col++;
      }
      tft.pushImage(dx + start, sy, col - start, 1, bitmap + row * w + start);
    }
  }
}

bool jpgOutput(int16_t x, int16_t y, uint16_t w, uint16_t h, uint16_t *bitmap)
{
  if (w == 0 || h == 0 || !bitmap)
  {
    return true;
  }
  pushTile(g_jpgOffX + x, g_jpgOffY + y, (int)w, (int)h, bitmap);
  return true;
}

bool drawJpegFullscreen(const uint8_t *buf, int nread)
{
  if (!buf || nread < 16)
  {
    return false;
  }
  TJpgDec.setJpgScale(1);
  TJpgDec.setSwapBytes(true);
  TJpgDec.setCallback(jpgOutput);
  uint16_t jw = 0, jh = 0;
  if (TJpgDec.getJpgSize(&jw, &jh, buf, (uint32_t)nread) != 0)
  {
    return false;
  }
  const int scrW = tft.width();
  const int scrH = tft.height();
  TJpgDec.setJpgScale(1);
  const int dw = (int)jw;
  const int dh = (int)jh;
  g_jpgOffX = (scrW - dw) / 2;
  g_jpgOffY = (scrH - dh) / 2;
  return TJpgDec.drawJpg(0, 0, buf, (uint32_t)nread) == 0;
}

constexpr int kJpegTry[] = {32 * 1024, 24 * 1024, 16 * 1024};
uint8_t *g_bufs[2] = {nullptr, nullptr};
int g_lens[2] = {0, 0};
int g_jpegCap = 0;
int g_bufCount = 0;
volatile int g_ready = -1;
volatile int g_busy = -1;
int g_fill = 0;
volatile bool g_streamStop = false;
volatile bool g_streamKick = false;
volatile bool g_streamRunning = false;
volatile bool g_fitCover = true;
TaskHandle_t g_streamTask = nullptr;
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

void streamTask(void * /*arg*/)
{
  g_streamRunning = true;

  while (!g_streamStop)
  {
    if (WiFi.status() != WL_CONNECTED || !g_streamCamId[0])
    {
      setStreamErr("sem Wi-Fi");
      vTaskDelay(pdMS_TO_TICKS(400));
      continue;
    }

    String host;
    uint16_t port = 80;
    if (!parseCollector(host, port))
    {
      setStreamErr("USAGE_URL");
      vTaskDelay(pdMS_TO_TICKS(800));
      continue;
    }

    WiFiClient client;
    client.setNoDelay(true);
    client.setTimeout(80);
#ifdef WOKWI_SIM
    if (!client.connect(host.c_str(), port, 8000))
#else
    if (!client.connect(host.c_str(), port, 3000))
#endif
    {
      setStreamErr("connect falhou");
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    String req = String("GET /api/camera/cameras/") + g_streamCamId + "/stream?w=" +
                 String(tft.width()) + "&h=" + String(tft.height()) +
                 "&fit=" + (g_fitCover ? "cover" : "contain") + " HTTP/1.1\r\n" +
                 "Host: " + host + ":" + String(port) + "\r\n" +
                 "X-Vigia-Device: esp32\r\n" +
                 "Connection: close\r\n\r\n";
    client.print(req);

    char headers[512];
    int hdrLen = 0;
    headers[0] = 0;
    uint32_t hdrStart = millis();
    while (client.connected() && !g_streamStop && !g_streamKick && millis() - hdrStart < 8000)
    {
      while (client.available())
      {
        int c = client.read();
        if (c < 0)
        {
          break;
        }
        if (hdrLen < (int)sizeof(headers) - 1)
        {
          headers[hdrLen++] = (char)c;
          headers[hdrLen] = 0;
        }
        if (hdrLen >= 4 && strcmp(headers + hdrLen - 4, "\r\n\r\n") == 0)
        {
          goto headers_done;
        }
      }
      vTaskDelay(1);
    }
  headers_done:
    if (!strstr(headers, "200"))
    {
      Serial.printf("[camera] stream hdr: %.80s\n", headers);
      setStreamErr("HTTP stream");
      client.stop();
      vTaskDelay(pdMS_TO_TICKS(600));
      continue;
    }

    setStreamErr("");
    int slot = -1;
    int accLen = 0;
    bool inJpeg = false;
    bool drop = false;
    bool pendingFf = false;
    uint8_t prev = 0;

    while (!g_streamStop && !g_streamKick && client.connected())
    {
      int avail = client.available();
      if (avail <= 0)
      {
        vTaskDelay(0);
        continue;
      }
      uint8_t tmp[512];
      int want = avail > (int)sizeof(tmp) ? (int)sizeof(tmp) : avail;
      int n = client.read(tmp, want);
      if (n <= 0)
      {
        vTaskDelay(0);
        continue;
      }
      for (int i = 0; i < n; i++)
      {
        uint8_t b = tmp[i];
        if (!inJpeg)
        {
          if (pendingFf && b == 0xd8)
          {
            pendingFf = false;
            slot = pickFillSlot();
            drop = slot < 0;
            inJpeg = true;
            prev = 0xd8;
            if (!drop)
            {
              g_bufs[slot][0] = 0xff;
              g_bufs[slot][1] = 0xd8;
              accLen = 2;
            }
            continue;
          }
          pendingFf = (b == 0xff);
          continue;
        }
        if (drop)
        {
          if (prev == 0xff && b == 0xd9)
          {
            inJpeg = false;
            drop = false;
          }
          prev = b;
          continue;
        }
        if (accLen >= g_jpegCap)
        {
          drop = true;
          prev = b;
          continue;
        }
        g_bufs[slot][accLen++] = b;
        if (accLen >= 4 && g_bufs[slot][accLen - 2] == 0xff && g_bufs[slot][accLen - 1] == 0xd9)
        {
          g_lens[slot] = accLen;
          g_ready = slot;
          if (g_bufCount > 1)
          {
            g_fill = slot ^ 1;
          }
          inJpeg = false;
          accLen = 0;
          slot = -1;
        }
      }
    }
    client.stop();
    if (g_streamKick)
    {
      g_streamKick = false;
      continue;
    }
    if (!g_streamStop)
    {
      setStreamErr("stream caiu");
      vTaskDelay(pdMS_TO_TICKS(250));
    }
  }

  g_streamRunning = false;
  g_streamTask = nullptr;
  vTaskDelete(nullptr);
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
  if (WiFi.status() != WL_CONNECTED)
  {
    return;
  }
  HTTPClient http;
#ifdef WOKWI_SIM
  http.setTimeout(8000);
  http.setConnectTimeout(8000);
#else
  http.setTimeout(4000);
  http.setConnectTimeout(2500);
#endif
  String url = apiBase() + "api/camera/cameras";
  if (!http.begin(url))
  {
    return;
  }
  addDeviceHeaders(http);
  int code = http.GET();
  if (code != 200)
  {
    Serial.printf("[camera] GET /api/camera/cameras -> HTTP %d\n", code);
    http.end();
    return;
  }
  String body = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, body))
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
        Serial.printf("[camera] ignorando cameras alem de %d\n", MAX_CAMERAS);
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

void cameraClientPoll()
{
  if (g_view == VIEW_CAMERA)
  {
    return;
  }
  if (WiFi.status() != WL_CONNECTED)
  {
    return;
  }
  uint32_t now = millis();
  if (g_lastListMs != 0 && now - g_lastListMs < 20000)
  {
    return;
  }
  const int before = g_count;
  cameraClientFetchList();
  if (g_count != before && (g_view == VIEW_HOME || g_view == VIEW_CAMERAS))
  {
    uiRefreshData();
  }
}

void cameraClientEnterLive()
{
  g_ptzHeld = false;
  cameraClientExitLive();
  const CameraListItem *c = cameraAt(g_selected);
  if (!c || !c->id.length())
  {
    setStreamErr("sem camera");
    return;
  }
  strncpy(g_streamCamId, c->id.c_str(), sizeof(g_streamCamId) - 1);
  g_streamCamId[sizeof(g_streamCamId) - 1] = 0;
  if (!allocJpegBufs())
  {
    setStreamErr("sem RAM");
    return;
  }
  g_ready = -1;
  g_busy = -1;
  g_fill = 0;
  g_streamStop = false;
  g_streamKick = false;
  setStreamErr("");
  BaseType_t ok = xTaskCreatePinnedToCore(streamTask, "camstream", 8192, nullptr, 5, &g_streamTask, 0);
  if (ok != pdPASS)
  {
    g_streamTask = nullptr;
    setStreamErr("task falhou");
  }
}

void cameraClientExitLive()
{
  if (g_ptzHeld)
  {
    cameraClientSendPtz("stop");
  }
  g_ptzHeld = false;
  g_streamStop = true;
  uint32_t t0 = millis();
  while (g_streamRunning && millis() - t0 < 2500)
  {
    delay(10);
  }
  g_streamTask = nullptr;
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
  int idx = g_ready;
  if (idx < 0 || idx > 1 || !g_bufs[idx] || g_lens[idx] < 16)
  {
    return false;
  }
  g_ready = -1;
  g_busy = idx;
  bool ok = drawJpegFullscreen(g_bufs[idx], g_lens[idx]);
  g_busy = -1;
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
