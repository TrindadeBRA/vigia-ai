#pragma once

#include "app_state.h"

void uiInit();
void uiPaint();
void uiNext();
void uiPrev();
void uiSetView(View v);
void uiHandleTap(int16_t x, int16_t y);
void uiHandleSwipe(int16_t dx);
void uiMarkTouch(int16_t x, int16_t y, uint16_t z);
