#pragma once

#include <Arduino.h>
#include <TFT_eSPI.h>

enum View : uint8_t {
  VIEW_HOME = 0,
  VIEW_CLAUDE = 1,
  VIEW_CURSOR = 2,
  VIEW_OPENROUTER = 3,
  VIEW_DEEPSEEK = 4,
  VIEW_STATUS = 5,
  VIEW_NOW = 6,
  VIEW_COUNT = 7
};

// Cada provedor pode ter varias contas (ex.: Claude pessoal + Claude da
// empresa), cada uma com um `id` estavel e um `label` (apelido) opcional —
// ver docs/CONTRATO_JSON.md. MAX_ACCOUNTS limita quantas o firmware guarda
// por provedor; o coletor pode ter mais configuradas, as excedentes so nao
// aparecem na placa (log serial, nunca trava).
constexpr int MAX_ACCOUNTS = 5;

struct ClaudeAccount {
  String id;
  String label;
  bool ok = false;
  String error;
  float sessionPercent = -1;
  String sessionResets;
  float weeklyPercent = -1;
  String weeklyResets;
  float sonnetPercent = -1;
  String sonnetResets;
  float opusPercent = -1;
  String opusResets;
};

struct CursorAccount {
  String id;
  String label;
  bool ok = false;
  String error;
  float percent = -1;
  float otherPercent = -1;
  int usedCents = -1;
  int limitCents = -1;
  int remainingCents = -1;
  int bonusCents = -1;
  int requestsUsed = -1;
  int requestsLimit = -1;
  String cycleEnd;
  String plan;
};

struct OpenRouterAccount {
  String id;
  String label;
  bool ok = false;
  String error;
  float percent = -1;
  int limitCents = -1;
  int usedCents = -1;
  int remainingCents = -1;
};

struct DeepSeekAccount {
  String id;
  String label;
  bool ok = false;
  String error;
  float percent = -1;
  int limitCents = -1;
  int usedCents = -1;
  int remainingCents = -1;
};

struct UsageSnapshot {
  bool httpOk = false;
  String statusLine;
  String updatedAt;
  ClaudeAccount claude[MAX_ACCOUNTS];
  int claudeCount = 0;
  CursorAccount cursor[MAX_ACCOUNTS];
  int cursorCount = 0;
  OpenRouterAccount openrouter[MAX_ACCOUNTS];
  int openrouterCount = 0;
  DeepSeekAccount deepseek[MAX_ACCOUNTS];
  int deepseekCount = 0;
};

extern TFT_eSPI tft;
extern UsageSnapshot g_snap;
extern View g_view;
extern bool g_requestRefresh;
extern bool g_requestCalibrate;
extern String g_netLine;
// URL absoluta do painel na LAN (`http://IP:porta/`) — QR da tela Sistema.
extern String g_panelUrl;
extern uint32_t g_lastFetchMs;
extern uint32_t g_pollMs;
extern bool g_hasFetchedOk;
extern uint32_t g_lastFetchOkMs;
