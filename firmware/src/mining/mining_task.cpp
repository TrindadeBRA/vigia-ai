// Adaptado de NerdMiner_v2/src/mining.cpp (MIT, Bitmaker): mantém só o
// worker de software (sem HARDWARE_SHA265 — os hacks de registrador SHA
// variam por variante de ESP32 e são a parte mais frágil do NerdMiner
// original; numa "loteria" de baixo hashrate o custo não compensa o risco)
// e sem I2C_SLAVE/RANDOM_NONCE (hashboards externos e nonce aleatório não
// se aplicam aqui). Duas diferenças deliberadas do original, por rodar na
// MESMA placa que o TFT/touch do vigia (ver .agents/PLANO_MINERACAO.md):
//
// 1) Tasks cooperativamente paráveis (o NerdMiner original nunca para,
//    minera pra sempre) — porque aqui minerar é atado à VIEW_MINER.
// 2) Nunca desabilita nem reconfigura o Task Watchdog Timer. O NerdMiner
//    original faz `disableCore0WDT()` porque satura um core inteiro de
//    propósito; em vez disso, a task de hashing cede a CPU periodicamente
//    (vTaskDelay) mesmo no meio de um job, então o watchdog padrão do
//    sistema continua sendo uma rede de segurança de verdade.
#include "mining_task.h"

#include "mining_log.h"
#include "mining_math.h"
#include "nerd_sha256.h"
#include "stratum_client.h"

#include <WiFi.h>
#include <list>
#include <map>
#include <memory>
#include <mutex>
#include <string.h>

