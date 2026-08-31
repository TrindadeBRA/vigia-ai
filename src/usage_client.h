#pragma once

// Cliente de rede: conecta ao Wi-Fi e busca/parseia o JSON de /usage do
// coletor (docs/CONTRATO_JSON.md). Só existe fora do build MOCK_USAGE —
// nenhum env usa essa flag hoje, mas o caminho de fallback continua isolado
// aqui, igual estava em main.cpp antes da divisão.
#ifndef MOCK_USAGE
void usageClientEnsureWifi();
void usageClientFetch();
#endif

// Log de diagnóstico do snapshot atual (g_snap) — usado tanto pelo caminho
// mock (main.cpp) quanto pelo fetch real.
void usageClientLogSnapshot(const char* why);

// Marca todas as contas já conhecidas (de qualquer provedor) como falha, sem
// mexer em id/label/contagem — usado tanto pelo fetch real (Wi-Fi/HTTP fora
// do ar) quanto por main.cpp enquanto aguarda a Wi-Fi conectar.
void markAllAccountsFailed(const char* msg);
