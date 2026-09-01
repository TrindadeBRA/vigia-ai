#include "net/theme_server.h"

#include <WebServer.h>

#include "ui/customtheme.h"

// Porta 80 só pro upload/consulta do tema — não tem nada a ver com o coletor
// (esse continua em net/client.cpp, puxando /usage e /events). LAN only,
// igual ao resto do projeto: não exponha essa porta na internet.
static WebServer g_server(80);
static bool g_uploadOk = true;

static void sendCors() {
  g_server.sendHeader("Access-Control-Allow-Origin", "*");
  g_server.sendHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  // "*" (sem credentials) libera qualquer header que o browser decida mandar —
  // ex. Cache-Control/Pragma que o fetch(cache:"no-store") injeta sozinho e
  // que travava o preflight quando só liberávamos Content-Type.
  g_server.sendHeader("Access-Control-Allow-Headers", "*");
}

static void handleOptions() {
  sendCors();
  g_server.send(204);
}

static void handleGetTheme() {
  sendCors();
  String json = customThemeCurrentJson();
  String body = "{\"width\":" + String(customThemeCanvasWidth()) +
               ",\"height\":" + String(customThemeCanvasHeight()) +
               ",\"active\":" + String(customThemeActive() ? "true" : "false") +
               ",\"fs_ok\":" + String(customThemeFsOk() ? "true" : "false") +
               ",\"theme\":" + (json.length() ? json : "null") + "}";
  g_server.send(200, "application/json", body);
}

// Corpo pequeno (theme.json) — o WebServer já bufferiza em arg("plain"),
// tranquilo pra um JSON de poucos KB.
static void handlePostMeta() {
  sendCors();
  String body = g_server.arg("plain");
  if (!body.length()) {
    g_server.send(400, "application/json", "{\"ok\":false,\"error\":\"corpo vazio\"}");
    return;
  }
  if (body.length() > 8192) {
    g_server.send(413, "application/json", "{\"ok\":false,\"error\":\"tema grande demais\"}");
    return;
  }
  if (!customThemeApplyMeta(body)) {
    String detail = customThemeLastError();
    detail.replace("\"", "'");
    detail.replace("\n", " ");
    g_server.send(400, "application/json", "{\"ok\":false,\"error\":\"JSON de tema inválido: " + detail + "\"}");
    return;
  }
  g_server.send(200, "application/json", "{\"ok\":true}");
}

// Upload multipart/form-data (campo "bg") — o WebServer entrega em blocos via
// HTTPUpload, nunca bufferiza a imagem inteira (pode passar de 300 KB em
// 480x320 RGB565) em RAM.
static void handleBackgroundUpload() {
  HTTPUpload& upload = g_server.upload();
  if (upload.status == UPLOAD_FILE_START) {
    g_uploadOk = customThemeBeginBackgroundWrite();
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    if (g_uploadOk) {
      g_uploadOk = customThemeWriteBackgroundChunk(upload.buf, upload.currentSize);
    }
  } else if (upload.status == UPLOAD_FILE_END) {
    const size_t expected = (size_t)customThemeCanvasWidth() * (size_t)customThemeCanvasHeight() * 2;
    bool sizeOk = (upload.totalSize == expected);
    if (!sizeOk) {
      Serial.printf("tema: bg upload tamanho %u != esperado %u\n", (unsigned)upload.totalSize,
                    (unsigned)expected);
    }
    g_uploadOk = g_uploadOk && sizeOk;
    customThemeEndBackgroundWrite(g_uploadOk);
  } else if (upload.status == UPLOAD_FILE_ABORTED) {
    g_uploadOk = false;
    customThemeEndBackgroundWrite(false);
  }
}

static void handleBackgroundDone() {
  sendCors();
  if (g_uploadOk) {
    g_server.send(200, "application/json", "{\"ok\":true}");
  } else {
    g_server.send(400, "application/json", "{\"ok\":false,\"error\":\"upload inválido (tamanho ou storage)\"}");
  }
}

static void handleDeleteTheme() {
  sendCors();
  customThemeClearAll();
  g_server.send(200, "application/json", "{\"ok\":true}");
}

