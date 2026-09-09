#pragma once
// Paleta fiel a firmware/src/ui/theme.cpp + frontend/src/theme.ts
#include <cstdint>

struct Rgb { uint8_t r,g,b; };
inline uint32_t ABGR8(uint8_t r,uint8_t g,uint8_t b,uint8_t a=255){
  return (uint32_t)a<<24 | (uint32_t)b<<16 | (uint32_t)g<<8 | r;
}

enum ThemeId : uint8_t { THEME_DARK=0, THEME_LIGHT=1, THEME_CONTRAST=2 };
enum AccentId: uint8_t { ACC_RED=0, ACC_ORANGE, ACC_YELLOW, ACC_GREEN, ACC_CYAN, ACC_BLUE, ACC_VIOLET, ACC_COUNT };

struct Palette {
  uint32_t bg, card, cardBorder, track, text, textDim, textMuted, good, warn, bad, badgeYellow, inverse;
};

Palette paletteFor(ThemeId t, AccentId a);
// cor do acento no tema atual
uint32_t accentColor(ThemeId t, AccentId a);

// Detalhe paginado: pior conta (maior percent) — igual claudeWorstIdx() em firmware
int claudeWorstIdx(); int gptWorstIdx(); int cursorWorstIdx();
int openrouterWorstIdx(); int deepseekWorstIdx(); int opencodeWorstIdx();
int falWorstIdx(); int bitcoinWorstIdx(); int adsenseWorstIdx();
bool currenciesVisible(); bool weatherVisible();
