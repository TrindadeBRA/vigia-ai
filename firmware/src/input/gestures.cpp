#include "input/internal.h"

#include "ui/ui.h"

static bool g_wasDown = false;
static bool g_didTap = false;
static uint16_t g_startX = 0;
static uint16_t g_startY = 0;
uint16_t g_lastX = 0;
uint16_t g_lastY = 0;
static uint32_t g_lastTapMs = 0;

void onPointer(bool down, uint16_t x, uint16_t y) {
  uint32_t now = millis();
  if (down) {
    g_lastX = x;
    g_lastY = y;
    if (!g_wasDown) {
      g_wasDown = true;
      g_didTap = false;
      g_startX = x;
      g_startY = y;
      // Com scroll, o toque só confirma no soltar — senão o deslize vertical
      // nunca chega (o tap no down já teria aberto o card / consumido o gesto).
      if (!uiCanScroll() && now - g_lastTapMs > 160) {
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
      } else if (abs(dy) > 40 && abs(dy) > abs(dx) + 8) {
        uiHandleVerticalSwipe(dy);
        g_didTap = true;
        g_lastTapMs = now;
      }
    }
    return;
  }
  if (g_wasDown && !g_didTap && uiCanScroll() && now - g_lastTapMs > 160) {
    int16_t dx = (int16_t)g_lastX - (int16_t)g_startX;
    int16_t dy = (int16_t)g_lastY - (int16_t)g_startY;
    if (abs(dx) < 20 && abs(dy) < 20) {
      uiHandleTap((int16_t)g_startX, (int16_t)g_startY);
      g_lastTapMs = now;
    }
  }
  g_wasDown = false;
  g_didTap = false;
}
