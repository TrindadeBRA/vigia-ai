#include "input.h"
#include "../ui/ui.h"
#include "../core/config.h"
#include "../core/state.h"
#include <string>
#include <cstring>

#ifdef _3DS
#include <3ds.h>

void inputInit(){}

static void openSwkbdForCollectorUrl(){
  SwkbdState swkbd;
  char out[256]={0};
  VigiaConfig cfg; configLoad(cfg);
  swkbdInit(&swkbd, SWKBD_TYPE_NORMAL, 2, -1);
  swkbdSetValidation(&swkbd, SWKBD_NOTEMPTY_NOTBLANK, 0, 0);
  swkbdSetHintText(&swkbd, "http://192.168.1.10:8787");
  swkbdSetInitialText(&swkbd, cfg.collectorUrl.c_str());
  SwkbdButton btn = swkbdInputText(&swkbd, out, sizeof(out));
  if(btn==SWKBD_BUTTON_CONFIRM){
    std::string s(out);
    // trim
    while(!s.empty() && (s.back()==' '||s.back()=='\n'||s.back()=='\r')) s.pop_back();
    size_t a=s.find_first_not_of(" \t\n\r");
    if(a!=std::string::npos) s=s.substr(a);
    if(!s.empty()){
      // garante http://
      if(s.rfind("http://",0)!=0 && s.rfind("https://",0)!=0) s="http://"+s;
      while(!s.empty() && s.back()=='/') s.pop_back();
      cfg.collectorUrl=s;
      configSave(cfg);
      g_panelUrl = cfg.collectorUrl + "/";
    }
  }
}

void inputPoll(){
  hidScanInput();
  u32 kDown = hidKeysDown();
  if(kDown) uiHandleButton(kDown);

  // trata X fora de uiHandleButton para abrir teclado com acesso a config
  if(kDown & KEY_X){
    // se ja em config, abre teclado direto
    if(uiGetView()==VIEW_CONFIG) openSwkbdForCollectorUrl();
  }

  touchPosition tp;
  hidTouchRead(&tp);
  if(kDown & KEY_TOUCH){
    uiHandleTouch((int16_t)tp.px, (int16_t)tp.py, true);
  }
}

#else
void inputInit(){}
void inputPoll(){}
#endif