namespace
{

constexpr uint32_t kNoncePerJob = 4096;
constexpr double kDefaultDifficulty = 0.00015;
constexpr uint32_t kKeepAliveMs = 30000;
constexpr uint32_t kPoolInactivityMs = 60000;
constexpr uint32_t kJobQueueTarget = 4;
// Núcleo dedicado à mineração — o oposto do core do loopTask/touch/TFT do
// vigia (core 1 no framework Arduino-ESP32 padrão), pra não competir com a
// UI. Ver risco principal em .agents/PLANO_MINERACAO.md.
constexpr BaseType_t kMiningCore = 0;

struct JobRequest
{
  uint32_t id;
  uint32_t nonceStart;
  uint32_t nonceCount;
  double difficulty;
  uint8_t shaBuffer[128];
  uint32_t midstate[8];
  uint32_t bake[16];
};

struct JobResult
{
  uint32_t id;
  uint32_t nonce;
  uint32_t nonceCount;
  double difficulty;
  uint8_t hash[32];
};

struct Submission
{
  double diff;
  bool is32bit;
  bool isValid;
};

portMUX_TYPE g_mux = portMUX_INITIALIZER_UNLOCKED;

MiningConfig g_cfg;
volatile bool g_stopRequested = false;
volatile bool g_stratumTaskAlive = false;
volatile bool g_workerTaskAlive = false;

MiningStatus g_status = MiningStatus::Idle;
String g_lastError;
uint64_t g_hashesTotal = 0;
uint32_t g_sharesAccepted = 0;
uint32_t g_sharesRejected = 0;
double g_bestDifficulty = 0;
uint32_t g_startedAtMs = 0;
uint32_t g_stoppedAtMs = 0;

// Só usados dentro de miningTaskTick(), que só roda no core da UI — não
// precisa de lock.
uint64_t g_hashesAtLastTick = 0;
uint32_t g_lastTickMs = 0;
double g_hashrateCurrent = 0;

void setStatus(MiningStatus s, const String &err = "")
{
  portENTER_CRITICAL(&g_mux);
  g_status = s;
  if (err.length())
  {
    g_lastError = err;
  }
  portEXIT_CRITICAL(&g_mux);
}

void addHashes(uint32_t n)
{
  portENTER_CRITICAL(&g_mux);
  g_hashesTotal += n;
  portEXIT_CRITICAL(&g_mux);
}

std::mutex g_jobMutex;
std::list<std::shared_ptr<JobRequest>> g_jobQueue;
std::list<std::shared_ptr<JobResult>> g_resultQueue;
volatile uint8_t g_currentJobId = 0xFF;

void pushJob(uint32_t id, uint32_t nonceStart, uint32_t nonceCount, double difficulty, const uint8_t *shaBuffer,
             const uint32_t *midstate, const uint32_t *bake)
{
  auto job = std::make_shared<JobRequest>();
  job->id = id;
  job->nonceStart = nonceStart;
  job->nonceCount = nonceCount;
  job->difficulty = difficulty;
  memcpy(job->shaBuffer, shaBuffer, sizeof(job->shaBuffer));
  memcpy(job->midstate, midstate, sizeof(job->midstate));
  memcpy(job->bake, bake, sizeof(job->bake));
  g_jobQueue.push_back(job);
}

void clearJobs()
{
  std::lock_guard<std::mutex> lock(g_jobMutex);
  g_jobQueue.clear();
  g_resultQueue.clear();
  g_currentJobId = 0xFF;
}

bool checkPoolConnection(WiFiClient &client, IPAddress &serverIp)
{
  if (client.connected())
  {
    return true;
  }
  miningLog("[mining] pool desconectado, tentando conectar...");
  if (serverIp == IPAddress(1, 1, 1, 1))
  {
    WiFi.hostByName(g_cfg.poolUrl.c_str(), serverIp);
  }
  if (!client.connect(serverIp, g_cfg.poolPort))
  {
    WiFi.hostByName(g_cfg.poolUrl.c_str(), serverIp);
    return false;
  }
  return true;
}

bool checkPoolInactivity(WiFiClient &client, uint32_t &lastTxMs, uint32_t &start0HashrateMs, uint64_t &lastHashesSample)
{
  uint32_t now = millis();
  if (now < lastTxMs)
  {
    lastTxMs = now;
  }
  if (now > lastTxMs + kKeepAliveMs)
  {
    lastTxMs = now;
    stratumTxSuggestDifficulty(client, kDefaultDifficulty);
  }

  portENTER_CRITICAL(&g_mux);
  uint64_t hashesNow = g_hashesTotal;
  portEXIT_CRITICAL(&g_mux);

  if (hashesNow == lastHashesSample)
  {
    if (start0HashrateMs == 0)
    {
      start0HashrateMs = now;
    }
    if (now - start0HashrateMs > kPoolInactivityMs)
    {
      start0HashrateMs = 0;
      return true;
    }
    return false;
  }
  lastHashesSample = hashesNow;
  start0HashrateMs = 0;
  return false;
}

// vTaskDelete(NULL) não desenrola a pilha C++ — os destrutores de objetos
// locais (WiFiClient, String, std::map/list, shared_ptr) nunca rodariam se
// fosse chamado direto no fim de uma função cheia de locais não-triviais,
// vazando a última alocação de cada um. Por isso o corpo de verdade fica
// numa função separada que retorna normalmente (desenrolando a pilha e
// destruindo tudo), e só a trampolina externa chama vTaskDelete — nesse
// ponto não sobra nenhum objeto C++ relevante no escopo.
void stratumTaskBody()
{
  miningLog("[mining] stratum task iniciada no core %d", xPortGetCoreID());
  g_stratumTaskAlive = true;

  WiFiClient client;
  IPAddress serverIp(1, 1, 1, 1);
  MinerBlockData minerData{};
  StratumSubscribe worker = stratumInitSubscribe();
  StratumJob job;
  bool subscribed = false;
  double poolDifficulty = kDefaultDifficulty;
  uint32_t noncePool = 0;
  uint32_t jobPool = 0xFFFFFFFF;
  uint32_t lastJobTimeMs = millis();
  uint32_t lastTxMs = millis();
  uint32_t start0HashrateMs = 0;
  uint64_t lastHashesSample = 0;
  std::map<uint32_t, std::shared_ptr<Submission>> submissions;
  // midstate/bake do job atual — calculados uma vez por NOTIFY, reusados
  // pelo refill da fila (cada chunk de nonces usa o mesmo header, só muda
  // o range de nonce).
  uint32_t currentMidstate[8] = {0};
  uint32_t currentBake[16] = {0};

  while (!g_stopRequested)
  {
    if (WiFi.status() != WL_CONNECTED)
    {
      setStatus(MiningStatus::NoWifi);
      subscribed = false;
      clearJobs();
      jobPool = 0xFFFFFFFF;
      submissions.clear();
      vTaskDelay(1000 / portTICK_PERIOD_MS);
      continue;
    }

    if (!checkPoolConnection(client, serverIp))
    {
      setStatus(MiningStatus::PoolOffline);
      clearJobs();
      jobPool = 0xFFFFFFFF;
      submissions.clear();
      vTaskDelay(2000 / portTICK_PERIOD_MS);
      continue;
    }

    if (!subscribed)
    {
      setStatus(MiningStatus::Connecting);
      worker = stratumInitSubscribe();
      if (!stratumTxSubscribe(client, worker))
      {
        client.stop();
        clearJobs();
        jobPool = 0xFFFFFFFF;
        continue;
      }
      // strncpy não garante terminador se a origem for maior que o buffer —
      // fixa isso antes de qualquer strlen/strncat em cima do resultado.
      strncpy(worker.workerName, g_cfg.btcWallet.c_str(), sizeof(worker.workerName) - 1);
      worker.workerName[sizeof(worker.workerName) - 1] = 0;
      if (g_cfg.workerName.length())
      {
        strncat(worker.workerName, ".", sizeof(worker.workerName) - strlen(worker.workerName) - 1);
        strncat(worker.workerName, g_cfg.workerName.c_str(), sizeof(worker.workerName) - strlen(worker.workerName) - 1);
      }
      strncpy(worker.workerPass, "x", sizeof(worker.workerPass) - 1);
      worker.workerPass[sizeof(worker.workerPass) - 1] = 0;

      stratumTxAuth(client, worker.workerName, worker.workerPass);
      stratumTxSuggestDifficulty(client, poolDifficulty);

      subscribed = true;
      lastTxMs = millis();
      lastJobTimeMs = lastTxMs;
    }

    if (checkPoolInactivity(client, lastTxMs, start0HashrateMs, lastHashesSample))
    {
      miningLog("[mining] pool inativo por muito tempo, reconectando");
      client.stop();
      subscribed = false;
      clearJobs();
      jobPool = 0xFFFFFFFF;
      submissions.clear();
      continue;
    }

    {
      uint32_t now = millis();
      if (now < lastJobTimeMs)
      {
        lastJobTimeMs = now;
      }
      if (now - lastJobTimeMs > 10 * 60 * 1000)
      {
        client.stop();
        subscribed = false;
        clearJobs();
        jobPool = 0xFFFFFFFF;
        continue;
      }
    }

    while (client.connected() && client.available())
    {
      String line = client.readStringUntil('\n');
      switch (stratumParseMethod(line))
      {
      case StratumMethod::Notify:
        if (stratumParseNotify(line, job))
        {
          clearJobs();
          jobPool = (jobPool == 0xFFFFFFFF) ? 0 : jobPool + 1;
          g_currentJobId = jobPool & 0xFF;
          lastJobTimeMs = millis();
          lastTxMs = lastJobTimeMs;

          minerData = calculateMiningData(worker, job);
          memset(minerData.blockHeader + 80, 0, 128 - 80);
          minerData.blockHeader[80] = 0x80;
          minerData.blockHeader[126] = 0x02;
          minerData.blockHeader[127] = 0x80;

          nerdMids(currentMidstate, minerData.blockHeader);
          nerdSha256Bake(currentMidstate, minerData.blockHeader + 64, currentBake);

          noncePool = 0xDA54E700; // nonce 0 não é válido, começa de um valor fixo arbitrário
          {
            std::lock_guard<std::mutex> lock(g_jobMutex);
            for (int i = 0; i < (int)kJobQueueTarget; ++i)
            {
              pushJob(jobPool, noncePool, kNoncePerJob, poolDifficulty, minerData.blockHeader, currentMidstate, currentBake);
              noncePool += kNoncePerJob;
            }
          }
          setStatus(MiningStatus::Mining);
        }
        else
        {
          miningLog("[mining] erro no parse do notify, reconectando");
          client.stop();
          subscribed = false;
          clearJobs();
          jobPool = 0xFFFFFFFF;
        }
        break;
      case StratumMethod::SetDifficulty:
        stratumParseSetDifficulty(line, poolDifficulty);
        break;
      case StratumMethod::Success:
      {
        unsigned long id = stratumParseExtractId(line);
        auto it = submissions.find(id);
        if (it != submissions.end())
        {
          portENTER_CRITICAL(&g_mux);
          if (it->second->diff > g_bestDifficulty)
          {
            g_bestDifficulty = it->second->diff;
          }
          if (it->second->is32bit)
          {
            g_sharesAccepted++;
          }
          portEXIT_CRITICAL(&g_mux);
          submissions.erase(it);
        }
        break;
      }
      case StratumMethod::ParseError:
      {
        unsigned long id = stratumParseExtractId(line);
        auto it = submissions.find(id);
        if (it != submissions.end())
        {
          portENTER_CRITICAL(&g_mux);
          g_sharesRejected++;
          portEXIT_CRITICAL(&g_mux);
          submissions.erase(it);
        }
        break;
      }
      default:
        break;
      }
    }

    vTaskDelay(50 / portTICK_PERIOD_MS);

    std::list<std::shared_ptr<JobResult>> harvested;
    if (jobPool != 0xFFFFFFFF)
    {
      std::lock_guard<std::mutex> lock(g_jobMutex);
      harvested.splice(harvested.end(), g_resultQueue);
      while (g_jobQueue.size() < kJobQueueTarget)
      {
        pushJob(jobPool, noncePool, kNoncePerJob, poolDifficulty, minerData.blockHeader, currentMidstate, currentBake);
        noncePool += kNoncePerJob;
      }
    }

    while (!harvested.empty())
    {
      std::shared_ptr<JobResult> res = harvested.front();
      harvested.pop_front();
      addHashes(res->nonceCount);

      if (res->difficulty > poolDifficulty && jobPool == res->id && res->nonce != 0xFFFFFFFF)
      {
        if (!client.connected())
        {
          break;
        }
        unsigned long submitId = 0;
        stratumTxSubmit(client, worker, job, res->nonce, submitId);
        lastTxMs = millis();

        auto submission = std::make_shared<Submission>();
        submission->diff = res->difficulty;
        submission->is32bit = (res->hash[29] == 0 && res->hash[28] == 0);
        submission->isValid = submission->is32bit && hashMeetsTarget(res->hash, minerData.target);
        submissions[submitId] = submission;
        if (submissions.size() > 32)
        {
          submissions.erase(submissions.begin());
        }
      }
    }
  }

  client.stop();
  clearJobs();
  miningLog("[mining] stratum task encerrada");
  g_stratumTaskAlive = false;
}

void stratumTaskFn(void *)
{
  stratumTaskBody();
  vTaskDelete(nullptr);
}

void hashWorkerTaskBody()
{
  miningLog("[mining] hash worker iniciado no core %d", xPortGetCoreID());
  g_workerTaskAlive = true;

  std::shared_ptr<JobRequest> job;
  std::shared_ptr<JobResult> pendingResult;
  uint8_t hash[32];

  while (!g_stopRequested)
  {
    {
      std::lock_guard<std::mutex> lock(g_jobMutex);
      if (pendingResult)
      {
        if (g_resultQueue.size() < 16)
        {
          g_resultQueue.push_back(pendingResult);
        }
        pendingResult.reset();
      }
      if (!g_jobQueue.empty())
      {
        job = g_jobQueue.front();
        g_jobQueue.pop_front();
      }
      else
      {
        job.reset();
      }
    }

    if (!job)
    {
      vTaskDelay(2 / portTICK_PERIOD_MS);
      continue;
    }

    pendingResult = std::make_shared<JobResult>();
    pendingResult->difficulty = job->difficulty;
    pendingResult->nonce = 0xFFFFFFFF;
    pendingResult->id = job->id;
    pendingResult->nonceCount = job->nonceCount;
    uint8_t jobIdByte = job->id & 0xFF;

    for (uint32_t n = 0; n < job->nonceCount && !g_stopRequested; ++n)
    {
      ((uint32_t *)(job->shaBuffer + 64 + 12))[0] = job->nonceStart + n;
      if (nerdSha256dBaked(job->midstate, job->shaBuffer + 64, job->bake, hash))
      {
        double diffHash = diffFromTarget(hash);
        if (diffHash > pendingResult->difficulty)
        {
          pendingResult->difficulty = diffHash;
          pendingResult->nonce = job->nonceStart + n;
          memcpy(pendingResult->hash, hash, 32);
        }
      }

      if ((uint16_t)(n & 0xFF) == 0 && g_currentJobId != jobIdByte)
      {
        pendingResult->nonceCount = n + 1;
        break;
      }
      // Cede a CPU periodicamente mesmo no meio de um job — é o que
      // substitui o disableCore0WDT() do NerdMiner original (ver
      // comentário no topo do arquivo): o watchdog padrão continua ativo
      // e a IDLE0 desse core sempre tem uma folga pra rodar.
      if ((n & 0x3FF) == 0x3FF)
      {
        vTaskDelay(1);
      }
    }
  }

  miningLog("[mining] hash worker encerrado");
  g_workerTaskAlive = false;
}

void hashWorkerTaskFn(void *)
{
  hashWorkerTaskBody();
  vTaskDelete(nullptr);
}

} // namespace

