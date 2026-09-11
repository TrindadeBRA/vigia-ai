#pragma once

#include <Arduino.h>

extern uint16_t g_lastX;
extern uint16_t g_lastY;

void onPointer(bool down, uint16_t x, uint16_t y);
void handleSerial();
#ifdef WOKWI_SIM
void pollButtons();
void capTouchBegin();
void pollCapTouch();
#else
void pollTouch();
#endif
bool loadCal();
void saveCal(const uint16_t cal[5]);
