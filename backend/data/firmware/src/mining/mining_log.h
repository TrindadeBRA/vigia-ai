// Buffer circular pequeno de linhas de log da mineração — sobe junto no
// POST /api/mining/report (net/mining_client.cpp) pra aparecer no painel
// web (/display/mining). Aproximação de "tempo real": só atualiza no
// intervalo do report (~10s), não é stream de verdade. Ver
// .agents/PLANO_MINERACAO.md.
#pragma once

#include <Arduino.h>

// Formata (printf-style) e guarda a linha no buffer circular, além de
// imprimir no Serial normalmente (comportamento igual a antes, só que
// agora também fica disponível pro report).
void miningLog(const char *fmt, ...);

// Máximo de linhas devolvidas por miningLogSnapshot().
constexpr int MINING_LOG_MAX_LINES = 16;

// Linhas atuais do buffer, da mais antiga pra mais nova. `out` precisa ter
// espaço pra MINING_LOG_MAX_LINES elementos; retorna quantas foram
// preenchidas.
int miningLogSnapshot(String out[MINING_LOG_MAX_LINES]);

// Limpa o buffer — chamado ao (re)iniciar uma sessão de mineração, pra não
// misturar log de sessões diferentes.
void miningLogClear();
