#pragma once
// Port de firmware/src/core/state.h:6-271 para 3DS.
// STD apenas (sem Arduino / TFT_eSPI). Mantem contrato JSON 1:1
// (backend/src/schemas/usage.ts + CONTRATO_JSON.md).

#include <string>
#include <cstdint>

#ifndef VIGIA_VERSION
#define VIGIA_VERSION "1.0.0"
#endif

enum View : uint8_t {
  VIEW_HOME = 0,
  VIEW_CLAUDE = 1,
  VIEW_CURSOR = 2,
  VIEW_OPENROUTER = 3,
  VIEW_DEEPSEEK = 4,
  VIEW_GPT = 5,
  VIEW_STATUS = 6,
  VIEW_NOW = 7,
  VIEW_OPENCODE = 8,
  VIEW_FAL = 9,
  VIEW_BITCOIN = 10,
  VIEW_THEME = 11,
  VIEW_ADSENSE = 12,
  VIEW_CURRENCIES = 13,
  VIEW_WEATHER = 14,
  VIEW_MINER = 15,
  VIEW_CAMERAS = 16,
  VIEW_CAMERA = 17,
  VIEW_CONFIG = 18, // 3DS: tela de IP do coletor (nao existe no ESP32)
  VIEW_COUNT = 19
};

constexpr int MAX_ACCOUNTS = 5;
constexpr int MAX_CURRENCY_ITEMS = 8;

struct ClaudeAccount {
  std::string id;
  std::string label;
  bool ok = false;
  std::string error;
  float sessionPercent = -1;
  std::string sessionResets;
  float weeklyPercent = -1;
  std::string weeklyResets;
  float sonnetPercent = -1;
  std::string sonnetResets;
  float opusPercent = -1;
  std::string opusResets;
};

struct GptAccount {
  std::string id;
  std::string label;
  bool ok = false;
  std::string error;
  float sessionPercent = -1;
  std::string sessionResets;
  float weeklyPercent = -1;
  std::string weeklyResets;
  std::string plan;
};

struct CursorAccount {
  std::string id;
  std::string label;
  bool ok = false;
  std::string error;
  float percent = -1;
  float otherPercent = -1;
  int usedCents = -1;
  int limitCents = -1;
  int remainingCents = -1;
  int bonusCents = -1;
  int requestsUsed = -1;
  int requestsLimit = -1;
  std::string cycleEnd;
  std::string plan;
};

struct OpenRouterAccount {
  std::string id;
  std::string label;
  bool ok = false;
  std::string error;
  float percent = -1;
  int limitCents = -1;
  int usedCents = -1;
  int remainingCents = -1;
};

struct DeepSeekAccount {
  std::string id;
  std::string label;
  bool ok = false;
  std::string error;
  float percent = -1;
  int limitCents = -1;
  int usedCents = -1;
  int remainingCents = -1;
};

struct OpenCodeAccount {
  std::string id;
  std::string label;
  bool ok = false;
  std::string error;
  float rollingPercent = -1;
  std::string rollingResets;
  float weeklyPercent = -1;
  std::string weeklyResets;
  float monthlyPercent = -1;
  std::string monthlyResets;
  float percent = -1;
  int limitCents = -1;
  int usedCents = -1;
  int remainingCents = -1;
};

struct FalAccount {
  std::string id;
  std::string label;
  bool ok = false;
  std::string error;
  float percent = -1;
  int limitCents = -1;
  int usedCents = -1;
  int remainingCents = -1;
};

struct BitcoinAccount {
  std::string id;
  std::string label;
  bool ok = false;
  std::string error;
  std::string address;
  float balanceBtc = -1;
  int priceUsdCents = -1;
  int priceBrlCents = -1;
  int valueUsdCents = -1;
  int valueBrlCents = -1;
};

struct AdsenseAccount {
  std::string id;
  std::string label;
  bool ok = false;
  std::string error;
  std::string currency;
  int todayCents = -1;
  int unpaidCents = -1;
  std::string accountName;
};

struct WeatherData {
  bool hasData = false;
  bool ok = false;
  std::string error;
  float temperature = -999;
  float feelsLike = -999;
  float humidity = -1;
  float windSpeed = -1;
  float precipitation = -1;
  float tempMax = -999;
  float tempMin = -999;
  int weatherCode = -1;
  std::string tempUnit = "C";
  std::string windUnit = "km/h";
  std::string precipUnit = "mm";
  std::string locationName;
};

struct CurrencyQuote {
  std::string id;
  std::string kind;
  std::string code;
  std::string label;
  float price = -1;
  bool ok = false;
  std::string error;
};

struct CurrenciesData {
  bool hasData = false;
  bool ok = false;
  std::string error;
  std::string base = "BRL";
  CurrencyQuote items[MAX_CURRENCY_ITEMS];
  int itemCount = 0;
};

// Snapshot global - equivalente a firmware g_snap.
struct UsageSnapshot {
  bool httpOk = false;
  std::string statusLine;
  std::string updatedAt;
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
  OpenCodeAccount opencode[MAX_ACCOUNTS];
  int opencodeCount = 0;
  FalAccount fal[MAX_ACCOUNTS];
  int falCount = 0;
  BitcoinAccount bitcoin[MAX_ACCOUNTS];
  int bitcoinCount = 0;
  AdsenseAccount adsense[MAX_ACCOUNTS];
  int adsenseCount = 0;
  WeatherData weather;
  CurrenciesData currencies;
};

extern UsageSnapshot g_snap;
extern View g_view;
extern bool g_requestRefresh;
extern std::string g_netLine;
extern std::string g_panelUrl;
extern uint64_t g_lastFetchMs;
extern uint64_t g_pollMs; // ms entre GET /usage (default 60000)
extern bool g_hasFetchedOk;
extern uint64_t g_lastFetchOkMs;

// paginador por provedor (nav.cpp)
extern int g_claudeIdx, g_gptIdx, g_cursorIdx, g_openrouterIdx, g_deepseekIdx;
extern int g_opencodeIdx, g_falIdx, g_bitcoinIdx, g_adsenseIdx;
