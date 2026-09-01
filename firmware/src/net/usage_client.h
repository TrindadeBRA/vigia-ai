#pragma once

// Cliente de rede: Wi-Fi + SSE `GET /events` (JSON do contrato em docs/CONTRATO_JSON.md).
// `USAGE_URL` continua apontando para `/usage`; o firmware troca o path por `/events`.
// `usageClientFetch` (GET /usage) só no refresh manual.
void usageClientEnsureWifi();
void usageClientFetch();
void usageClientPoll();

// Log de diagnóstico do snapshot atual (g_snap).
void usageClientLogSnapshot(const char* why);

// Marca todas as contas já conhecidas (de qualquer provedor) como falha, sem
// mexer em id/label/contagem — usado tanto pelo fetch real (Wi-Fi/HTTP fora
// do ar) quanto por main.cpp enquanto aguarda a Wi-Fi conectar.
void markAllAccountsFailed(const char* msg);

// Tema personalizado (protótipo, ver docs/CONTRATO_TEMA.md): busca
// GET <coletor>/api/theme (e /api/theme/background se houver) e aplica via
// ui/customtheme.h — chamado pelo botão de recarregar no header
// (ui/layout.cpp + ui/nav.cpp), nunca automático.
void themeClientReload();
