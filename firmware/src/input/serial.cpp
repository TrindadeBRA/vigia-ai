#include "input/internal.h"

#include "ui/ui.h"

void handleSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == 'n' || c == '+' || c == 'N') {
      uiNext();
    } else if (c == 'p' || c == '-' || c == 'P') {
      uiPrev();
    } else if (c >= '0' && c <= '7') {
      uiSetView((View)(c - '0'));
    } else if (c == 'r' || c == 'R') {
      g_requestRefresh = true;
    } else if (c == 'c' || c == 'C') {
      g_requestCalibrate = true;
    } else if (c == 'l' || c == 'L') {
      uiSetHomeLayout(HOME_LAYOUT_LIST);
    } else if (c == 'g' || c == 'G') {
      uiSetHomeLayout(HOME_LAYOUT_GRID);
    } else if (c == 'u' || c == 'U') {
      uiDetailScrollBy(-48);
    } else if (c == 'd' || c == 'D') {
      uiDetailScrollBy(48);
    } else if (c == 't' || c == 'T') {
      uiSetTheme((UiTheme)(((uint8_t)uiTheme() + 1) % 3));
    } else if (c == 'i' || c == 'I') {
      uiSetLang((UiLang)(((uint8_t)uiLang() + 1) % 3));
    } else if (c == 'h' || c == 'H') {
      uiSetHeaderEdge((HeaderEdge)(((uint8_t)uiHeaderEdge() + 1) % 4));
    } else if (c == 'a' || c == 'A') {
      uiSetAccent((UiAccent)(((uint8_t)uiAccent() + 1) % (uint8_t)ACCENT_COUNT));
    }
  }
}
