#pragma once

#include <Arduino.h>
#include <TFT_eSPI.h>

enum View : uint8_t
{
  VIEW_HOME = 0,
  VIEW_CLAUDE = 1,
  VIEW_CURSOR = 2,
  VIEW_OPENROUTER = 3,
  VIEW_DEEPSEEK = 4,
  VIEW_GPT = 5,
  VIEW_STATUS = 6,
  VIEW_NOW = 7,
  VIEW_OPENCODE_GO = 8,
  VIEW_OPENCODE_ZEN = 9,
  VIEW_FAL = 10,
  VIEW_COUNT = 11
};

// Cada provedor pode ter varias contas (ex.: Claude pessoal + Claude da
// empresa), cada uma com um `id` estavel e um `label` (apelido) opcional —
// ver docs/CONTRATO_JSON.md. MAX_ACCOUNTS limita quantas o firmware guarda
// por provedor; o coletor pode ter mais configuradas, as excedentes so nao
// aparecem na placa (log serial, nunca trava).
constexpr int MAX_ACCOUNTS = 5;

struct ClaudeAccount
{
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

struct GptAccount
{
  String id;
  String label;
  bool ok = false;
  String error;
  float sessionPercent = -1;
  String sessionResets;
  float weeklyPercent = -1;
  String weeklyResets;
  String plan;
};

struct CursorAccount
{
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

struct OpenRouterAccount
{
  String id;
  String label;
  bool ok = false;
  String error;
  float percent = -1;
  int limitCents = -1;
  int usedCents = -1;
  int remainingCents = -1;
};

struct DeepSeekAccount
{
  String id;
  String label;
  bool ok = false;
  String error;
  float percent = -1;
  int limitCents = -1;
  int usedCents = -1;
  int remainingCents = -1;
};

struct OpenCodeGoAccount
{
  String id;
  String label;
  bool ok = false;
  String error;
  float rollingPercent = -1;
  String rollingResets;
  float weeklyPercent = -1;
  String weeklyResets;
  float monthlyPercent = -1;
  String monthlyResets;
};

struct OpenCodeZenAccount
{
  String id;
  String label;
  bool ok = false;
  String error;
  float percent = -1;
  int limitCents = -1;
  int usedCents = -1;
  int remainingCents = -1;
};

struct FalAccount
{
  String id;
  String label;
  bool ok = false;
  String error;
  float percent = -1;
  int limitCents = -1;
  int usedCents = -1;
  int remainingCents = -1;
};

struct UsageSnapshot
{
  bool httpOk = false;
  String statusLine;
  String updatedAt;
  ClaudeAccount claude[MAX_ACCOUNTS];
  int claudeCount = 0;
  GptAccount gpt[MAX_ACCOUNTS];
  int gptCount = 0;
  CursorAccount cursor[MAX_ACCOUNTS];
  int cursorCount = 0;
  OpenRouterAccount openrouter[MAX_ACCOUNTS];
  int openrouterCount = 0;
  DeepSeekAccount deepseek[MAX_ACCOUNTS];
  int deepseekCount = 0;
  OpenCodeGoAccount opencode_go[MAX_ACCOUNTS];
  int opencode_goCount = 0;
  OpenCodeZenAccount opencode_zen[MAX_ACCOUNTS];
  int opencode_zenCount = 0;
  FalAccount fal[MAX_ACCOUNTS];
  int falCount = 0;
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
