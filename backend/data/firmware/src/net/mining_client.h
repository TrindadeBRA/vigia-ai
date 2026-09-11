#pragma once

// Integra a VIEW_MINER (ui/views/miner.cpp, via ui/nav.cpp) com
// mining/mining_task.h e o coletor. ui/nav.cpp não conhece MiningConfig
// nem chama miningTaskStart/Stop diretamente — só estas duas funções.

// Chamado ao ENTRAR na VIEW_MINER (uiSetView em ui/nav.cpp) — busca a
// config mais recente do coletor (síncrono, timeout curto: não trava a UI
// por muito tempo se o coletor estiver fora do ar) e liga a mineração.
void miningClientEnterView();

// Chamado ao SAIR da VIEW_MINER — desliga a mineração.
void miningClientExitView();

// Housekeeping de rede — chamado a cada volta do loop() em main.cpp. No-op
// fora da VIEW_MINER. Reaplica a config só se ela mudou desde a última
// busca (ex.: usuário mexeu em /display/mining enquanto olhava a tela) e
// faz POST /api/mining/report periodicamente.
void miningClientPoll();
