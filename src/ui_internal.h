#pragma once

#include "ui.h"

// Estado e funções internas da UI, compartilhados só entre ui.cpp (controlador
// de navegação/toque) e ui_views.cpp (pintura de cada view). Não faz parte da
// API pública de ui.h — main.cpp e input.cpp não incluem este header.

extern int g_headerH;
extern int g_headerHomeX1;
extern int g_headerInfoX0;
extern int g_headerInfoX1;
extern int g_homeSplitX;
extern int g_homeSplitY;
extern int g_homeSplitY1;
extern int g_homeSplitY2;
extern HomeLayout g_homeLayout;
extern bool g_statusHasCal;
extern bool g_statusHasRefresh;
extern int g_btnCalY;
extern int g_btnRefY;
extern int g_btnH;
extern int g_layoutBtnY;
extern int g_layoutBtnH;
extern int g_layoutMidX;
extern int g_themeBtnY;
extern int g_themeBtnH;
extern int g_themeSplit1;
extern int g_themeSplit2;
extern int g_langBtnY;
extern int g_langBtnH;
extern int g_langSplit1;
extern int g_langSplit2;
extern int g_lastHeaderKey;
extern int g_detailScroll;
extern int g_detailMaxScroll;
extern int g_detailClipTop;
extern int g_detailClipH;
extern int g_detailContentX;
extern int g_detailContentW;
extern int g_arrowX;
extern int g_arrowUpY;
extern int g_arrowDownY;
extern int g_arrowS;
extern bool g_detailCanScroll;

// Segundos até o próximo refresh automático (-1 = sem polling ativo) e se o
// selo do header deve mostrar o check verde de sucesso em vez do contador.
int countdownSeconds();
bool showFetchOkCheck();
int headerDisplayKey(int secs, bool showCheck);

void drawHeader();
void paintHome();
void paintClaude();
void paintCursor();
void paintOpenRouter();
void paintStatus();
