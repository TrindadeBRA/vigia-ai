#include "mining_client.h"

#include "core/state.h"
#include "mining/mining_log.h"
#include "mining/mining_task.h"

#ifdef WOKWI_SIM
#define USAGE_URL "http://host.wokwi.internal:8787/usage"
#else
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define USAGE_URL "http://192.168.1.10:8787/usage"
#endif
#endif

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>

namespace
{

// Mesma derivação de origem que net/client.cpp usa pro tema — cada módulo
// de rede mantém a própria cópia porque USAGE_URL vem de secrets.h,
// incluído por arquivo (ver comentário ali).
String apiBase()
{
  String u = USAGE_URL;
  if (u.endsWith("/usage"))
  {
    u.remove(u.length() - 6);
  }
  if (!u.endsWith("/"))
  {
    u += "/";
  }
  return u;
}

const char *statusToString(MiningStatus s)
{
  switch (s)
  {
  case MiningStatus::NoWifi:
    return "no_wifi";
  case MiningStatus::Connecting:
    return "connecting";
  case MiningStatus::Mining:
    return "mining";
  case MiningStatus::PoolOffline:
    return "pool_offline";
  case MiningStatus::Error:
    return "error";
  case MiningStatus::Idle:
  default:
    return "idle";
  }
}

bool sameConfig(const MiningConfig &a, const MiningConfig &b)
{
  return a.enabled == b.enabled && a.poolUrl == b.poolUrl && a.poolPort == b.poolPort &&
         a.btcWallet == b.btcWallet && a.workerName == b.workerName;
}

MiningConfig fetchConfig()
{
  MiningConfig cfg; // default: desligada
  if (WiFi.status() != WL_CONNECTED)
  {
    return cfg;
  }

  HTTPClient http;
  http.setTimeout(3000);
  http.setConnectTimeout(2000);
  String url = apiBase() + "api/mining/config";
  if (!http.begin(url))
  {
    return cfg;
  }
  int code = http.GET();
  if (code != 200)
  {
    Serial.printf("[mining] GET /api/mining/config -> HTTP %d\n", code);
    http.end();
    return cfg;
  }
  String body = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, body))
  {
    Serial.println("[mining] config do coletor inválida");
    return cfg;
  }
  cfg.enabled = doc["enabled"] | false;
  cfg.poolUrl = String((const char *)(doc["poolUrl"] | "public-pool.io"));
  cfg.poolPort = doc["poolPort"] | 3333;
  cfg.btcWallet = String((const char *)(doc["btcWallet"] | ""));
  cfg.workerName = String((const char *)(doc["workerName"] | ""));
  return cfg;
}

void postReport()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    return;
  }
  MiningReport r = miningTaskGetReport();

  JsonDocument doc;
  doc["status"] = statusToString(r.status);
  doc["hashrateCurrent"] = r.hashrateCurrent;
  doc["hashrateAvg"] = r.hashrateAvg;
  doc["sharesAccepted"] = r.sharesAccepted;
  doc["sharesRejected"] = r.sharesRejected;
  doc["bestDifficulty"] = r.bestDifficulty;
  doc["blockHeight"] = r.blockHeight;
  doc["uptimeS"] = r.uptimeS;
  doc["lastError"] = r.lastError;
  {
    String lines[MINING_LOG_MAX_LINES];
    int n = miningLogSnapshot(lines);
    JsonArray logArr = doc["log"].to<JsonArray>();
    for (int i = 0; i < n; i++)
    {
      logArr.add(lines[i]);
    }
  }
  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.setTimeout(3000);
  http.setConnectTimeout(2000);
  String url = apiBase() + "api/mining/report";
  if (!http.begin(url))
  {
    return;
  }
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  if (code != 200)
  {
    Serial.printf("[mining] POST /api/mining/report -> HTTP %d\n", code);
  }
  http.end();
}

constexpr uint32_t kConfigRefetchMs = 20000;
constexpr uint32_t kReportPostMs = 10000;
uint32_t g_lastConfigFetchMs = 0;
uint32_t g_lastReportPostMs = 0;
MiningConfig g_lastAppliedConfig; // config que a task de mineração está usando agora

} // namespace

void miningClientEnterView()
{
  MiningConfig cfg = fetchConfig();
  g_lastAppliedConfig = cfg;
  g_lastConfigFetchMs = millis();
  g_lastReportPostMs = 0; // manda um report logo, não espera o intervalo cheio
  miningTaskStart(cfg);
}

void miningClientExitView()
{
  miningTaskStop();
}

void miningClientPoll()
{
  if (g_view != VIEW_MINER)
  {
    return;
  }
  uint32_t now = millis();
  if (now - g_lastConfigFetchMs > kConfigRefetchMs)
  {
    g_lastConfigFetchMs = now;
    MiningConfig cfg = fetchConfig();
    // Só reinicia a task se algo relevante mudou — miningTaskStart() zera
    // os contadores (hashrate, shares, melhor dificuldade), então chamar
    // sem necessidade a cada 20s destruiria as estatísticas da sessão.
    if (!sameConfig(cfg, g_lastAppliedConfig))
    {
      g_lastAppliedConfig = cfg;
      miningTaskStart(cfg);
    }
  }
  if (now - g_lastReportPostMs > kReportPostMs)
  {
    g_lastReportPostMs = now;
    postReport();
  }
}
