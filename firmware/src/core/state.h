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
  VIEW_OPENCODE = 8,
  VIEW_FAL = 9,
  VIEW_BITCOIN = 10,
  // Tema custom (protótipo) — tela cheia, sem header, ver ui/customtheme.h.
  // Só entra por gatilho explícito (botão de recarregar ou tema recebido),
  // nunca pelo swipe/paginação normal de views.
  VIEW_THEME = 11,
  VIEW_ADSENSE = 12,
  VIEW_CURRENCIES = 13,
  VIEW_WEATHER = 14,
  VIEW_COUNT = 15
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

struct OpenCodeAccount
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

struct BitcoinAccount
{
  String id;
  String label;
  bool ok = false;
  String error;
  String address;
  float balanceBtc = -1;
  int priceUsdCents = -1;
  int priceBrlCents = -1;
  int valueUsdCents = -1;
  int valueBrlCents = -1;
};

struct AdsenseAccount
{
  String id;
  String label;
  bool ok = false;
  String error;
  String currency;
  int todayCents = -1;
  int unpaidCents = -1;
  String accountName;
};

struct WeatherData
{
  bool hasData = false;
  bool ok = false;
  String error;
  float temperature = -999;
  float feelsLike = -999;
  float humidity = -1;
  float windSpeed = -1;
  float precipitation = -1;
  float tempMax = -999;
  float tempMin = -999;
  int weatherCode = -1;
  String tempUnit = "C";
  String windUnit = "km/h";
  String precipUnit = "mm";
  String locationName = "";
};

// Cotação de moedas: um único card com N itens (fiat + cripto), não uma
// lista de contas. MAX_CURRENCY_ITEMS limita o que a placa guarda; o
// coletor pode ter mais, o resto só não aparece (log serial, nunca trava).
constexpr int MAX_CURRENCY_ITEMS = 8;

struct CurrencyQuote
{
  String id;
  String kind;
  String code;
  String label;
  float price = -1;
  bool ok = false;
  String error;
};

struct CurrenciesData
{
  bool hasData = false;
  bool ok = false;
  String error;
  String base = "BRL";
  CurrencyQuote items[MAX_CURRENCY_ITEMS];
  int itemCount = 0;
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
