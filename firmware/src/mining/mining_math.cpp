#include "mining_math.h"

#include <mbedtls/sha256.h>
#include <string.h>

namespace
{
uint8_t hexNibble(char ch)
{
  uint8_t r = (ch > 57) ? (ch - 55) : (ch - 48);
  return r & 0x0F;
}

// Constante usada pra converter um alvo (target) de 256 bits em dificuldade —
// ver le256todouble no NerdMiner original.
const double kTrueDiffOne = 26959535291011309493156476344723991336010898738574164086137773096960.0;

double le256ToDouble(const void *target)
{
  const uint64_t *data64;
  double dcut64;

  data64 = (const uint64_t *)((const uint8_t *)target + 24);
  dcut64 = *data64 * 6277101735386680763835789423207666416102355444464034512896.0;
  data64 = (const uint64_t *)((const uint8_t *)target + 16);
  dcut64 += *data64 * 340282366920938463463374607431768211456.0;
  data64 = (const uint64_t *)((const uint8_t *)target + 8);
  dcut64 += *data64 * 18446744073709551616.0;
  data64 = (const uint64_t *)target;
  dcut64 += *data64;
  return dcut64;
}
} // namespace

int hexToBytes(const char *in, size_t inLen, uint8_t *out)
{
  int count = 0;
  if (inLen % 2)
  {
    while (*in && out)
    {
      *out = hexNibble(*in++);
      if (!*in)
      {
        return count;
      }
      *out = (*out << 4) | hexNibble(*in++);
      out++;
      count++;
    }
    return count;
  }
  while (*in && out)
  {
    *out++ = (hexNibble(*in++) << 4) | hexNibble(*in++);
    count++;
  }
  return count;
}

void reverseBytes(uint8_t *data, size_t len)
{
  for (size_t i = 0; i < len / 2; ++i)
  {
    uint8_t temp = data[i];
    data[i] = data[len - 1 - i];
    data[len - 1 - i] = temp;
  }
}

double diffFromTarget(const void *target)
{
  double dcut64 = le256ToDouble(target);
  if (!dcut64)
  {
    dcut64 = 1;
  }
  return kTrueDiffOne / dcut64;
}

bool isSha256NonZero(const void *sha256)
{
  for (uint8_t i = 0; i < 8; ++i)
  {
    if (((const uint32_t *)sha256)[i] != 0)
    {
      return true;
    }
  }
  return false;
}

bool hashMeetsTarget(const uint8_t *hash, const uint8_t *target)
{
  // NerdMiner original (checkValid) tem dois bugs aqui, nunca notados na
  // prática porque essa função só roda quando uma hash já bateu 32 bits de
  // zero — extremamente raro num miner de baixo hashrate:
  // 1) memcpy(diff_target, &target, 32) copiava o endereço do ponteiro, não
  //    os bytes apontados.
  // 2) o loop de comparação usava `uint8_t i` decrescente com `i >= 0`, que
  //    nunca é falso (wraparound) — e também não parava no primeiro byte
  //    decisivo, só na primeira vez que achasse hash[i] > alvo. Corrigido
  //    abaixo com comparação padrão de número grande, do byte mais
  //    significativo (31) ao menos significativo (0), parando na primeira
  //    diferença.
  uint8_t diffTarget[32];
  memcpy(diffTarget, target, 32);
  reverseBytes(diffTarget, 32);

  for (int i = 31; i >= 0; --i)
  {
    if (hash[i] > diffTarget[i])
    {
      return false;
    }
    if (hash[i] < diffTarget[i])
    {
      return true;
    }
  }
  return true;
}

