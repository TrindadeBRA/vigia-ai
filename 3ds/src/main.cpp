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

int main(int argc, char* argv[]){
  (void)argc;(void)argv;
#ifdef _3DS
  gfxInitDefault();
  // consoleDebugInit separada nao conflita com citro2d? Usa GFX_TOP debug; citro2d usa topTarget — ok se nao misturar.
  // Sem aptMainLoop antigo: usamos aptMainLoop()
#endif

  VigiaConfig cfg;
  configLoad(cfg);
  g_panelUrl = cfg.collectorUrl + "/";
  g_pollMs = 60000;

  uiInit();
  inputInit();
  httpClientInit();

  // health inicial para descobrir interval_s (nao bloqueia se falhar)
  httpFetchHealth(configHealthUrl(cfg));

  uiPaint();

  bool running = true;
#ifdef _3DS
  while(running && aptMainLoop()){
    inputPoll();

    // rede
    std::string usageUrl = configUsageUrl(cfg);
    // se config mudou via teclado, recarrega
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

    // tick header a cada 1s (uiTickClock)
    static uint64_t lastTick=0;
    uint64_t now=osGetTime();
    if(now-lastTick>1000){ lastTick=now; uiTickClock(); }

    // hid exit: START+SELECT ou HOME
    u32 kHeld = hidKeysHeld();
    if((kHeld & KEY_START) && (kHeld & KEY_SELECT)) running=false;

    // citro2d ja faz double-buffer no uiPaint; aqui so espera VBlank
    gspWaitForVBlank();
    // uiPaint ja desenha quando necessario; para animacao continua precisa
    // chamar C3D_Frame* — uiPaint faz isso. Sem mudanca, dorme:
    svcSleepThread(16*1000*1000); // ~60fps tick
  }
#else
  printf("Vigia AI 3DS host stub - compile com devkitARM para rodar no hardware\n");
  printf("collector: %s\n", cfg.collectorUrl.c_str());
  (void)running;
#endif

  httpClientFini();
  uiShutdown();
#ifdef _3DS
  gfxExit();
#endif
  return 0;
}
