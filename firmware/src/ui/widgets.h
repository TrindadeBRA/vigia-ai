#pragma once

#include "ui/ui.h"

// Widgets/helpers puros da UI: formatação de texto e primitivas de desenho
// reaproveitadas pelas views. Sem estado global próprio.

uint16_t barColor(float pct);
String fmtWhen(const String& raw);
bool wallClockNow(int& year, int& mo, int& dd, int& hh, int& mi, int& ss);
int weekdaySun0(int year, int mo, int dd);
String fmtPct(float pct);
String fmtRemain(float used);
String fmtUsdSite(int cents);
String fmtBrlSite(int cents);
String fmtMoney(int cents, const String &currency);
String fmtBtc(float btc);

void drawBar(int x, int y, int w, int h, float pct);
void drawError(int x, int y, const String& err, uint16_t bg);
// Quebra o erro em várias linhas. `font` 1 é menor (cards da home); 2 é o padrão
// das telas de detalhe. `maxH` 0 = sem teto (o viewport da tela recorta).
int drawErrorWrapped(int x, int y, int maxW, const String& err, uint16_t bg, uint8_t font = 2,
                     int maxH = 0);
void drawButton(int x, int y, int w, int h, const char* label);
void drawChoiceButton(int x, int y, int w, int h, const char* label, bool selected);
void drawCheckIcon(int cx, int cy, int r, uint16_t strokeColor);
void drawIcon(int x, int y, int w, int h, const uint16_t* data);
void drawInfoIcon(int cx, int cy, int r, uint16_t color);
void drawClockIcon(int cx, int cy, int r, uint16_t color);
void drawReloadIcon(int cx, int cy, int r, uint16_t color);
void drawScrollChevron(int cx, int cy, bool up, bool enabled);
void drawBackChevron(int cx, int cy, uint16_t color);
void drawFwdChevron(int cx, int cy, uint16_t color);

// Marca "VIGIA" (texto) + " AI" (acento), igual ao header. Datum TL.
int brandWidth(uint8_t font);
void drawBrand(int x, int y, uint8_t font);

// Icone da marca: olho com esclera branca fixa (nao muda com o tema) e pupila
// na cor de acento, desviada do centro por (gazeX, gazeY) em px — usado pra
// animar o olhar (ver uiTickEye). Centro (cx, cy), raio r. `lid` (0..1) fecha
// o olho verticalmente com palpebras deslizando de cima/baixo, igual ao blink
// do logo do frontend (0 = aberto, 1 = fechado).
void drawEyeIcon(int cx, int cy, int r, int gazeX, int gazeY, float lid = 0.0f);
