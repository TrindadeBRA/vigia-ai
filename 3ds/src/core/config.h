#pragma once
// Config persistida no SD - equivalente a firmware/src/secrets.h + backend/data/config.json
// Arquivo: sdmc:/3ds/vigia-ai/config.json
// { "collector_url": "http://192.168.1.10:8787", "theme":0, "lang":0 }

#include <string>
#include <cstdint>

struct VigiaConfig {
  std::string collectorUrl = "http://192.168.3.58:8787"; // hardcode teste 3DS
  uint8_t theme = 0; // 0 dark 1 light 2 contrast
  uint8_t lang = 0;  // 0 pt 1 en 2 es
  uint8_t accent = 0;
};

bool configLoad(VigiaConfig &out);
bool configSave(const VigiaConfig &cfg);
std::string configUsageUrl(const VigiaConfig &cfg);  // collectorUrl + "/usage"
std::string configHealthUrl(const VigiaConfig &cfg); // collectorUrl + "/health" (| /api/health)
std::string configPanelUrl(const VigiaConfig &cfg);  // collectorUrl + "/"
