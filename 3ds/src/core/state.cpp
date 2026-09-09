#include "state.h"

UsageSnapshot g_snap;
View g_view = VIEW_HOME;
bool g_requestRefresh = false;
std::string g_netLine;
std::string g_panelUrl;
uint64_t g_lastFetchMs = 0;
uint64_t g_pollMs = 60000;
bool g_hasFetchedOk = false;
uint64_t g_lastFetchOkMs = 0;

int g_claudeIdx = 0, g_gptIdx = 0, g_cursorIdx = 0, g_openrouterIdx = 0;
int g_deepseekIdx = 0, g_opencodeIdx = 0, g_falIdx = 0, g_bitcoinIdx = 0, g_adsenseIdx = 0;