// Lê a tela de verdade via SPI (MISO, ver docs/HARDWARE.md) e devolve um BMP
// 24 bits — "100% do item recebido", sem depender de foto do celular. Lento
// (leitura pixel a pixel por SPI) e bloqueia o loop() enquanto captura; é
// debug, não chame em loop automático. <img src="…/theme/screenshot"> no
// browser não passa por CORS (não é fetch), então nem precisa do header.
static void handleScreenshot() {
  const int w = tft.width();
  const int h = tft.height();
  const int rowStride = ((w * 3 + 3) / 4) * 4;  // linhas de BMP são múltiplas de 4 bytes
  const uint32_t imageSize = (uint32_t)rowStride * (uint32_t)h;
  const uint32_t fileSize = 54 + imageSize;

  uint8_t header[54] = {0};
  header[0] = 'B';
  header[1] = 'M';
  header[2] = (uint8_t)(fileSize);
  header[3] = (uint8_t)(fileSize >> 8);
  header[4] = (uint8_t)(fileSize >> 16);
  header[5] = (uint8_t)(fileSize >> 24);
  header[10] = 54;  // offset dos pixels
  header[14] = 40;  // tamanho do BITMAPINFOHEADER
  header[18] = (uint8_t)(w);
  header[19] = (uint8_t)(w >> 8);
  header[20] = (uint8_t)(w >> 16);
  header[21] = (uint8_t)(w >> 24);
  const int32_t negH = -h;  // negativo = linhas na ordem top-down (evita inverter)
  header[22] = (uint8_t)(negH);
  header[23] = (uint8_t)(negH >> 8);
  header[24] = (uint8_t)(negH >> 16);
  header[25] = (uint8_t)(negH >> 24);
  header[26] = 1;   // planes
  header[28] = 24;  // bits por pixel
  header[34] = (uint8_t)(imageSize);
  header[35] = (uint8_t)(imageSize >> 8);
  header[36] = (uint8_t)(imageSize >> 16);
  header[37] = (uint8_t)(imageSize >> 24);

  g_server.setContentLength(fileSize);
  g_server.send(200, "image/bmp", "");
  g_server.sendContent((const char*)header, sizeof(header));

  constexpr int kRows = 8;
  static uint8_t rgbBuf[480 * kRows * 3];  // readRectRGB: R,G,B por pixel
  static uint8_t rowBuf[480 * 3 + 4];      // banda: B,G,R (BMP) + padding

  int y = 0;
  while (y < h) {
    const int rows = min(kRows, h - y);
    tft.readRectRGB(0, y, w, rows, rgbBuf);
    for (int r = 0; r < rows; r++) {
      const uint8_t* src = rgbBuf + (size_t)r * w * 3;
      for (int x = 0; x < w; x++) {
        rowBuf[x * 3 + 0] = src[x * 3 + 2];
        rowBuf[x * 3 + 1] = src[x * 3 + 1];
        rowBuf[x * 3 + 2] = src[x * 3 + 0];
      }
      for (int p = w * 3; p < rowStride; p++) {
        rowBuf[p] = 0;
      }
      g_server.sendContent((const char*)rowBuf, rowStride);
    }
    y += rows;
  }
}

void themeServerBegin() {
  g_server.on("/theme", HTTP_GET, handleGetTheme);
  g_server.on("/theme", HTTP_OPTIONS, handleOptions);
  g_server.on("/theme", HTTP_DELETE, handleDeleteTheme);
  g_server.on("/theme/meta", HTTP_POST, handlePostMeta);
  g_server.on("/theme/meta", HTTP_OPTIONS, handleOptions);
  g_server.on("/theme/background", HTTP_POST, handleBackgroundDone, handleBackgroundUpload);
  g_server.on("/theme/background", HTTP_OPTIONS, handleOptions);
  g_server.on("/theme/screenshot", HTTP_GET, handleScreenshot);
  g_server.begin();
  Serial.println("servidor de tema: porta 80 (/theme)");
}

void themeServerHandle() { g_server.handleClient(); }
