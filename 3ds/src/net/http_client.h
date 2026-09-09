#pragma once
// Port de firmware/src/net/usage_client.h para 3DS httpc.
// Polling GET /usage (60s) + GET /health (interval_s). Sem SSE.

#include <string>

void httpClientInit(bool *outHttpPatched = nullptr);
void httpClientFini();

// GET http://.../usage -> parseUsageJson + atualiza g_snap. Retorna true em http 200+JSON ok.
bool httpFetchUsage(const std::string &url, std::string *outBody = nullptr);

// GET http://.../health -> atualiza g_pollMs e g_panelUrl. Nao falha o usage se der erro.
bool httpFetchHealth(const std::string &healthUrl);

// Chamado no loop: garante wifi? (no 3DS: ac:u) e faz poll se expirou.
void httpClientPoll(const std::string &usageUrl);

// Refresh manual (botao Y)
void httpClientRequestRefresh();

// Ultima linha de status de rede para VIEW_STATUS
extern std::string g_httpLastError;
extern int g_httpLastCode;
