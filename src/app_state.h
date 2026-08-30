#pragma once

#include <Arduino.h>
#include <TFT_eSPI.h>

enum View : uint8_t {
  VIEW_HOME = 0,
  VIEW_CLAUDE = 1,
  VIEW_CURSOR = 2,
  VIEW_STATUS = 3,
  VIEW_COUNT = 4
};

struct ClaudeUsage {
  bool ok = false;
  String error;
  float sessionPercent = -1;
  String sessionResets;
  float weeklyPercent = -1;
  String weeklyResets;
};

struct CursorUsage {
  bool ok = false;
  String error;
  float percent = -1;
  int usedCents = -1;
  int limitCents = -1;
  String cycleEnd;
  String plan;
};

struct UsageSnapshot {
  bool httpOk = false;
  String statusLine;
  String updatedAt;
  ClaudeUsage claude;
  CursorUsage cursor;
};

extern TFT_eSPI tft;
extern UsageSnapshot g_snap;
extern View g_view;
extern bool g_requestRefresh;
extern bool g_requestCalibrate;
extern String g_netLine;
