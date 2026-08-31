#pragma once

#include "ui.h"

// Estado e funções internas da UI, compartilhados só entre ui.cpp (controlador
// de navegação/toque) e ui_views.cpp (pintura de cada view). Não faz parte da
// API pública de ui.h — main.cpp e input.cpp não incluem este header.

extern int g_headerH;
extern int g_contentX;
extern int g_contentY;
extern int g_contentW;
extern int g_contentH;
extern int g_hdrX0;
extern int g_hdrY0;
extern int g_hdrX1;
extern int g_hdrY1;
extern int g_headerHomeX0;
extern int g_headerHomeY0;
extern int g_headerHomeX1;
extern int g_headerHomeY1;
extern int g_headerInfoX0;
extern int g_headerInfoY0;
extern int g_headerInfoX1;
extern int g_headerInfoY1;
extern int g_headerClockX0;
extern int g_headerClockY0;
extern int g_headerClockX1;
extern int g_headerClockY1;
// Geometria do olho da marca no header, preenchida por drawHeader() a cada
// pintura — uiTickEye() usa pra saber onde redesenhar só a pupila animada.
extern int g_eyeCx;
extern int g_eyeCy;
extern int g_eyeR;
// Desvio atual da pupila (px a partir do centro), animado por uiTickEye() em
// ui.cpp — drawHeader() reaproveita pra não "teleportar" o olhar de volta ao
// centro a cada redesenho periódico do header (contador, refresh etc).
extern int g_eyeGazeX;
extern int g_eyeGazeY;
// Retangulos de toque dos cards da Início, preenchidos por paintHomeList()/
// paintHomeGrid() a cada pintura — só os provedores com `configured=true`
// entram aqui, na ordem em que foram desenhados. uiHandleTap() percorre esta
// lista em vez de assumir 4 posições fixas.
extern View g_homeCardView[4];
extern int g_homeCardX[4];
extern int g_homeCardY[4];
extern int g_homeCardW[4];
extern int g_homeCardH[4];
extern int g_homeCardCount;
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
extern int g_accentBtnY;
extern int g_accentBtnH;
extern int g_accentX0;
extern int g_accentCellW;
extern int g_accentGap;
extern int g_langBtnY;
extern int g_langBtnH;
extern int g_langSplit1;
extern int g_langSplit2;
extern int g_edgeRow1Y;
extern int g_edgeRow2Y;
extern int g_edgeMidX;
extern int g_edgeBtnH;
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

void layoutContent();
void drawHeader();
void paintHome();
void paintClaude();
void paintCursor();
void paintOpenRouter();
void paintDeepSeek();
void paintStatus();
void paintNow();
void paintNowClock();
