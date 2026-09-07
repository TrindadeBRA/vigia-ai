// Matemática de mineração (target/dificuldade, montagem do block header) —
// portada de NerdMiner_v2/src/utils.{h,cpp} (MIT, Bitmaker), mantendo só o
// que o worker precisa (sem NVS, sem formatação de tela). Ver
// .agents/PLANO_MINERACAO.md.
#pragma once

#include <Arduino.h>
#include "stratum_client.h"

// version(4) + prevhash(32) + merkle_root(32) + ntime(4) + nbits(4) +
// nonce(4) = 80 bytes reais; o resto do buffer é o padding SHA256 do
// segundo bloco (ver calculateMiningData).
struct MinerBlockData
{
  uint8_t target[32];
  uint8_t merkleResult[32];
  uint8_t blockHeader[128];
};

int hexToBytes(const char *in, size_t inLen, uint8_t *out);
void reverseBytes(uint8_t *data, size_t len);
double diffFromTarget(const void *target);
bool isSha256NonZero(const void *sha256);

// true se hash <= target (nunca deve acontecer num miner de baixa
// dificuldade — indicaria bloco válido de verdade).
bool hashMeetsTarget(const uint8_t *hash, const uint8_t *target);

// Monta target, merkle root e block header a partir do job do pool +
// dados de subscribe do worker. Precisa vir depois de mWorker.extranonce2
// já preenchido.
MinerBlockData calculateMiningData(StratumSubscribe &worker, const StratumJob &job);
