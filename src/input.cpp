#include "input.h"

#include "ui.h"

#include <Preferences.h>

#ifndef BTN_PREV
#define BTN_PREV 13
#endif
#ifndef BTN_NEXT
#define BTN_NEXT 5
#endif

#ifdef WOKWI_SIM
#include <Wire.h>
#ifndef FT6206_ADDR
#define FT6206_ADDR 0x38
#endif
static bool g_ftOk = false;
#endif

#ifndef TOUCH_Z_MIN
#define TOUCH_Z_MIN 80
#endif

static bool g_wasDown = false;
static bool g_didTap = false;
static uint16_t g_startX = 0;
static uint16_t g_startY = 0;
static uint16_t g_lastX = 0;
static uint16_t g_lastY = 0;
static uint32_t g_downMs = 0;
static uint32_t g_lastBtnMs = 0;
static uint32_t g_lastTapMs = 0;

static void onPointer(bool down, uint16_t x, uint16_t y) {
  uint32_t now = millis();
  if (down) {
    g_lastX = x;
    g_lastY = y;
    if (!g_wasDown) {
      g_wasDown = true;
      g_didTap = false;
      g_startX = x;
      g_startY = y;
      g_downMs = now;
      if (now - g_lastTapMs > 160) {
        uiHandleTap((int16_t)x, (int16_t)y);
        g_didTap = true;
        g_lastTapMs = now;
      }
    } else if (!g_didTap) {
      int16_t dx = (int16_t)x - (int16_t)g_startX;
      int16_t dy = (int16_t)y - (int16_t)g_startY;
      if (abs(dx) > 55 && abs(dx) > abs(dy) + 8) {
        uiHandleSwipe(dx);
        g_didTap = true;
        g_lastTapMs = now;
      }
    }
    return;
  }
  g_wasDown = false;
  g_didTap = false;
}

static bool loadCal() {
#ifdef TOUCH_CS
  Preferences prefs;
  if (!prefs.begin("touch", true)) {
    return false;
  }
  if (!prefs.getBool("ok", false)) {
    prefs.end();
    return false;
  }
  if (prefs.getUChar("rot", 255) != tft.getRotation()) {
    prefs.end();
    return false;
  }
  uint16_t cal[5];
  cal[0] = prefs.getUShort("c0", 0);
  cal[1] = prefs.getUShort("c1", 0);
  cal[2] = prefs.getUShort("c2", 0);
  cal[3] = prefs.getUShort("c3", 0);
  cal[4] = prefs.getUShort("c4", 0);
  prefs.end();
  tft.setTouch(cal);
  return true;
#else
  return false;
#endif
}

static void saveCal(const uint16_t cal[5]) {
#ifdef TOUCH_CS
  Preferences prefs;
  if (!prefs.begin("touch", false)) {
    return;
  }
  prefs.putUShort("c0", cal[0]);
  prefs.putUShort("c1", cal[1]);
  prefs.putUShort("c2", cal[2]);
  prefs.putUShort("c3", cal[3]);
  prefs.putUShort("c4", cal[4]);
  prefs.putUChar("rot", tft.getRotation());
  prefs.putBool("ok", true);
  prefs.end();
#else
  (void)cal;
#endif
}

bool inputHasTouch() {
#if defined(TOUCH_CS) || defined(WOKWI_SIM)
  return true;
#else
  return false;
#endif
}

void inputRunCalibration() {
#ifdef TOUCH_CS
  tft.fillScreen(TFT_NAVY);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(TFT_YELLOW, TFT_NAVY);
  tft.drawString("Toque os cantos", tft.width() / 2, tft.height() / 2 - 12, 4);
  delay(400);
  uint16_t cal[5];
  tft.calibrateTouch(cal, TFT_WHITE, TFT_NAVY, 20);
  saveCal(cal);
  tft.setTouch(cal);
  g_requestCalibrate = false;
  uiPaint();
#else
  g_requestCalibrate = false;
#endif
}

#ifdef WOKWI_SIM
static void capTouchBegin() {
  Wire.begin(21, 22);
  Wire.setClock(100000);
  delay(20);
  Wire.beginTransmission(FT6206_ADDR);
  g_ftOk = (Wire.endTransmission() == 0);
  if (g_ftOk) {
    Wire.beginTransmission(FT6206_ADDR);
    Wire.write(0x80);
    Wire.write(40);
    Wire.endTransmission();
    Serial.println("wokwi: clique na tela (FT6206)");
  } else {
    Serial.println("wokwi: sem touch I2C — botoes GPIO5/13 ou serial n/p");
  }
}

