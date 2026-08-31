#pragma once

#include "ui.h"

// Estado e funções internas da UI, compartilhados só entre ui.cpp (controlador
// de navegação/toque) e ui_views.cpp (pintura de cada view). Não faz parte da
// API pública de ui.h — main.cpp e input.cpp não incluem este header.

extern int g_navTop;
extern int g_headerH;
extern int g_homeSplitY;
extern bool g_statusHasCal;
extern bool g_statusHasRefresh;
extern int g_btnCalY;
extern int g_btnRefY;
extern int g_btnH;
extern int g_lastHeaderKey;

// Segundos até o próximo refresh automático (-1 = sem polling ativo) e se o
// selo do header deve mostrar o check verde de sucesso em vez do contador.
int countdownSeconds();
bool showFetchOkCheck();
int headerDisplayKey(int secs, bool showCheck);

void drawHeader();
void drawNav();
void paintHome();
void paintClaude();
void paintCursor();
void paintStatus();
