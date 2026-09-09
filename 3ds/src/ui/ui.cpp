#include "ui.h"
#include "../core/config.h"
#include "../core/state.h"
#include "../net/http_client.h"
#include "theme.h"
#include <algorithm>
#include <cstdio>
#include <cstring>
#include <string>

#ifdef _3DS
#include <3ds.h>
#include <citro2d.h>
static C3D_RenderTarget *topTarget=nullptr, *botTarget=nullptr;
static C2D_TextBuf textBuf=nullptr;
static C2D_Font font=nullptr;
#endif

static ThemeId s_theme = THEME_DARK;
static AccentId s_accent = ACC_RED;
static HomeLayout s_layout = HOME_LAYOUT_GRID;
static CardSize s_cardSize[VIEW_COUNT];
static int s_scroll = 0;
static VigiaConfig s_cfg;

UiCtx uiCtx(){
  Palette p = paletteFor(s_theme,s_accent);
  uint32_t acc = accentColor(s_theme,s_accent);
  return UiCtx{p,acc,400,240,320,240};
}

ThemeId uiTheme(){ return s_theme; }
void uiSetTheme(ThemeId t){ s_theme=t; s_cfg.theme=(uint8_t)t; configSave(s_cfg); }
uint8_t uiLang(){ return s_cfg.lang; }
void uiSetLang(uint8_t l){ s_cfg.lang=l; configSave(s_cfg); }
AccentId uiAccent(){ return s_accent; }
void uiSetAccent(AccentId a){ s_accent=a; s_cfg.accent=(uint8_t)a; configSave(s_cfg); }
HomeLayout uiHomeLayout(){ return s_layout; }
void uiSetHomeLayout(HomeLayout l){ s_layout=l; }
CardSize uiCardSize(View v){ if(v>=VIEW_COUNT) return CARD_MD; return s_cardSize[v]; }
void uiSetCardSize(View v, CardSize s){ if(v<VIEW_COUNT) s_cardSize[v]=s; }

int uiAccountIdx(View v){
  switch(v){
    case VIEW_CLAUDE: return g_claudeIdx;
    case VIEW_GPT: return g_gptIdx;
    case VIEW_CURSOR: return g_cursorIdx;
    case VIEW_OPENROUTER: return g_openrouterIdx;
    case VIEW_DEEPSEEK: return g_deepseekIdx;
    case VIEW_OPENCODE: return g_opencodeIdx;
    case VIEW_FAL: return g_falIdx;
    case VIEW_BITCOIN: return g_bitcoinIdx;
    case VIEW_ADSENSE: return g_adsenseIdx;
    default: return 0;
  }
}
bool uiHasPager(View v){
  switch(v){
    case VIEW_CLAUDE: return g_snap.claudeCount>1;
    case VIEW_GPT: return g_snap.gptCount>1;
    case VIEW_CURSOR: return g_snap.cursorCount>1;
    case VIEW_OPENROUTER: return g_snap.openrouterCount>1;
    case VIEW_DEEPSEEK: return g_snap.deepseekCount>1;
    case VIEW_OPENCODE: return g_snap.opencodeCount>1;
    case VIEW_FAL: return g_snap.falCount>1;
    case VIEW_BITCOIN: return g_snap.bitcoinCount>1;
    case VIEW_ADSENSE: return g_snap.adsenseCount>1;
    default: return false;
  }
}
void uiAccountStep(int dir){
  View v=g_view;
  int *idx=nullptr; int n=0;
  switch(v){ case VIEW_CLAUDE: idx=&g_claudeIdx; n=g_snap.claudeCount; break;
             case VIEW_GPT: idx=&g_gptIdx; n=g_snap.gptCount; break;
             case VIEW_CURSOR: idx=&g_cursorIdx; n=g_snap.cursorCount; break;
             case VIEW_OPENROUTER: idx=&g_openrouterIdx; n=g_snap.openrouterCount; break;
             case VIEW_DEEPSEEK: idx=&g_deepseekIdx; n=g_snap.deepseekCount; break;
             case VIEW_OPENCODE: idx=&g_opencodeIdx; n=g_snap.opencodeCount; break;
             case VIEW_FAL: idx=&g_falIdx; n=g_snap.falCount; break;
             case VIEW_BITCOIN: idx=&g_bitcoinIdx; n=g_snap.bitcoinCount; break;
             case VIEW_ADSENSE: idx=&g_adsenseIdx; n=g_snap.adsenseCount; break;
             default: return; }
  if(!idx||n<=1) return;
  int cur=*idx+dir; if(cur<0) cur=n-1; if(cur>=n) cur=0; *idx=cur;
}

