// Vigia AI 3DS - entrypoint
// Equivalente a firmware/src/main.cpp:35-118, adaptado para dual-screen citro2d
// Bottom = Home touch, Top = header+detalhe. Poll GET /usage 60s.

#include "core/config.h"
#include "core/state.h"
#include "input/input.h"
#include "net/http_client.h"
#include "ui/ui.h"
#include <cstdio>
#include <string>

#ifdef _3DS
#include <3ds.h>
#endif

static void logToSD(const char *msg){
#ifdef _3DS
  FILE *f=fopen("sdmc:/3ds/vigia-ai/log.txt","a");
  if(f){ fprintf(f,"%s\n",msg); fclose(f); }
#endif
  (void)msg;
}

int main(int argc, char* argv[]){
  (void)argc;(void)argv;
#ifdef _3DS
  // log inicial para debug de crash pos-intro (volta pra HOME = main retornou cedo)
  logToSD("vigia boot");
  gfxInitDefault();
  gfxSetDoubleBuffering(GFX_TOP, true);
  gfxSetDoubleBuffering(GFX_BOTTOM, true);
  // splash de 1s so com gfx (sem citro2d) para confirmar que o binario iniciou
  {
    u8 *fbTop = gfxGetFramebuffer(GFX_TOP, GFX_LEFT, nullptr, nullptr);
    if(fbTop) memset(fbTop, 0x1E, 400*240*3);
    u8 *fbBot = gfxGetFramebuffer(GFX_BOTTOM, GFX_LEFT, nullptr, nullptr);
    if(fbBot) memset(fbBot, 0x1E, 320*240*3);
    gfxFlushBuffers(); gfxSwapBuffers(); gspWaitForVBlank();
    svcSleepThread(800*1000*1000);
  }
  logToSD("gfx ok");
#endif

  VigiaConfig cfg;
  configLoad(cfg);
  g_panelUrl = cfg.collectorUrl + "/";
  g_pollMs = 60000;

  logToSD("uiInit");
  uiInit();
  logToSD("uiInit ok");
  inputInit();
  logToSD("input ok");
  // http/sockets podem falhar sem soc:U no RSF — nao pode derrubar o app
  httpClientInit();
  logToSD("http ok");

  // health inicial para descobrir interval_s (nao bloqueia se falhar)
  httpFetchHealth(configHealthUrl(cfg));

  uiPaint();
  logToSD("first paint");

  bool running = true;
#ifdef _3DS
  int frames=0;
  while(running && aptMainLoop()){
    frames++;
    // log a cada 300 frames (~5s) para saber que o loop esta vivo
    if(frames%300==0) logToSD("loop alive");
    inputPoll();

    std::string usageUrl = configUsageUrl(cfg);
    {
      VigiaConfig cur; if(configLoad(cur)) cfg=cur;
      usageUrl = configUsageUrl(cfg);
      g_panelUrl = configPanelUrl(cfg);
    }

    if(g_requestRefresh){
      g_requestRefresh=false;
      httpFetchUsage(usageUrl);
      uiPaint();
    }
    httpClientPoll(usageUrl);

    static uint64_t lastTick=0;
    uint64_t now=osGetTime();
    if(now-lastTick>1000){ lastTick=now; uiTickClock(); }

    u32 kHeld = hidKeysHeld();
    if((kHeld & KEY_START) && (kHeld & KEY_SELECT)) running=false;
    // B sozinho volta pra HOME ja tratado em uiHandleButton, mas tambem sai aqui se HOME for pressionado
    if(kHeld & KEY_HOME) running=false;

    gspWaitForVBlank();
    svcSleepThread(16*1000*1000);
  }
  logToSD("loop exit");
#else
  printf("Vigia AI 3DS host stub - compile com devkitARM para rodar no hardware\n");
  printf("collector: %s\n", cfg.collectorUrl.c_str());
  (void)running;
#endif

  httpClientFini();
  uiShutdown();
#ifdef _3DS
  logToSD("shutdown");
  gfxExit();
#endif
  return 0;
}
