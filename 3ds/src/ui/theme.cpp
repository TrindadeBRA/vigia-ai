#include "theme.h"
#include "../core/state.h"
#include <algorithm>

// Cores espelhadas do web (frontend/src/theme.ts PALETTES) aproximadas em ABGR
static uint32_t ACCENTS[3][ACC_COUNT] = {
  // dark
  { 0xFF3A5CC3, 0xFF2A8FE8, 0xFF3AC7E8, 0xFF3AC78A, 0xFF3AE8C7, 0xFF8A3AE8, 0xFFC73AE8 },
  // light
  { 0xFF2A4CB8, 0xFF1A7FD0, 0xFF1AB8D0, 0xFF1AB87A, 0xFF1AD0B8, 0xFF7A1AD0, 0xFFB81AD0 },
  // contrast
  { 0xFF0000FF, 0xFF0077FF, 0xFF00FFFF, 0xFF00FF00, 0xFFFFFF00, 0xFFFF00FF, 0xFFFF0077 },
};

Palette paletteFor(ThemeId t, AccentId a){
  Palette p{};
  if(t==THEME_DARK){
    p.bg=ABGR8(0x14,0x16,0x1E); p.card=ABGR8(0x1E,0x22,0x2E); p.cardBorder=ABGR8(0x2A,0x2E,0x3A);
    p.track=ABGR8(0x2A,0x2E,0x3E); p.text=ABGR8(0xE6,0xE8,0xF0); p.textDim=ABGR8(0xA0,0xA6,0xB8); p.textMuted=ABGR8(0x6E,0x74,0x8A);
    p.good=ABGR8(0x2E,0xCC,0x71); p.warn=ABGR8(0xF1,0xC4,0x0F); p.bad=ABGR8(0xE7,0x4C,0x3C); p.badgeYellow=ABGR8(0xF1,0xC4,0x0F); p.inverse=ABGR8(0x14,0x16,0x1E);
  } else if(t==THEME_LIGHT){
    p.bg=ABGR8(0xF2,0xF3,0xF7); p.card=ABGR8(0xFF,0xFF,0xFF); p.cardBorder=ABGR8(0xE1,0xE4,0xEA);
    p.track=ABGR8(0xE6,0xE8,0xEE); p.text=ABGR8(0x1A,0x1E,0x2A); p.textDim=ABGR8(0x5A,0x60,0x74); p.textMuted=ABGR8(0x8A,0x90,0xA6); p.good=ABGR8(0x1E,0xA8,0x5E); p.warn=ABGR8(0xC9,0x9A,0x06); p.bad=ABGR8(0xC0,0x3A,0x2B); p.badgeYellow=ABGR8(0xC9,0x9A,0x06); p.inverse=ABGR8(0xFF,0xFF,0xFF);
  } else {
    p.bg=ABGR8(0x00,0x00,0x00); p.card=ABGR8(0x0A,0x0A,0x0A); p.cardBorder=ABGR8(0xFF,0xFF,0xFF);
    p.track=ABGR8(0x33,0x33,0x33); p.text=ABGR8(0xFF,0xFF,0xFF); p.textDim=ABGR8(0xCC,0xCC,0xCC); p.textMuted=ABGR8(0x99,0x99,0x99); p.good=ABGR8(0x00,0xFF,0x00); p.warn=ABGR8(0xFF,0xFF,0x00); p.bad=ABGR8(0xFF,0x00,0x00); p.badgeYellow=ABGR8(0xFF,0xFF,0x00); p.inverse=ABGR8(0x00,0x00,0x00);
  }
  // accent override
  (void)a;
  return p;
}
uint32_t accentColor(ThemeId t, AccentId a){
  if(a>=ACC_COUNT) a=ACC_RED;
  if(t>THEME_CONTRAST) t=THEME_DARK;
  return ACCENTS[t][a];
}

static int worstByPercent(float (*getPct)(int)){
  int best=-1; float mx=-1;
  // generic: caller iterates
  (void)getPct; return best; (void)mx;
}
int claudeWorstIdx(){
  int b=0; float mx=-1; for(int i=0;i<g_snap.claudeCount;i++){ float v=std::max(g_snap.claude[i].sessionPercent,g_snap.claude[i].weeklyPercent); if(v>mx){mx=v;b=i;}} return g_snap.claudeCount?b:0;
}
int gptWorstIdx(){ int b=0; float mx=-1; for(int i=0;i<g_snap.gptCount;i++){ float v=std::max(g_snap.gpt[i].sessionPercent,g_snap.gpt[i].weeklyPercent); if(v>mx){mx=v;b=i;}} return g_snap.gptCount?b:0; }
int cursorWorstIdx(){ int b=0; float mx=-1; for(int i=0;i<g_snap.cursorCount;i++){ float v=g_snap.cursor[i].percent; if(v>mx){mx=v;b=i;}} return g_snap.cursorCount?b:0; }
int openrouterWorstIdx(){ int b=0; float mx=-1; for(int i=0;i<g_snap.openrouterCount;i++){ float v=g_snap.openrouter[i].percent; if(v>mx){mx=v;b=i;}} return g_snap.openrouterCount?b:0; }
int deepseekWorstIdx(){ int b=0; float mx=-1; for(int i=0;i<g_snap.deepseekCount;i++){ float v=g_snap.deepseek[i].percent; if(v>mx){mx=v;b=i;}} return g_snap.deepseekCount?b:0; }
int opencodeWorstIdx(){ int b=0; float mx=-1; for(int i=0;i<g_snap.opencodeCount;i++){ float v=std::max({g_snap.opencode[i].rollingPercent,g_snap.opencode[i].weeklyPercent,g_snap.opencode[i].monthlyPercent,g_snap.opencode[i].percent}); if(v>mx){mx=v;b=i;}} return g_snap.opencodeCount?b:0; }
int falWorstIdx(){ int b=0; float mx=-1; for(int i=0;i<g_snap.falCount;i++){ float v=g_snap.fal[i].percent; if(v>mx){mx=v;b=i;}} return g_snap.falCount?b:0; }
int bitcoinWorstIdx(){ return 0; }
int adsenseWorstIdx(){ return 0; }
bool currenciesVisible(){ return g_snap.currencies.hasData && g_snap.currencies.itemCount>0; }
bool weatherVisible(){ return g_snap.weather.hasData; }
