#pragma once

#include "ui.h"

// Widgets/helpers puros da UI: formatação de texto e primitivas de desenho
// reaproveitadas pelas views (ui_views.cpp). Sem estado global próprio.

uint16_t barColor(float pct);
String fmtWhen(const String& raw);
bool wallClockNow(int& year, int& mo, int& dd, int& hh, int& mi);
int weekdaySun0(int year, int mo, int dd);
String fmtPct(float pct);
String fmtRemain(float used);
String fmtUsdSite(int cents);

void drawBar(int x, int y, int w, int h, float pct);
void drawError(int x, int y, const String& err, uint16_t bg);
void drawButton(int x, int y, int w, int h, const char* label);
void drawChoiceButton(int x, int y, int w, int h, const char* label, bool selected);
void drawCheckIcon(int cx, int cy, int r, uint16_t strokeColor);
void drawIcon(int x, int y, int w, int h, const uint16_t* data);
void drawInfoIcon(int cx, int cy, int r, uint16_t color);
void drawScrollChevron(int cx, int cy, bool up, bool enabled);
void drawBackChevron(int cx, int cy, uint16_t color);
void drawFwdChevron(int cx, int cy, uint16_t color);

// Marca "VIGIA" (texto) + " AI" (acento), igual ao header. Datum TL.
int brandWidth(uint8_t font);
void drawBrand(int x, int y, uint8_t font);
