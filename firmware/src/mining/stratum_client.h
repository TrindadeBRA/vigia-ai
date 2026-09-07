// Cliente Stratum V1 (subscribe/authorize/notify/submit/set_difficulty) —
// portado de NerdMiner_v2/src/stratum.{h,cpp} (MIT, Bitmaker). Protocolo
// puro sobre WiFiClient + ArduinoJson, sem dependência de display. Ver
// .agents/PLANO_MINERACAO.md.
#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFiClient.h>

#define STRATUM_BUFFER 1024

struct StratumSubscribe
{
  String subDetails;
  String extranonce1;
  String extranonce2;
  int extranonce2Size;
  char workerName[80];
  char workerPass[20];
};

struct StratumJob
{
  String jobId;
  String prevBlockHash;
  String coinb1;
  String coinb2;
  String nbits;
  JsonArray merkleBranch;
  String version;
  String ntime;
  bool cleanJobs;
};

enum class StratumMethod
{
  Success,
  Unknown,
  ParseError,
  Notify,
  SetDifficulty,
};

StratumSubscribe stratumInitSubscribe();
bool stratumTxSubscribe(WiFiClient &client, StratumSubscribe &sub);
bool stratumParseSubscribe(String line, StratumSubscribe &sub);

bool stratumTxAuth(WiFiClient &client, const char *user, const char *pass);
StratumMethod stratumParseMethod(String line);
bool stratumParseNotify(String line, StratumJob &job);

bool stratumTxSubmit(WiFiClient &client, const StratumSubscribe &worker, const StratumJob &job, uint32_t nonce, unsigned long &submitId);

bool stratumTxSuggestDifficulty(WiFiClient &client, double difficulty);
bool stratumParseSetDifficulty(String line, double &difficulty);

unsigned long stratumParseExtractId(const String &line);
