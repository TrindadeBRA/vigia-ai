#include "stratum_client.h"

#include "mining_log.h"
#include "version.h"

namespace
{
JsonDocument g_doc;
unsigned long g_id = 1;

unsigned long nextId(unsigned long id)
{
  if (id == ULONG_MAX)
  {
    return 1;
  }
  return id + 1;
}

bool verifyPayload(String *line)
{
  if (line->length() == 0)
  {
    return false;
  }
  line->trim();
  return !line->isEmpty();
}

bool checkError(const JsonDocument &doc)
{
  if (doc["error"].isNull())
  {
    return false;
  }
  if (doc["error"].size() == 0)
  {
    return false;
  }
  miningLog("[stratum] ERRO: %d | motivo: %s", (const int)doc["error"][0], (const char *)doc["error"][1]);
  return true;
}
} // namespace

StratumSubscribe stratumInitSubscribe()
{
  StratumSubscribe sub;
  sub.extranonce1 = "";
  sub.extranonce2 = "";
  sub.extranonce2Size = 0;
  sub.subDetails = "";
  sub.workerName[0] = 0;
  sub.workerPass[0] = 0;
  return sub;
}

// STEP 1: mining.subscribe — https://cs.braiins.com/stratum-v1/docs
bool stratumTxSubscribe(WiFiClient &client, StratumSubscribe &sub)
{
  char payload[STRATUM_BUFFER] = {0};
  g_id = 1;
  snprintf(payload, sizeof(payload), "{\"id\": %lu, \"method\": \"mining.subscribe\", \"params\": [\"VigiaAI-Miner/%s\"]}\n", g_id, FIRMWARE_VERSION);

  miningLog("[stratum] ==> mining.subscribe");
  client.print(payload);

  vTaskDelay(200 / portTICK_PERIOD_MS);

  String line = client.readStringUntil('\n');
  if (!stratumParseSubscribe(line, sub))
  {
    return false;
  }

  if (sub.extranonce1.length() == 0)
  {
    miningLog("[stratum] subscribe sem extranonce1, abortando");
    g_doc.clear();
    return false;
  }
  return true;
}

bool stratumParseSubscribe(String line, StratumSubscribe &sub)
{
  if (!verifyPayload(&line))
  {
    return false;
  }
  DeserializationError error = deserializeJson(g_doc, line);
  if (error || checkError(g_doc))
  {
    return false;
  }
  if (g_doc["result"].isNull())
  {
    return false;
  }

  sub.subDetails = String((const char *)g_doc["result"][0][0][1]);
  sub.extranonce1 = String((const char *)g_doc["result"][1]);
  sub.extranonce2Size = g_doc["result"][2];
  return true;
}

// STEP 2: mining.authorize
bool stratumTxAuth(WiFiClient &client, const char *user, const char *pass)
{
  char payload[STRATUM_BUFFER] = {0};
  g_id = nextId(g_id);
  snprintf(payload, sizeof(payload), "{\"params\": [\"%s\", \"%s\"], \"id\": %lu, \"method\": \"mining.authorize\"}\n", user, pass, g_id);

  miningLog("[stratum] ==> mining.authorize");
  client.print(payload);
  vTaskDelay(200 / portTICK_PERIOD_MS);
  return true;
}

StratumMethod stratumParseMethod(String line)
{
  if (!verifyPayload(&line))
  {
    return StratumMethod::ParseError;
  }
  DeserializationError error = deserializeJson(g_doc, line);
  if (error || checkError(g_doc))
  {
    return StratumMethod::ParseError;
  }

  if (g_doc["method"].isNull())
  {
    return g_doc["error"].isNull() ? StratumMethod::Success : StratumMethod::Unknown;
  }

  const char *method = (const char *)g_doc["method"];
  if (strcmp("mining.notify", method) == 0)
  {
    return StratumMethod::Notify;
  }
  if (strcmp("mining.set_difficulty", method) == 0)
  {
    return StratumMethod::SetDifficulty;
  }
  return StratumMethod::Unknown;
}

bool stratumParseNotify(String line, StratumJob &job)
{
  if (!verifyPayload(&line))
  {
    return false;
  }
  DeserializationError error = deserializeJson(g_doc, line);
  if (error || g_doc["params"].isNull())
  {
    return false;
  }

  job.jobId = String((const char *)g_doc["params"][0]);
  job.prevBlockHash = String((const char *)g_doc["params"][1]);
  job.coinb1 = String((const char *)g_doc["params"][2]);
  job.coinb2 = String((const char *)g_doc["params"][3]);
  job.merkleBranch = g_doc["params"][4];
  job.version = String((const char *)g_doc["params"][5]);
  job.nbits = String((const char *)g_doc["params"][6]);
  job.ntime = String((const char *)g_doc["params"][7]);
  job.cleanJobs = g_doc["params"][8];

  if (checkError(g_doc))
  {
    miningLog("[stratum] notify com erro, descartando job");
    return false;
  }
  return true;
}

bool stratumTxSubmit(WiFiClient &client, const StratumSubscribe &worker, const StratumJob &job, uint32_t nonce, unsigned long &submitId)
{
  char payload[STRATUM_BUFFER] = {0};
  g_id = nextId(g_id);
  submitId = g_id;
  snprintf(payload, sizeof(payload), "{\"id\":%lu,\"method\":\"mining.submit\",\"params\":[\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"]}\n",
           g_id, worker.workerName, job.jobId.c_str(), worker.extranonce2.c_str(), job.ntime.c_str(), String(nonce, HEX).c_str());
  client.print(payload);
  return true;
}

bool stratumParseSetDifficulty(String line, double &difficulty)
{
  if (!verifyPayload(&line))
  {
    return false;
  }
  DeserializationError error = deserializeJson(g_doc, line);
  if (error || g_doc["params"].isNull())
  {
    return false;
  }
  difficulty = (double)g_doc["params"][0];
  miningLog("[stratum] nova dificuldade: %.12g", difficulty);
  return true;
}

bool stratumTxSuggestDifficulty(WiFiClient &client, double difficulty)
{
  char payload[STRATUM_BUFFER] = {0};
  g_id = nextId(g_id);
  snprintf(payload, sizeof(payload), "{\"id\":%lu,\"method\":\"mining.suggest_difficulty\",\"params\":[%.10g]}\n", g_id, difficulty);
  return client.print(payload) > 0;
}

unsigned long stratumParseExtractId(const String &line)
{
  DeserializationError error = deserializeJson(g_doc, line);
  if (error || g_doc["id"].isNull())
  {
    return 0;
  }
  return g_doc["id"];
}