void miningTaskStart(const MiningConfig &cfg)
{
  miningLogClear();
  if (g_stratumTaskAlive || g_workerTaskAlive)
  {
    miningTaskStop();
    uint32_t waited = 0;
    while ((g_stratumTaskAlive || g_workerTaskAlive) && waited < 800)
    {
      delay(20);
      waited += 20;
    }
  }

  g_cfg = cfg;
  clearJobs();
  portENTER_CRITICAL(&g_mux);
  g_lastError = "";
  g_hashesTotal = 0;
  g_sharesAccepted = 0;
  g_sharesRejected = 0;
  g_bestDifficulty = 0;
  portEXIT_CRITICAL(&g_mux);
  g_hashesAtLastTick = 0;
  g_hashrateCurrent = 0;
  g_startedAtMs = millis();
  g_lastTickMs = g_startedAtMs;

  if (!cfg.enabled)
  {
    setStatus(MiningStatus::Idle, "mineração desativada nas configurações");
    return;
  }
  if (cfg.btcWallet.length() == 0)
  {
    setStatus(MiningStatus::Error, "endereço BTC não configurado");
    return;
  }
  if (cfg.poolUrl.length() == 0)
  {
    setStatus(MiningStatus::Error, "pool não configurado");
    return;
  }

  setStatus(WiFi.status() == WL_CONNECTED ? MiningStatus::Connecting : MiningStatus::NoWifi);

  g_stopRequested = false;
  xTaskCreatePinnedToCore(stratumTaskFn, "MiningStratum", 12000, nullptr, 2, nullptr, kMiningCore);
  xTaskCreatePinnedToCore(hashWorkerTaskFn, "MiningHash", 5000, nullptr, 1, nullptr, kMiningCore);
}