static bool viewVisible(View v){
  switch(v){
    case VIEW_CLAUDE: return g_snap.claudeCount>0;
    case VIEW_GPT: return g_snap.gptCount>0;
    case VIEW_CURSOR: return g_snap.cursorCount>0;
    case VIEW_OPENROUTER: return g_snap.openrouterCount>0;
    case VIEW_DEEPSEEK: return g_snap.deepseekCount>0;
    case VIEW_OPENCODE: return g_snap.opencodeCount>0;
    case VIEW_FAL: return g_snap.falCount>0;
    case VIEW_BITCOIN: return g_snap.bitcoinCount>0;
    case VIEW_ADSENSE: return g_snap.adsenseCount>0;
    case VIEW_CURRENCIES: return currenciesVisible();
    case VIEW_WEATHER: return weatherVisible();
    default: return true;
  }
}

void uiSetView(View v){
  if(v>=VIEW_COUNT) return;
  if(!viewVisible(v)) v=VIEW_HOME;
  if(v==g_view) return;
  g_view=v; s_scroll=0;
  // ao entrar em detalhe, foca pior conta (igual nav.cpp:161-196)
  if(v==VIEW_CLAUDE) g_claudeIdx=claudeWorstIdx();
  else if(v==VIEW_GPT) g_gptIdx=gptWorstIdx();
  else if(v==VIEW_CURSOR) g_cursorIdx=cursorWorstIdx();
  else if(v==VIEW_OPENROUTER) g_openrouterIdx=openrouterWorstIdx();
  else if(v==VIEW_DEEPSEEK) g_deepseekIdx=deepseekWorstIdx();
  else if(v==VIEW_OPENCODE) g_opencodeIdx=opencodeWorstIdx();
  else if(v==VIEW_FAL) g_falIdx=falWorstIdx();
  else if(v==VIEW_BITCOIN) g_bitcoinIdx=bitcoinWorstIdx();
  else if(v==VIEW_ADSENSE) g_adsenseIdx=adsenseWorstIdx();
  uiPaint();
}
View uiGetView(){ return g_view; }
void uiNext(){ uiSetView(g_view==VIEW_HOME?VIEW_STATUS:VIEW_HOME); }
void uiPrev(){ uiSetView(g_view==VIEW_STATUS?VIEW_HOME:VIEW_STATUS); }
void uiRequestConfig(){ uiSetView(VIEW_CONFIG); }

bool uiCanScroll(){ return g_view==VIEW_HOME || g_view==VIEW_STATUS; }
void uiScrollBy(int dy){ s_scroll+=dy; if(s_scroll<0) s_scroll=0; }

int headerDisplayKey(int secs,bool check){ return secs*2 + (check?1:0); }

// ---- citro2d init ----
void uiInit(){
  configLoad(s_cfg);
  s_theme = (ThemeId)(s_cfg.theme % 3);
  s_accent = (AccentId)(s_cfg.accent % ACC_COUNT);
  for(int i=0;i<VIEW_COUNT;i++) s_cardSize[i]=CARD_MD;
  s_scroll=0;
#ifdef _3DS
  C3D_Init(C3D_DEFAULT_CMDBUF_SIZE);
  C2D_Init(C2D_DEFAULT_MAX_OBJECTS);
  C2D_Prepare();
  topTarget = C2D_CreateScreenTarget(GFX_TOP, GFX_LEFT);
  botTarget = C2D_CreateScreenTarget(GFX_BOTTOM, GFX_LEFT);
  textBuf = C2D_TextBufNew(4096);
  font = nullptr; // usa system font
#endif
}
void uiShutdown(){
#ifdef _3DS
  if(textBuf) C2D_TextBufDelete(textBuf);
  C2D_Fini(); C3D_Fini();
#endif
}

#ifdef _3DS
static void drawRect(float x,float y,float w,float h,uint32_t col){
  C2D_DrawRectSolid(x,y,0,w,h,col);
}
static void drawText(float x,float y,float scale,uint32_t col,const char* s){
  C2D_Text txt; C2D_TextFontParse(&txt, font, textBuf, s);
  C2D_TextOptimize(&txt);
  C2D_DrawText(&txt, C2D_WithColor, x,y,0,scale,scale,col);
}
#else
static void drawRect(float,float,float,float,uint32_t){ }
static void drawText(float,float,float,uint32_t,const char*){ }
#endif

void uiDrawHeaderTop(){
#ifdef _3DS
  UiCtx c=uiCtx();
  // header 400x28
  drawRect(0,0,400,28,c.pal.card);
  // titulo + countdown + status
  char hdr[128];
  // countdown
  uint64_t now=0; {
#ifdef _3DS
    now=osGetTime();
#else
    now=0;
#endif
  }
  int secs = 0;
  if(g_pollMs>0 && g_lastFetchMs>0){
    int64_t left = (int64_t)g_pollMs - (int64_t)(now - g_lastFetchMs);
    if(left<0) left=0;
    secs=(int)(left/1000);
  }
  bool ok = g_hasFetchedOk;
  snprintf(hdr,sizeof(hdr),"Vigia AI  %02d s %s %s", secs, ok?"\x03":"", g_netLine.c_str());
  drawText(8,6,0.45,c.pal.text,hdr);
#else
  (void)drawRect; (void)drawText;
#endif
}

