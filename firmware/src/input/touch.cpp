#include "input/internal.h"

#include "input/input.h"
#include "ui/i18n.h"
#include "ui/ui.h"

#include <Preferences.h>

#ifndef TOUCH_Z_MIN
#define TOUCH_Z_MIN 80
#endif

#ifndef TFT_ROTATION
#define TFT_ROTATION 1
#endif

#ifdef WOKWI_SIM
#include <Wire.h>
#ifndef FT6206_ADDR
#define FT6206_ADDR 0x38
#endif
static bool g_ftOk = false;
#endif

bool loadCal() {
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

void saveCal(const uint16_t cal[5]) {
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
  tft.fillScreen(COL_BG);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(COL_ACCENT, COL_BG);
  tft.drawString(uiTr().tapCorners, tft.width() / 2, tft.height() / 2 - 12, 4);
  delay(400);
  uint16_t cal[5];
  tft.calibrateTouch(cal, COL_TEXT, COL_BG, 20);
  saveCal(cal);
  tft.setTouch(cal);
  g_requestCalibrate = false;
  uiPaint();
#else
  g_requestCalibrate = false;
#endif
}

#ifdef WOKWI_SIM
void capTouchBegin() {
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

void pollCapTouch() {
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
  // FT6206 fala em retrato nativo 240×320. Mapeia para a paisagem do TFT.
  int32_t nx;
  int32_t ny;
#if TFT_ROTATION == 3
  nx = (int32_t)tft.width() - 1 - (int32_t)py;
  ny = (int32_t)px;
#else
  nx = (int32_t)py;
  ny = (int32_t)tft.height() - 1 - (int32_t)px;
#endif
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

#ifndef WOKWI_SIM
void pollTouch() {
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
