#include "input/internal.h"

#include "ui/ui.h"

void handleSerial()
{
  while (Serial.available())
  {
    char c = (char)Serial.read();
    if (c == 'n' || c == '+' || c == 'N')
    {
      uiNext();
    }
    else if (c == 'p' || c == '-' || c == 'P')
    {
      uiPrev();
    }
    else if (c >= '0' && c <= '7')
    {
      uiSetView((View)(c - '0'));
    }
    else if (c == 'r' || c == 'R')
    {
      g_requestRefresh = true;
    }
    else if (c == 'c' || c == 'C')
    {
      g_requestCalibrate = true;
    }
    else if (c == 'l' || c == 'L')
    {
      uiSetHomeLayout(HOME_LAYOUT_LIST);
    }
    else if (c == 'g' || c == 'G')
    {
      uiSetHomeLayout(HOME_LAYOUT_GRID);
    }
    else if (c == 'u' || c == 'U')
    {
      uiDetailScrollBy(-48);
    }
    else if (c == 'd' || c == 'D')
    {
      uiDetailScrollBy(48);
    }
    else if (c == 't' || c == 'T')
    {
      uiSetTheme((UiTheme)(((uint8_t)uiTheme() + 1) % 3));
    }
    else if (c == 'i' || c == 'I')
    {
      uiSetLang((UiLang)(((uint8_t)uiLang() + 1) % 3));
    }
    else if (c == 'h' || c == 'H')
    {
      uiSetHeaderEdge((HeaderEdge)(((uint8_t)uiHeaderEdge() + 1) % 4));
    }
    else if (c == 'a' || c == 'A')
    {
      uiSetAccent((UiAccent)(((uint8_t)uiAccent() + 1) % (uint8_t)ACCENT_COUNT));
    }
    else if (c == 's' || c == 'S')
    {
      // Cicla tamanho do card da view atual (ou do primeiro provider visível se em HOME)
      View v = g_view;
      if (v == VIEW_HOME || v == VIEW_STATUS || v == VIEW_NOW || v == VIEW_THEME)
      {
        if (g_snap.claudeCount > 0)
          v = VIEW_CLAUDE;
        else if (g_snap.gptCount > 0)
          v = VIEW_GPT;
        else if (g_snap.cursorCount > 0)
          v = VIEW_CURSOR;
        else
          v = VIEW_CLAUDE;
      }
      uiCycleCardSize(v);
    }
    else if (c == '1')
    {
      View v = g_view;
      if (v == VIEW_HOME || v == VIEW_STATUS)
        v = VIEW_CLAUDE;
      uiSetCardSize(v, CARD_SM);
    }
    else if (c == '2')
    {
      View v = g_view;
      if (v == VIEW_HOME || v == VIEW_STATUS)
        v = VIEW_CLAUDE;
      uiSetCardSize(v, CARD_MD);
    }
    else if (c == '3')
    {
      View v = g_view;
      if (v == VIEW_HOME || v == VIEW_STATUS)
        v = VIEW_CLAUDE;
      uiSetCardSize(v, CARD_LG);
    }
    else if (c == '4')
    {
      View v = g_view;
      if (v == VIEW_HOME || v == VIEW_STATUS)
        v = VIEW_CLAUDE;
      uiSetCardSize(v, CARD_XL);
    }
    else if (c == '5')
    {
      View v = g_view;
      if (v == VIEW_HOME || v == VIEW_STATUS)
        v = VIEW_CLAUDE;
      uiSetCardSize(v, CARD_WL);
    }
    else if (c == '6')
    {
      View v = g_view;
      if (v == VIEW_HOME || v == VIEW_STATUS)
        v = VIEW_CLAUDE;
      uiSetCardSize(v, CARD_WXL);
    }
  }
}
