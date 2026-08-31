#pragma once

// Cliente de rede: conecta ao Wi-Fi e busca/parseia o JSON de /usage do
// coletor (docs/CONTRATO_JSON.md).
void usageClientEnsureWifi();
void usageClientFetch();

// Log de diagnóstico do snapshot atual (g_snap).
void usageClientLogSnapshot(const char* why);

// Marca todas as contas já conhecidas (de qualquer provedor) como falha, sem
// mexer em id/label/contagem — usado tanto pelo fetch real (Wi-Fi/HTTP fora
// do ar) quanto por main.cpp enquanto aguarda a Wi-Fi conectar.
void markAllAccountsFailed(const char* msg);

