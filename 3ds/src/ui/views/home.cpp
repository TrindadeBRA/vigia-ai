#include "../../core/state.h"
#include "../ui.h"
#include "../theme.h"
#include <string>
#include <cstdio>

#ifdef _3DS
#include <citro2d/c2d.h>
#endif

namespace vigia {

static std::string viewTitle(View v){
  switch(v){
    case VIEW_CLAUDE: return "Claude";
    case VIEW_GPT: return "GPT";
    case VIEW_CURSOR: return "Cursor";
    case VIEW_OPENROUTER: return "OpenRouter";
    case VIEW_DEEPSEEK: return "DeepSeek";
    case VIEW_OPENCODE: return "OpenCode";
    case VIEW_FAL: return "fal.ai";
    case VIEW_BITCOIN: return "Bitcoin";
    case VIEW_ADSENSE: return "AdSense";
    case VIEW_CURRENCIES: return "Moedas";
    case VIEW_WEATHER: return "Clima";
    case VIEW_STATUS: return "Sistema";
    default: return "Home";
  }
}
static float worstPct(View v){
  switch(v){
    case VIEW_CLAUDE: if(g_snap.claudeCount) return std::max(g_snap.claude[g_claudeIdx].sessionPercent,g_snap.claude[g_claudeIdx].weeklyPercent); break;
    case VIEW_GPT: if(g_snap.gptCount) return std::max(g_snap.gpt[g_gptIdx].sessionPercent,g_snap.gpt[g_gptIdx].weeklyPercent); break;
    case VIEW_CURSOR: if(g_snap.cursorCount) return g_snap.cursor[g_cursorIdx].percent; break;
    case VIEW_OPENROUTER: if(g_snap.openrouterCount) return g_snap.openrouter[g_openrouterIdx].percent; break;
    case VIEW_DEEPSEEK: if(g_snap.deepseekCount) return g_snap.deepseek[g_deepseekIdx].percent; break;
    case VIEW_OPENCODE: if(g_snap.opencodeCount) return std::max({g_snap.opencode[g_opencodeIdx].rollingPercent,g_snap.opencode[g_opencodeIdx].weeklyPercent,g_snap.opencode[g_opencodeIdx].monthlyPercent}); break;
    case VIEW_FAL: if(g_snap.falCount) return g_snap.fal[g_falIdx].percent; break;
    default: break;
  }
  return -1;
}

#ifdef _3DS
static void drawCard(float x,float y,float w,float h, uint32_t bg,uint32_t border,const char* title,float pct,bool okFallback){
  C2D_DrawRectSolid(x,y,0,w,h,bg);
  C2D_DrawRectSolid(x,y,0,w,1,border);
  C2D_DrawRectSolid(x,y+h-1,0,w,1,border);
  C2D_DrawRectSolid(x,y,0,1,h,border);
  C2D_DrawRectSolid(x+w-1,y,0,1,h,border);
  // titulo (stub text via ui.cpp drawText seria melhor; aqui direto)
  (void)title; (void)pct; (void)okFallback;
}
#endif

void paintHomeTop(){
#ifdef _3DS
  UiCtx c=uiCtx();
  // resumo no top: 2-3 cards maiores + status line
  // Se nao tem dado ainda
  if(!g_hasFetchedOk){
    // splash hint
    C2D_DrawTextSimple(12, 60, 0.5, 0.5, c.textDim, "Aguardando coletor... X=config");
    char url[128]; snprintf(url,sizeof(url),"%s/usage", g_panelUrl.c_str());
    C2D_DrawTextSimple(12, 80, 0.4, 0.4, c.textMuted, g_panelUrl.empty()?"http://<IP>:8787/usage":url);
    return;
  }
  int line=40;
  C2D_DrawTextSimple(12, line, 0.45,0.45, c.text, g_snap.updatedAt.c_str());
  line+=18;
  // conta total
  char sum[64]; snprintf(sum,sizeof(sum),"%d contas  %d moedas  %s", g_snap.claudeCount+g_snap.gptCount+g_snap.cursorCount+g_snap.openrouterCount+g_snap.deepseekCount+g_snap.opencodeCount+g_snap.falCount+g_snap.bitcoinCount+g_snap.adsenseCount, g_snap.currencies.itemCount, g_snap.statusLine.c_str());
  C2D_DrawTextSimple(12, line, 0.38,0.38, c.textDim, sum);
#else
  (void)worstPct; (void)viewTitle;
#endif
}

void paintHomeBottom(){
#ifdef _3DS
  UiCtx c=uiCtx();
  View order[]={VIEW_CLAUDE,VIEW_GPT,VIEW_CURSOR,VIEW_OPENROUTER,VIEW_DEEPSEEK,VIEW_OPENCODE,VIEW_FAL,VIEW_BITCOIN,VIEW_ADSENSE,VIEW_CURRENCIES,VIEW_WEATHER,VIEW_STATUS};
  int cnt=0; View vis[16];
  for(auto v: order){
    bool ok=false;
    switch(v){
      case VIEW_CLAUDE: ok=g_snap.claudeCount>0; break;
      case VIEW_GPT: ok=g_snap.gptCount>0; break;
      case VIEW_CURSOR: ok=g_snap.cursorCount>0; break;
      case VIEW_OPENROUTER: ok=g_snap.openrouterCount>0; break;
      case VIEW_DEEPSEEK: ok=g_snap.deepseekCount>0; break;
      case VIEW_OPENCODE: ok=g_snap.opencodeCount>0; break;
      case VIEW_FAL: ok=g_snap.falCount>0; break;
      case VIEW_BITCOIN: ok=g_snap.bitcoinCount>0; break;
      case VIEW_ADSENSE: ok=g_snap.adsenseCount>0; break;
      case VIEW_CURRENCIES: ok=currenciesVisible(); break;
      case VIEW_WEATHER: ok=weatherVisible(); break;
      case VIEW_STATUS: ok=true; break;
      default: break;
    }
    if(ok) vis[cnt++]=v;
  }
  const int cols=2, gap=8, cardW=152, cardH=56, ox=8, oy=10;
  // scroll handled via global s_scroll (ui.cpp) - we draw with offset
  extern int s_scroll; // hack: ui.cpp static workaround via uiCanScroll? Use simple.
  for(int i=0;i<cnt;i++){
    int col=i%cols, row=i/cols;
    int x=ox+col*(cardW+gap), y=oy+row*(cardH+gap);
    // naive clip (bottom 240)
    if(y+cardH<0 || y>240) continue;
    // bg por pct
    View v=vis[i];
    float pct=worstPct(v);
    uint32_t bg=c.card, border=c.cardBorder;
    if(pct>=80) bg=0xFF2A1A1A;
    else if(pct>=60) bg=0xFF2A2410;
    C2D_DrawRectSolid((float)x,(float)y,0,cardW,cardH,bg);
    C2D_DrawRectSolid((float)x,(float)y,0,cardW,1,border);
    C2D_DrawRectSolid((float)x,(float)y+cardH-1,0,cardW,1,border);
    C2D_DrawRectSolid((float)x,(float)y,0,1,cardH,border);
    C2D_DrawRectSolid((float)x+cardW-1,(float)y,0,1,cardH,border);
    std::string t=viewTitle(v);
    C2D_DrawTextSimple((float)x+8,(float)y+8,0.42,0.42,c.text,t.c_str());
    if(pct>=0){
      char p[16]; snprintf(p,sizeof(p),"%.0f%%", pct);
      uint32_t col = pct>=80? c.bad : pct>=60? c.warn : c.good;
      C2D_DrawTextSimple((float)x+8,(float)y+28,0.5,0.5,col,p);
    } else if(v==VIEW_BITCOIN || v==VIEW_CURRENCIES || v==VIEW_WEATHER){
      C2D_DrawTextSimple((float)x+8,(float)y+28,0.38,0.38,c.textDim,"ok");
    }
  }
#endif
}

} // namespace vigia