static void pollCapTouch() {
  if (!g_ftOk) {
    return;
  }
  Wire.beginTransmission(FT6206_ADDR);
  Wire.write(0x02);
  if (Wire.endTransmission(false) != 0) {
    onPointer(false, g_lastX, g_lastY);
    return;
  }
  if (Wire.requestFrom((uint8_t)FT6206_ADDR, (uint8_t)5) < 5) {
    onPointer(false, g_lastX, g_lastY);
    return;
  }
  uint8_t n = Wire.read() & 0x0F;
  uint8_t xh = Wire.read();
  uint8_t xl = Wire.read();
  uint8_t yh = Wire.read();
  uint8_t yl = Wire.read();
  if (n == 0) {
    onPointer(false, g_lastX, g_lastY);
    return;
  }
  uint16_t px = (uint16_t)(((xh & 0x0F) << 8) | xl);
  uint16_t py = (uint16_t)(((yh & 0x0F) << 8) | yl);
  // FT6206 sempre fala em retrato 240×320. setRotation(1) é 320×240.
  // Clique em Claude (menu) vinha como 14,126 = canto esquerdo, não a aba.
  int32_t nx = (int32_t)py;
  int32_t ny = 239 - (int32_t)px;
  if (nx < 0) {
    nx = 0;
  }
  if (ny < 0) {
    ny = 0;
  }
  if (nx >= tft.width()) {
    nx = tft.width() - 1;
  }
  if (ny >= tft.height()) {
    ny = tft.height() - 1;
  }
  onPointer(true, (uint16_t)nx, (uint16_t)ny);
}
#endif

void inputBegin() {
#ifdef WOKWI_SIM
  pinMode(BTN_PREV, INPUT_PULLUP);
  pinMode(BTN_NEXT, INPUT_PULLUP);
  capTouchBegin();
#else
#ifdef TOUCH_CS
  pinMode(TOUCH_CS, OUTPUT);
  digitalWrite(TOUCH_CS, HIGH);
#endif
#ifdef TOUCH_IRQ
  pinMode(TOUCH_IRQ, INPUT_PULLUP);
#endif
  if (!loadCal()) {
    // TFT_eSPI sem setTouch trata x1/y1 como máximo, não como span — toques
    // viram "fora da tela" e getTouch() devolve false. Span aproximado:
    uint16_t cal[5] = {300, 3400, 300, 3400, 5};
    tft.setTouch(cal);
    Serial.println("touch: cal padrao. Melhor: Info > Calibrar, ou serial c");
  } else {
    Serial.println("touch: cal NVS ok");
  }
#endif
}

static void handleSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == 'n' || c == '+' || c == 'N') {
      uiNext();
    } else if (c == 'p' || c == '-' || c == 'P') {
      uiPrev();
    } else if (c >= '0' && c <= '3') {
      uiSetView((View)(c - '0'));
    } else if (c == 'r' || c == 'R') {
      g_requestRefresh = true;
    } else if (c == 'c' || c == 'C') {
      g_requestCalibrate = true;
    }
  }
}

#ifdef WOKWI_SIM
static void pollButtons() {
  uint32_t now = millis();
  if (now - g_lastBtnMs < 280) {
    return;
  }
  if (digitalRead(BTN_NEXT) == LOW) {
    g_lastBtnMs = now;
    uiNext();
  } else if (digitalRead(BTN_PREV) == LOW) {
    g_lastBtnMs = now;
    uiPrev();
  }
}
#endif

#ifndef WOKWI_SIM
static void pollTouch() {
#ifdef TOUCH_CS
  uint16_t z = tft.getTouchRawZ();
  if (z < TOUCH_Z_MIN) {
    onPointer(false, g_lastX, g_lastY);
    return;
  }
  uint16_t x = 0;
  uint16_t y = 0;
  tft.getTouchRaw(&x, &y);
  tft.convertRawXY(&x, &y);
  if (x >= tft.width()) {
    x = tft.width() - 1;
  }
  if (y >= tft.height()) {
    y = tft.height() - 1;
  }
  onPointer(true, x, y);
#else
  (void)0;
#endif
}
#endif

void inputPoll() {
  handleSerial();
#ifdef WOKWI_SIM
  pollButtons();
  pollCapTouch();
#else
  pollTouch();
#endif
  if (g_requestCalibrate) {
    inputRunCalibration();
  }
}
