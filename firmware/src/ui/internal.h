#pragma once

#include "ui/ui.h"
#include "ui/widgets.h"

// Estado e funções internas da UI, compartilhados entre o controlador
// (nav.cpp), o layout/header e as views. Não faz parte da API pública de
// ui.h — main.cpp e input/ não incluem este header.

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
// Ícone de relógio no meio da barra (mesmo destino do horário: VIEW_NOW).
// g_clockIconR == 0 → não desenhado (vão curto demais).
extern int g_clockIconCx;
extern int g_clockIconCy;
extern int g_clockIconR;
// Geometria do olho da marca no header, preenchida por drawHeader() a cada
// pintura — uiTickEye() usa pra saber onde redesenhar só a pupila animada.
extern int g_eyeCx;
extern int g_eyeCy;
extern int g_eyeR;
// Desvio atual da pupila (px a partir do centro), animado por uiTickEye() —
// drawHeader() reaproveita pra não "teleportar" o olhar de volta ao centro
// a cada redesenho periódico do header (contador, refresh etc).
extern int g_eyeGazeX;
extern int g_eyeGazeY;
// Retangulos de toque dos cards da Início, preenchidos por paintHomeList()/
// paintHomeGrid() a cada pintura — só os provedores com pelo menos uma conta
// entram aqui, na ordem em que foram desenhados. uiHandleTap() percorre esta
// lista em vez de assumir posições fixas.
constexpr int MAX_HOME_CARDS = 7;
extern View g_homeCardView[MAX_HOME_CARDS];
extern int g_homeCardX[MAX_HOME_CARDS];
extern int g_homeCardY[MAX_HOME_CARDS];
extern int g_homeCardW[MAX_HOME_CARDS];
extern int g_homeCardH[MAX_HOME_CARDS];
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

// Qual conta de cada provedor esta aberta no detalhe (indice em
// g_snap.claude[]/cursor[]/etc.) — uiSetView() reseta pra "a que mais precisa
// de atencao" (ver claudeWorstIdx() etc.) toda vez que entra na view vindo de
// outra; o paginador (uiAccountStep(), abaixo) so move dentro da view atual.
extern int g_claudeIdx;
extern int g_gptIdx;
extern int g_cursorIdx;
extern int g_openrouterIdx;
extern int g_deepseekIdx;
extern int g_opencodeIdx;

// Geometria do paginador "< i/N >" no topo do card de detalhe — só existe
// (g_acctPagerVisible) quando o provedor tem mais de uma conta.
extern bool g_acctPagerVisible;
extern int g_acctPagerLeftX0;
extern int g_acctPagerLeftX1;
extern int g_acctPagerRightX0;
extern int g_acctPagerRightX1;
extern int g_acctPagerY;
extern int g_acctPagerH;

// Indice da conta que mais precisa de atencao (maior percentual) — usado
// pelo card compacto da Início e como ponto de entrada ao abrir o detalhe.
int claudeWorstIdx();
int gptWorstIdx();
int cursorWorstIdx();
int openrouterWorstIdx();
int deepseekWorstIdx();
int opencodeWorstIdx();

// Segundos até o próximo refresh automático (-1 = sem polling ativo) e se o
// selo do header deve mostrar o check verde de sucesso em vez do contador.
int countdownSeconds();
bool showFetchOkCheck();
int headerDisplayKey(int secs, bool showCheck);
void drawCountdownBadgeAt(int cx, int cy, int secs);

void layoutContent();
void drawHeader();
void paintHome();
void paintClaude();
void paintGpt();
void paintCursor();
void paintOpenRouter();
void paintDeepSeek();
void paintOpenCode();
void paintStatus();
void paintNow();
void paintNowClock();
// Move o paginador de contas da view de detalhe atual (dir -1/+1); sem
// efeito se a view atual nao tiver mais de uma conta.
void uiAccountStep(int dir);

// Rótulos e títulos compartilhados entre Início, Agora e telas de detalhe.
String withResta(float pct, const String &whenRaw);
String gptPlanTitle(const GptAccount &g);
String cursorPlanTitle(const CursorAccount &c);
String accountSuffixText(const String &label, int count);
void drawTitleWithLabel(int x, int y, int maxW, const String &name, const String &suffix);
int stackedTitleHeight(bool hasLabel);
void drawStackedTitle(int x, int y, int maxW, const String &name, const String &suffix);
String cursorOndemand(const CursorAccount &c);
String openrouterRemain(const OpenRouterAccount &o);
String openrouterBalance(const OpenRouterAccount &o);
String deepseekRemain(const DeepSeekAccount &d);
String deepseekBalance(const DeepSeekAccount &d);
String opencodeRemain(const OpenCodeAccount &o);
String opencodeBalance(const OpenCodeAccount &o);
const char *emptyProvidersMsg();

// Chrome das telas de detalhe / Sistema (card com scroll).
extern int dX;
extern int dW;
extern int dClipTop;
extern int dClipH;
extern int dCursor;
int dScreenY();
bool dVisible(int h);
void dAdvance(int h);
void dKv(const char *k, const String &v);
void dNote(const String &s);
void dPanelQr(const String &url);
void dBar(const char *title, float pct, const String &sub);
void dGap();
void dSection(const char *title);
void beginScrollCard(const char *title, const String &suffix, const uint16_t *icon,
                     int pagerCount = 0, int pagerIdx = 0);
bool paintDetailChrome(const char *title, const String &suffix, const uint16_t *icon, bool ok,
                       const String &err, int pagerCount = 0, int pagerIdx = 0);
void paintDetailFinish();
