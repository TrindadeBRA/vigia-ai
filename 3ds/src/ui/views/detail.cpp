#include "../../core/state.h"
#include "../ui.h"
#include "../theme.h"
#include <cstdio>
#include <string>
#include <algorithm>

#ifdef _3DS
#include <citro2d/c2d.h>
#endif

namespace vigia {

static void lineTop(int &y, const char* s, uint32_t col, float sc=0.42f){
#ifdef _3DS
  C2D_DrawTextSimple(12, (float)y, sc, sc, col, s);
  y+= (int)(18*sc/0.42f + 4);
#else
  (void)y;(void)s;(void)col;(void)sc;
#endif
}

void paintDetailTop(View v){
#ifdef _3DS
  UiCtx c=uiCtx();
  int y=36;
  bool hasPager=false; int cur=0, tot=0;

  auto pager = [&](int cur_,int tot_){
    if(tot<=1) return;
    char pg[24]; snprintf(pg,sizeof(pg),"< %d/%d >", cur_+1, tot);
    C2D_DrawTextSimple(300, 28, 0.38,0.38, c.textDim, pg);
  };

  char buf[128];
  switch(v){
    case VIEW_CLAUDE: {
      if(!g_snap.claudeCount){ lineTop(y,"Sem contas Claude",c.textMuted); break; }
      auto &a=g_snap.claude[g_claudeIdx];
      hasPager=g_snap.claudeCount>1; cur=g_claudeIdx; tot=g_snap.claudeCount;
      snprintf(buf,sizeof(buf),"%s  %s", a.label.empty()?"Claude":a.label.c_str(), a.ok?"ok":"erro");
      lineTop(y,buf, a.ok?c.good:c.bad,0.44f);
      if(!a.ok){ lineTop(y,a.error.c_str(),c.textDim,0.36f); break; }
      snprintf(buf,sizeof(buf),"Sessao %.0f%%  reset %s", a.sessionPercent, a.sessionResets.c_str());
      lineTop(y,buf,c.text,0.38f);
      snprintf(buf,sizeof(buf),"Semana %.0f%%  reset %s", a.weeklyPercent, a.weeklyResets.c_str());
      lineTop(y,buf,c.text,0.38f);
      if(a.sonnetPercent>=0){ snprintf(buf,sizeof(buf),"Sonnet %.0f%%",a.sonnetPercent); lineTop(y,buf,c.textDim,0.36f); }
      if(a.opusPercent>=0){ snprintf(buf,sizeof(buf),"Opus %.0f%%",a.opusPercent); lineTop(y,buf,c.textDim,0.36f); }
      break;
    }
    case VIEW_GPT: {
      if(!g_snap.gptCount){ lineTop(y,"Sem contas GPT",c.textMuted); break; }
      auto &a=g_snap.gpt[g_gptIdx];
      hasPager=g_snap.gptCount>1; cur=g_gptIdx; tot=g_snap.gptCount;
      snprintf(buf,sizeof(buf),"%s  %s  %s", a.label.empty()?"GPT":a.label.c_str(), a.plan.c_str(), a.ok?"ok":"erro");
      lineTop(y,buf,a.ok?c.good:c.bad,0.44f);
      if(!a.ok){ lineTop(y,a.error.c_str(),c.textDim,0.36f); break; }
      snprintf(buf,sizeof(buf),"Sessao %.0f%%  %s", a.sessionPercent, a.sessionResets.c_str()); lineTop(y,buf,c.text,0.38f);
      snprintf(buf,sizeof(buf),"Semana %.0f%%  %s", a.weeklyPercent, a.weeklyResets.c_str()); lineTop(y,buf,c.text,0.38f);
      break;
    }
    case VIEW_CURSOR: {
      if(!g_snap.cursorCount){ lineTop(y,"Sem Cursor",c.textMuted); break; }
      auto &a=g_snap.cursor[g_cursorIdx];
      hasPager=g_snap.cursorCount>1; cur=g_cursorIdx; tot=g_snap.cursorCount;
      snprintf(buf,sizeof(buf),"%s  %s", a.label.empty()?"Cursor":a.label.c_str(), a.plan.c_str()); lineTop(y,buf,c.text,0.44f);
      if(!a.ok){ lineTop(y,a.error.c_str(),c.bad,0.36f); break; }
      snprintf(buf,sizeof(buf),"%.0f%%  %d/%d c  bonus %d", a.percent, a.usedCents, a.limitCents, a.bonusCents); lineTop(y,buf,c.text,0.38f);
      if(a.requestsLimit>=0){ snprintf(buf,sizeof(buf),"Req %d/%d",a.requestsUsed,a.requestsLimit); lineTop(y,buf,c.textDim,0.36f); }
      lineTop(y,a.cycleEnd.c_str(),c.textDim,0.34f);
      break;
    }
    case VIEW_OPENROUTER:
    case VIEW_DEEPSEEK:
    case VIEW_FAL: {
      OpenRouterAccount *a=nullptr; const char* name="Creditos";
      if(v==VIEW_OPENROUTER && g_snap.openrouterCount){ a=(OpenRouterAccount*)&g_snap.openrouter[g_openrouterIdx]; name="OpenRouter"; hasPager=g_snap.openrouterCount>1; cur=g_openrouterIdx; tot=g_snap.openrouterCount; }
      else if(v==VIEW_DEEPSEEK && g_snap.deepseekCount){ a=(OpenRouterAccount*)&g_snap.deepseek[g_deepseekIdx]; name="DeepSeek"; hasPager=g_snap.deepseekCount>1; cur=g_deepseekIdx; tot=g_snap.deepseekCount; }
      else if(v==VIEW_FAL && g_snap.falCount){ a=(OpenRouterAccount*)&g_snap.fal[g_falIdx]; name="fal.ai"; hasPager=g_snap.falCount>1; cur=g_falIdx; tot=g_snap.falCount; }
      if(!a){ lineTop(y,"Sem contas",c.textMuted); break; }
      snprintf(buf,sizeof(buf),"%s  %s", a->label.empty()?name:a->label.c_str(), a->ok?"ok":"erro"); lineTop(y,buf,a->ok?c.good:c.bad,0.44f);
      if(!a->ok){ lineTop(y,a->error.c_str(),c.textDim,0.36f); break; }
      snprintf(buf,sizeof(buf),"%.1f%%  %d/%d c  sobra %d", a->percent, a->usedCents, a->limitCents, a->remainingCents); lineTop(y,buf,c.text,0.38f);
      break;
    }
    case VIEW_OPENCODE: {
      if(!g_snap.opencodeCount){ lineTop(y,"Sem OpenCode",c.textMuted); break; }
      auto &a=g_snap.opencode[g_opencodeIdx];
      hasPager=g_snap.opencodeCount>1; cur=g_opencodeIdx; tot=g_snap.opencodeCount;
      lineTop(y, a.label.empty()?"OpenCode":a.label.c_str(), c.text,0.44f);
      if(!a.ok){ lineTop(y,a.error.c_str(),c.bad,0.36f); break; }
      snprintf(buf,sizeof(buf),"Rolling %.0f%% %s",a.rollingPercent,a.rollingResets.c_str()); lineTop(y,buf,c.text,0.36f);
      snprintf(buf,sizeof(buf),"Semana %.0f%% %s",a.weeklyPercent,a.weeklyResets.c_str()); lineTop(y,buf,c.text,0.36f);
      snprintf(buf,sizeof(buf),"Mes %.0f%% %s",a.monthlyPercent,a.monthlyResets.c_str()); lineTop(y,buf,c.text,0.36f);
      break;
    }
    case VIEW_BITCOIN: {
      if(!g_snap.bitcoinCount){ lineTop(y,"Sem Bitcoin",c.textMuted); break; }
      auto &a=g_snap.bitcoin[g_bitcoinIdx];
      hasPager=g_snap.bitcoinCount>1; cur=g_bitcoinIdx; tot=g_snap.bitcoinCount;
      lineTop(y, a.label.empty()?"Bitcoin":a.label.c_str(), c.text,0.44f);
      if(!a.ok){ lineTop(y,a.error.c_str(),c.bad,0.36f); break; }
      snprintf(buf,sizeof(buf),"%.8f BTC",a.balanceBtc); lineTop(y,buf,c.text,0.42f);
      snprintf(buf,sizeof(buf),"US$ %.2f  BRL %.2f", a.valueUsdCents/100.0, a.valueBrlCents/100.0); lineTop(y,buf,c.textDim,0.36f);
      lineTop(y,a.address.c_str(),c.textMuted,0.30f);
      break;
    }
    case VIEW_ADSENSE: {
      if(!g_snap.adsenseCount){ lineTop(y,"Sem AdSense",c.textMuted); break; }
      auto &a=g_snap.adsense[g_adsenseIdx];
      hasPager=g_snap.adsenseCount>1; cur=g_adsenseIdx; tot=g_snap.adsenseCount;
      lineTop(y, a.label.empty()?"AdSense":a.label.c_str(), c.text,0.44f);
      if(!a.ok){ lineTop(y,a.error.c_str(),c.bad,0.36f); break; }
      snprintf(buf,sizeof(buf),"Hoje %s %.2f", a.currency.c_str(), a.todayCents/100.0); lineTop(y,buf,c.text,0.38f);
      snprintf(buf,sizeof(buf),"Saldo %.2f  %s", a.unpaidCents/100.0, a.accountName.c_str()); lineTop(y,buf,c.textDim,0.34f);
      break;
    }
    case VIEW_CURRENCIES: {
      if(!g_snap.currencies.hasData){ lineTop(y,"Sem moedas",c.textMuted); break; }
      snprintf(buf,sizeof(buf),"Base %s  %s", g_snap.currencies.base.c_str(), g_snap.currencies.ok?"ok":"erro"); lineTop(y,buf,c.text,0.42f);
      for(int i=0;i<g_snap.currencies.itemCount && y<210;i++){
        auto &q=g_snap.currencies.items[i];
        snprintf(buf,sizeof(buf),"%s %.4f %s", q.code.c_str(), q.price, q.ok?"":"(erro)");
        lineTop(y,buf,q.ok?c.text:c.bad,0.36f);
      }
      break;
    }
    case VIEW_WEATHER: {
      if(!g_snap.weather.hasData){ lineTop(y,"Sem clima",c.textMuted); break; }
      auto &w=g_snap.weather;
      snprintf(buf,sizeof(buf),"%s  %.1f%s  %s", w.locationName.c_str(), w.temperature, w.tempUnit.c_str(), w.ok?"ok":"erro"); lineTop(y,buf,c.text,0.42f);
      snprintf(buf,sizeof(buf),"Sens %.1f  Umid %.0f%%  Vento %.1f %s", w.feelsLike, w.humidity, w.windSpeed, w.windUnit.c_str()); lineTop(y,buf,c.textDim,0.36f);
      snprintf(buf,sizeof(buf),"Max %.1f  Min %.1f  Cod %d", w.tempMax, w.tempMin, w.weatherCode); lineTop(y,buf,c.textDim,0.34f);
      break;
    }
    default: lineTop(y,"View nao implementada",c.textMuted); break;
  }
  if(hasPager){
    char pg[24]; snprintf(pg,sizeof(pg),"< %d/%d > L/R",cur+1,tot);
    C2D_DrawTextSimple(260, 220, 0.36,0.36, c.textDim, pg);
  }
  // barra de conta quando ok
  if(y>36){
    float pct=-1;
    if(v==VIEW_CLAUDE && g_snap.claudeCount) pct=g_snap.claude[g_claudeIdx].sessionPercent;
    if(pct>=0){
      float w = 376 * (std::clamp(pct,0.f,100.f)/100.f);
      uint32_t col = pct>=80? c.bad : pct>=60? c.warn : c.good;
      C2D_DrawRectSolid(12, 222, 0, 376, 6, c.track);
      C2D_DrawRectSolid(12, 222, 0, w, 6, col);
    }
  }
#else
  (void)v;
#endif
}

void paintStatusTop(){
#ifdef _3DS
  UiCtx c=uiCtx();
  int y=36;
  lineTop(y,"Sistema",c.text,0.46f);
  char b[160];
  snprintf(b,sizeof(b),"Coletor: %s", g_panelUrl.c_str());
  lineTop(y,b,c.textDim,0.34f);
  snprintf(b,sizeof(b),"Poll %lus  Ultimo %s", (unsigned long)(g_pollMs/1000), g_snap.updatedAt.c_str());
  lineTop(y,b,c.textDim,0.34f);
  snprintf(b,sizeof(b),"Net: %s  HTTP %d", g_netLine.c_str(), g_httpLastCode);
  lineTop(y,b,g_httpLastError.empty()?c.good:c.bad,0.34f);
  snprintf(b,sizeof(b),"Versao %s  %s", VIGIA_VERSION, g_hasFetchedOk?"online":"offline");
  lineTop(y,b,c.textMuted,0.34f);
  lineTop(y,"X=config  Select=tema  Y=refresh",c.textMuted,0.32f);
#endif
}

void paintConfigTop(){
#ifdef _3DS
  UiCtx c=uiCtx();
  int y=36;
  lineTop(y,"Config - Coletor (LAN)",c.text,0.46f);
  lineTop(y,"Top: info  Bottom: toque para editar",c.textDim,0.34f);
  char b[160]; snprintf(b,sizeof(b),"URL: %s", g_panelUrl.c_str());
  lineTop(y,b,c.text,0.36f);
  lineTop(y,"Ex: http://192.168.1.10:8787",c.textMuted,0.32f);
  lineTop(y,"Salve e reinicie o poll (Y)",c.textDim,0.34f);
#endif
}
void paintConfigBottom(){
#ifdef _3DS
  UiCtx c=uiCtx();
  // dois botoes
  C2D_DrawRectSolid(8, 180, 0, 148, 40, c.card);
  C2D_DrawRectSolid(8, 180, 0, 148, 1, c.cardBorder);
  C2D_DrawRectSolid(8, 219, 0, 148, 1, c.cardBorder);
  C2D_DrawTextSimple(48, 194, 0.42,0.42, c.text, "Cancelar (B)");
  C2D_DrawRectSolid(164, 180, 0, 148, 40, c.accent);
  C2D_DrawTextSimple(210, 194, 0.42,0.42, c.inverse, "Salvar");
  C2D_DrawTextSimple(8, 8, 0.36,0.36, c.textDim, "Toque: editar URL (teclado 3DS)");
  C2D_DrawTextSimple(8, 28, 0.34,0.34, c.textMuted, "Use X para abrir teclado SWKBD");
#endif
}

} // namespace vigia
