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

struct ClaudeUsage {
  bool ok = false;
  bool configured = true;
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

struct CursorUsage {
  bool ok = false;
  bool configured = true;
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

struct OpenRouterUsage {
  bool ok = false;
  bool configured = true;
  String error;
  float percent = -1;
  int limitCents = -1;
  int usedCents = -1;
  int remainingCents = -1;
};

struct DeepSeekUsage {
  bool ok = false;
  bool configured = true;
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
  ClaudeUsage claude;
  CursorUsage cursor;
  OpenRouterUsage openrouter;
  DeepSeekUsage deepseek;
};

extern TFT_eSPI tft;
extern UsageSnapshot g_snap;
extern View g_view;
extern bool g_requestRefresh;
extern bool g_requestCalibrate;
extern String g_netLine;
extern uint32_t g_lastFetchMs;
extern uint32_t g_pollMs;
extern bool g_hasFetchedOk;
extern uint32_t g_lastFetchOkMs;