// Views forward decls
namespace vigia { void paintHomeTop(); void paintHomeBottom(); void paintDetailTop(View v); void paintStatusTop(); void paintConfigTop(); void paintConfigBottom(); }

void uiPaint(){
#ifdef _3DS
  if(!topTarget||!botTarget) return;
  C3D_FrameBegin(C3D_FRAME_SYNCDRAW);
  // TOP
  C2D_TargetClear(topTarget, uiCtx().pal.bg);
  C2D_SceneBegin(topTarget);
  uiDrawHeaderTop();
  if(g_view==VIEW_HOME) vigia::paintHomeTop();
  else if(g_view==VIEW_STATUS) vigia::paintStatusTop();
  else if(g_view==VIEW_CONFIG) vigia::paintConfigTop();
  else vigia::paintDetailTop(g_view);
  // BOTTOM
  C2D_TargetClear(botTarget, uiCtx().pal.bg);
  C2D_SceneBegin(botTarget);
  if(g_view==VIEW_HOME) vigia::paintHomeBottom();
  else if(g_view==VIEW_CONFIG) vigia::paintConfigBottom();
  } else {
    // bottom hint para detalhe
    UiCtx c2=uiCtx();
    drawText(8,8,0.4,c2.pal.textDim,"B: voltar  L/R: conta  Y: refresh  X: config");
  }
  C3D_FrameEnd(0);
#else
  // host: no-op
#endif
}
void uiRefreshData(){ uiPaint(); }
void uiTickClock(){
  static uint64_t last=0;
#ifdef _3DS
  uint64_t now=osGetTime();
  if(now-last<1000) return;
  last=now;
  uiPaint();
#else
  (void)last;
#endif
}

void uiHandleTouch(int16_t x,int16_t y,bool down){
  if(!down) return;
  if(g_view==VIEW_HOME){
    // hit test grid 2 cols x N rows no bottom (320x240). Card 152x56, gap 8, top 10
    const int cols=2, gap=8, cardW=152, cardH=56, ox=8, oy=10;
    // mapeia cards visiveis na ordem de nav.cpp viewVisible
    View order[]={VIEW_CLAUDE,VIEW_GPT,VIEW_CURSOR,VIEW_OPENROUTER,VIEW_DEEPSEEK,VIEW_OPENCODE,VIEW_FAL,VIEW_BITCOIN,VIEW_ADSENSE,VIEW_CURRENCIES,VIEW_WEATHER};
    int vis[16]; int vc=0;
    for(auto v: order) if(viewVisible(v)) vis[vc++]=v;
    // inclui HOME cards limitados a 6 visiveis por pagina com scroll
    for(int i=0;i<vc;i++){
      int col=i%cols, row=i/cols;
      int rx=ox+col*(cardW+gap), ry=oy+row*(cardH+gap)-s_scroll;
      if(x>=rx && x<rx+cardW && y>=ry && y<ry+cardH){
        uiSetView((View)vis[i]); return;
      }
    }
  } else if(g_view==VIEW_CONFIG){
    // bottom config: duas areas - input URL e botoes Salvar/Cancelar
    if(y>200){
      if(x<160) uiSetView(VIEW_HOME);
      else { configSave(s_cfg); uiSetView(VIEW_HOME); }
    }
  }
}
void uiHandleButton(uint32_t kDown){
#ifdef _3DS
  if(kDown & KEY_B) {
    if(g_view==VIEW_CONFIG) uiSetView(VIEW_HOME);
    else if(g_view!=VIEW_HOME) uiSetView(VIEW_HOME);
  }
  if(kDown & KEY_A){
    // se HOME com foco, entra; se detalhe, paginador next
    if(g_view!=VIEW_HOME && uiHasPager(g_view)) uiAccountStep(1);
  }
  if(kDown & KEY_X) uiRequestConfig();
  if(kDown & KEY_Y) { g_requestRefresh=true; httpClientRequestRefresh(); }
  if(kDown & KEY_L) uiAccountStep(-1);
  if(kDown & KEY_R) uiAccountStep(1);
  if(kDown & KEY_START) uiSetView(g_view==VIEW_STATUS?VIEW_HOME:VIEW_STATUS);
  if(kDown & KEY_SELECT){
    ThemeId nt=(ThemeId)((s_theme+1)%3); uiSetTheme(nt);
  }
  if(kDown & KEY_DUP) uiScrollBy(-32);
  if(kDown & KEY_DDOWN) uiScrollBy(32);
  if(kDown & KEY_DLEFT) uiAccountStep(-1);
  if(kDown & KEY_DRIGHT) uiAccountStep(1);
#else
  (void)kDown;
#endif
}
