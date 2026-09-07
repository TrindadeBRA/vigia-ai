// Orquestra a mineração: cria/derruba as tasks de Stratum + hashing e expõe
// um snapshot de status pra UI local (ui/views/miner.cpp) e pro cliente de
// rede (net/mining_client.cpp) reportar ao coletor. Ver
// .agents/PLANO_MINERACAO.md — a decisão central é que isso só roda
// enquanto o usuário está deliberadamente na VIEW_MINER: entrar chama
// miningTaskStart(), sair chama miningTaskStop(). Nunca roda sozinho.
#pragma once

#include <Arduino.h>

struct MiningConfig
{
  bool enabled = false;
  String poolUrl;
  uint16_t poolPort = 3333;
  String btcWallet;
  String workerName;
};

enum class MiningStatus : uint8_t
{
  Idle,
  NoWifi,
  Connecting,
  Mining,
  PoolOffline,
  Error,
};

struct MiningReport
{
  MiningStatus status = MiningStatus::Idle;
  double hashrateCurrent = 0; // H/s
  double hashrateAvg = 0;     // H/s
  uint32_t sharesAccepted = 0;
  uint32_t sharesRejected = 0;
  double bestDifficulty = 0;
  uint32_t blockHeight = 0; // sempre 0 no MVP (fora de escopo, ver plano)
  uint32_t uptimeS = 0;
  String lastError;
};

// Idempotente: se já tiver rodando, para e recria com a config nova. Não
// bloqueia por muito tempo (no máx. ~800ms esperando a sessão anterior
// encerrar) — chamado direto do handler de troca de tela (uiSetView), que
// roda no core da UI.
void miningTaskStart(const MiningConfig &cfg);

// Sinaliza para as tasks pararem (cooperativo — elas notam e se
// auto-destroem em até ~1 job de hashing, tipicamente <200ms) e não bloqueia.
void miningTaskStop();

bool miningTaskIsRunning();

// Snapshot thread-safe do estado atual.
MiningReport miningTaskGetReport();

// Housekeeping leve (hashrate/uptime) — chamar a cada volta do loop() em
// main.cpp. Não bloqueia, é no-op se não estiver minerando.
void miningTaskTick();
