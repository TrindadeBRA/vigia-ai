#include "input/input.h"

#include "input/internal.h"
#include "ui/ui.h"

#ifndef BTN_PREV
#define BTN_PREV 13
#endif
#ifndef BTN_NEXT
#define BTN_NEXT 5
#endif

static uint32_t g_lastBtnMs = 0;

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

#ifdef WOKWI_SIM
void pollButtons() {
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
