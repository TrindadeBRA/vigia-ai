#pragma once

#include "ui.h"

// Widgets/helpers puros da UI: formatação de texto e primitivas de desenho
// reaproveitadas pelas views (ui_views.cpp). Sem estado global próprio.

uint16_t barColor(float pct);
String fmtWhen(const String& raw);
String fmtPct(float pct);
String fmtRemain(float used);
String fmtUsdSite(int cents);

void drawBar(int x, int y, int w, int h, float pct);
void drawError(int x, int y, const String& err, uint16_t bg);
void drawButton(int y, int h, const char* label);
void drawCheckIcon(int cx, int cy, int r, uint16_t strokeColor);
void drawIcon(int x, int y, int w, int h, const uint16_t* data);
void drawInfoIcon(int cx, int cy, int r, uint16_t color);