void miningTaskStop()
{
  g_stopRequested = true;
  g_stoppedAtMs = millis();
}

bool miningTaskIsRunning()
{
  return g_stratumTaskAlive || g_workerTaskAlive;
}

MiningReport miningTaskGetReport()
{
  MiningReport r;
  portENTER_CRITICAL(&g_mux);
  r.status = g_status;
  r.lastError = g_lastError;
  r.sharesAccepted = g_sharesAccepted;
  r.sharesRejected = g_sharesRejected;
  r.bestDifficulty = g_bestDifficulty;
  uint64_t hashesTotal = g_hashesTotal;
  portEXIT_CRITICAL(&g_mux);

  r.hashrateCurrent = g_hashrateCurrent;
  uint32_t endMs = miningTaskIsRunning() ? millis() : g_stoppedAtMs;
  r.uptimeS = (g_startedAtMs && endMs > g_startedAtMs) ? (endMs - g_startedAtMs) / 1000 : 0;
  r.hashrateAvg = r.uptimeS > 0 ? (double)hashesTotal / r.uptimeS : 0;
  r.blockHeight = 0;
  return r;
}

void miningTaskTick()
{
  if (!miningTaskIsRunning())
  {
    return;
  }
  uint32_t now = millis();
  uint32_t elapsedMs = now - g_lastTickMs;
  if (elapsedMs < 1000)
  {
    return;
  }
  portENTER_CRITICAL(&g_mux);
  uint64_t hashesTotal = g_hashesTotal;
  portEXIT_CRITICAL(&g_mux);
  uint64_t delta = hashesTotal - g_hashesAtLastTick;
  g_hashrateCurrent = elapsedMs > 0 ? (double)delta * 1000.0 / elapsedMs : 0;
  g_hashesAtLastTick = hashesTotal;
  g_lastTickMs = now;
}
