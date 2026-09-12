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
String fmtCurrencyAmount(float price, const String &base);

void drawBar(int x, int y, int w, int h, float pct);
void drawError(int x, int y, const String& err, uint16_t bg);
// Quebra o erro em várias linhas. `font` 1 é menor (cards da home); 2 é o padrão
// das telas de detalhe. `maxH` 0 = sem teto (o viewport da tela recorta).
// `transparent` = true desenha sem apagar o fundo por trás de cada glifo (1
// arg pro setTextColor) — usado pelo card do tema quando o fundo do widget
// está desligado (ver customtheme.cpp:drawThemeCard); `bg` é ignorado nesse caso.
int drawErrorWrapped(int x, int y, int maxW, const String& err, uint16_t bg, uint8_t font = 2,
                     int maxH = 0, bool transparent = false);
void drawButton(int x, int y, int w, int h, const char* label);
void drawChoiceButton(int x, int y, int w, int h, const char* label, bool selected);
void drawCheckIcon(int cx, int cy, int r, uint16_t strokeColor);
// bg: cor de fundo assumida no bake do ícone (gen_icons.py), substituída
// pela cor real de destino — default COL_CARD (ícones de card); passe
// COL_BG explicitamente pra desenhar sobre o fundo da tela (ex.: header).
void drawIcon(int x, int y, int w, int h, const uint16_t* data, uint16_t bg = COL_CARD);
void drawInfoIcon(int cx, int cy, int r, uint16_t color);
void drawClockIcon(int cx, int cy, int r, uint16_t color);
void drawReloadIcon(int cx, int cy, int r, uint16_t color);
void drawScrollChevron(int cx, int cy, bool up, bool enabled);
void drawBackChevron(int cx, int cy, uint16_t color);
void drawFwdChevron(int cx, int cy, uint16_t color);

// Marca "VIGIA" (texto) + " AI" (acento), igual ao header. Datum TL.
int brandWidth(uint8_t font);
void drawBrand(int x, int y, uint8_t font);

// Icone da marca: olho com esclera branca fixa (nao muda com o tema, exceto
// no easter egg `hurt`) e iris na cor de acento com pupila mais escura por
// cima (alphaBlend, nao preto solido), desviada do centro por (gazeX, gazeY)
// em px — usado pra animar o olhar (ver uiTickEye). Centro (cx, cy), raio r.
// `lid` (0..1) fecha o olho verticalmente com palpebras deslizando de cima/
// baixo, igual ao blink do logo do frontend (0 = aberto, 1 = fechado).
// `dilate` (0..1) cresce a iris/pupila — igual ao hover do logo web, aqui
// disparado por segurar o dedo no olho (ver uiHandlePointerHold). `hurt`
// tinge a esclera de rosa e força um leve semicerrar — easter egg de toques
// rapidos no olho (ver registerEyeTap em nav.cpp).
// `clipLid`: pálpebra recortada no círculo em vez do retângulo COL_BG — pra
// olhos desenhados sobre fundo que não é COL_BG (ícone `brand` do tema).
void drawEyeIcon(int cx, int cy, int r, int gazeX, int gazeY, float lid = 0.0f,
                  float dilate = 0.0f, bool hurt = false, bool clipLid = false);

// Mesmo desenho, mas parametrizado no alvo grafico (TFT_eSPI ou TFT_eSprite,
// que herda de TFT_eSPI) — usado pelo splash pra montar o frame inteiro num
// sprite off-screen antes de mandar pro display de uma vez (pushSprite),
// evitando o "cortes/flicker" de compor o olho direto na tela primitiva a
// primitiva (ver ui/splash.cpp).
template <typename T>
void drawEyeIconOn(T &gfx, int cx, int cy, int r, int gazeX, int gazeY, float lid = 0.0f,
                    float dilate = 0.0f, bool hurt = false, bool clipLid = false) {
  const uint16_t sclera = hurt ? gfx.alphaBlend(110, COL_BAD, TFT_WHITE) : TFT_WHITE;
  gfx.fillCircle(cx, cy, r, sclera);
  gfx.drawCircle(cx, cy, r, COL_TEXT_DIM);

  if (dilate < 0.0f) dilate = 0.0f;
  if (dilate > 1.0f) dilate = 1.0f;
  const int irisR = r * 2 / 5 + (int)(r * 3 / 10 * dilate + 0.5f);
  const int pupilR = r * 3 / 20 + (int)(r * 3 / 20 * dilate + 0.5f);
  const int px = cx + gazeX;
  const int py = cy + gazeY;
  gfx.fillCircle(px, py, irisR, COL_ACCENT);
  // Pupila: preto translucido por cima da iris (alphaBlend), nao um preto
  // solido — num icone pequeno um circulo preto puro le como "buraco".
  gfx.fillCircle(px, py, pupilR, gfx.alphaBlend(140, TFT_BLACK, COL_ACCENT));
  if (irisR >= 5) {
    gfx.fillCircle(px - irisR / 3, py - irisR / 3, irisR / 6 > 0 ? irisR / 6 : 1, TFT_WHITE);
    if (irisR >= 8) {
      const uint16_t dim = gfx.alphaBlend(115, TFT_WHITE, COL_ACCENT);
      gfx.fillCircle(px + irisR / 3, py + irisR / 4, irisR / 10 > 0 ? irisR / 10 : 1, dim);
    }
  }
  if (lid > 0.001f) {
    int coverage = (int)(r * 2 * lid + 0.5f);
    if (coverage > r * 2) coverage = r * 2;
    const int topH = coverage / 2;
    const int botH = coverage - topH;
    if (clipLid) {
      // Uma corda por linha: topo [cy-r, cy-r+topH) e base (cy+r-botH, cy+r].
      for (int dy = -r; dy <= r; dy++) {
        const bool top = dy < -r + topH;
        const bool bot = dy > r - botH;
        if (!top && !bot) continue;
        const int half = (int)sqrtf((float)(r * r - dy * dy));
        gfx.drawFastHLine(cx - half, cy + dy, half * 2 + 1, COL_BG);
      }
      gfx.drawCircle(cx, cy, r, COL_TEXT_DIM);
      return;
    }
    if (topH > 0) {
      gfx.fillRect(cx - r - 1, cy - r, r * 2 + 2, topH, COL_BG);
    }
    if (botH > 0) {
      gfx.fillRect(cx - r - 1, cy + r - botH + 1, r * 2 + 2, botH, COL_BG);
    }
  }
}