MinerBlockData calculateMiningData(StratumSubscribe &worker, const StratumJob &job)
{
  MinerBlockData miner{};

  // target = (nbits[2:] + '00' * (nbits[:2] - 3)).zfill(64)
  char target[65];
  memset(target, '0', 64);
  int zeros = (int)strtol(job.nbits.substring(0, 2).c_str(), nullptr, 16) - 3;
  memcpy(target + zeros - 2, job.nbits.substring(2).c_str(), job.nbits.length() - 2);
  target[64] = 0;

  size_t sizeTarget = hexToBytes(target, 32, miner.target);
  for (size_t j = 0; j < 8; j++)
  {
    miner.target[j] ^= miner.target[sizeTarget - 1 - j];
    miner.target[sizeTarget - 1 - j] ^= miner.target[j];
    miner.target[j] ^= miner.target[sizeTarget - 1 - j];
  }

  // extranonce2 fixo (miner solo, sem múltiplos workers no mesmo subscribe) —
  // mesma simplificação do NerdMiner original.
  if (worker.extranonce2Size == 2)
  {
    worker.extranonce2 = "0001";
  }
  else if (worker.extranonce2Size == 4)
  {
    worker.extranonce2 = "00000001";
  }
  else if (worker.extranonce2Size == 8)
  {
    worker.extranonce2 = "0000000000000001";
  }
  else
  {
    worker.extranonce2 = "00000001";
  }

  // coinbase = coinb1 + extranonce1 + extranonce2 + coinb2, depois sha256d
  char coinbaseBuffer[512];
  snprintf(coinbaseBuffer, sizeof(coinbaseBuffer), "%s%s%s%s", job.coinb1.c_str(), worker.extranonce1.c_str(),
           worker.extranonce2.c_str(), job.coinb2.c_str());
  size_t strLen = strlen(coinbaseBuffer) / 2;
  uint8_t coinbaseBytes[256];
  hexToBytes(coinbaseBuffer, strLen * 2, coinbaseBytes);

  mbedtls_sha256_context ctx;
  uint8_t interResult[32];
  uint8_t shaResult[32];

  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts_ret(&ctx, 0);
  mbedtls_sha256_update_ret(&ctx, coinbaseBytes, strLen);
  mbedtls_sha256_finish_ret(&ctx, interResult);
  mbedtls_sha256_starts_ret(&ctx, 0);
  mbedtls_sha256_update_ret(&ctx, interResult, 32);
  mbedtls_sha256_finish_ret(&ctx, shaResult);
  mbedtls_sha256_free(&ctx);

  memcpy(miner.merkleResult, shaResult, sizeof(shaResult));

  // Merkle root: aplica cada branch do job sobre o hash acumulado
  uint8_t merkleConcatenated[64];
  for (size_t k = 0; k < job.merkleBranch.size(); k++)
  {
    const char *merkleElement = (const char *)job.merkleBranch[k];
    uint8_t branchBytes[32];
    hexToBytes(merkleElement, 64, branchBytes);

    memcpy(merkleConcatenated, miner.merkleResult, 32);
    memcpy(merkleConcatenated + 32, branchBytes, 32);

    mbedtls_sha256_context branchCtx;
    mbedtls_sha256_init(&branchCtx);
    mbedtls_sha256_starts_ret(&branchCtx, 0);
    mbedtls_sha256_update_ret(&branchCtx, merkleConcatenated, 64);
    mbedtls_sha256_finish_ret(&branchCtx, interResult);
    mbedtls_sha256_starts_ret(&branchCtx, 0);
    mbedtls_sha256_update_ret(&branchCtx, interResult, 32);
    mbedtls_sha256_finish_ret(&branchCtx, miner.merkleResult);
    mbedtls_sha256_free(&branchCtx);
  }

  char merkleRoot[65];
  for (int i = 0; i < 32; i++)
  {
    snprintf(&merkleRoot[i * 2], 3, "%02x", miner.merkleResult[i]);
  }
  merkleRoot[64] = 0;

  // block_header = version + prevhash + merkle_root + ntime + nbits + nonce(0)
  String blockheader = job.version + job.prevBlockHash + String(merkleRoot) + job.ntime + job.nbits + "00000000";
  size_t headerLen = blockheader.length() / 2;
  hexToBytes(blockheader.c_str(), headerLen * 2, miner.blockHeader);

  // Cada campo do header vem do pool em ordem diferente da que o SHA256
  // precisa — troca de endianness campo a campo (não é um swap único do
  // buffer inteiro).
  uint8_t buff;
  size_t boffset, bsize;

  boffset = 0;
  bsize = 4; // version
  for (size_t j = boffset; j < boffset + bsize / 2; j++)
  {
    buff = miner.blockHeader[j];
    miner.blockHeader[j] = miner.blockHeader[2 * boffset + bsize - 1 - j];
    miner.blockHeader[2 * boffset + bsize - 1 - j] = buff;
  }

  boffset = 4;
  size_t bword = 4;
  bsize = 32; // prevhash, palavra a palavra
  for (size_t i = 1; i <= bsize / bword; i++)
  {
    for (size_t j = boffset; j < boffset + bword / 2; j++)
    {
      buff = miner.blockHeader[j];
      miner.blockHeader[j] = miner.blockHeader[2 * boffset + bword - 1 - j];
      miner.blockHeader[2 * boffset + bword - 1 - j] = buff;
    }
    boffset += bword;
  }

  boffset = 68;
  bsize = 4; // ntime
  for (size_t j = boffset; j < boffset + bsize / 2; j++)
  {
    buff = miner.blockHeader[j];
    miner.blockHeader[j] = miner.blockHeader[2 * boffset + bsize - 1 - j];
    miner.blockHeader[2 * boffset + bsize - 1 - j] = buff;
  }

  boffset = 72;
  bsize = 4; // nbits
  for (size_t j = boffset; j < boffset + bsize / 2; j++)
  {
    buff = miner.blockHeader[j];
    miner.blockHeader[j] = miner.blockHeader[2 * boffset + bsize - 1 - j];
    miner.blockHeader[2 * boffset + bsize - 1 - j] = buff;
  }

  return miner;
}
