#include "config.h"
#include <cstdio>
#include <cstring>

#ifdef _3DS
#include <3ds.h>
#endif

static const char *kPath = "sdmc:/3ds/vigia-ai/config.json";
static const char *kDir  = "sdmc:/3ds/vigia-ai";

static bool ensureDir() {
#ifdef _3DS
  // FS: cria pasta se nao existir (mkdir -p)
  // libctru nao tem mkdir direto sem service; usamos fopen como probe
  FILE *f = fopen(kPath, "rb");
  if (f) { fclose(f); return true; }
  // tenta criar diretorio via FS (fallback: escreve arquivo cria pasta)
  // na pratica o HB ja cria sdmc:/3ds/vigia-ai na instalacao
  return true;
#else
  (void)kDir;
  return true;
#endif
}

static std::string trimSlash(std::string s) {
  while (!s.empty() && s.back() == '/') s.pop_back();
  return s;
}

bool configLoad(VigiaConfig &out) {
  ensureDir();
  FILE *f = fopen(kPath, "rb");
  if (!f) return false;
  char buf[1024];
  size_t n = fread(buf, 1, sizeof(buf)-1, f);
  fclose(f);
  buf[n] = '\0';
  std::string s(buf, n);

  // parser minimo sem deps: procura "collector_url":"...".
  auto findStr = [&](const char *key, std::string &dst){
    std::string k = std::string("\"") + key + "\"";
    size_t p = s.find(k);
    if (p == std::string::npos) return false;
    p = s.find(':', p);
    if (p == std::string::npos) return false;
    p = s.find('"', p);
    if (p == std::string::npos) return false;
    size_t q = s.find('"', p+1);
    if (q == std::string::npos) return false;
    dst = s.substr(p+1, q-p-1);
    return true;
  };
  auto findU8 = [&](const char *key, uint8_t &dst){
    std::string k = std::string("\"") + key + "\"";
    size_t p = s.find(k);
    if (p == std::string::npos) return false;
    p = s.find(':', p);
    if (p == std::string::npos) return false;
    int v = 0;
    if (sscanf(s.c_str()+p+1, " %d", &v)==1) { dst = (uint8_t)v; return true; }
    return false;
  };

  findStr("collector_url", out.collectorUrl);
  out.collectorUrl = trimSlash(out.collectorUrl);
  if (out.collectorUrl.empty()) out.collectorUrl = "http://192.168.1.10:8787";
  findU8("theme", out.theme);
  findU8("lang", out.lang);
  findU8("accent", out.accent);
  return true;
}

bool configSave(const VigiaConfig &cfg) {
  ensureDir();
  FILE *f = fopen(kPath, "wb");
  if (!f) return false;
  std::string url = trimSlash(cfg.collectorUrl);
  fprintf(f, "{\n  \"collector_url\": \"%s\",\n  \"theme\": %d,\n  \"lang\": %d,\n  \"accent\": %d\n}\n",
    url.c_str(), (int)cfg.theme, (int)cfg.lang, (int)cfg.accent);
  fclose(f);
  return true;
}

std::string configUsageUrl(const VigiaConfig &c)  { return trimSlash(c.collectorUrl) + "/usage"; }
std::string configHealthUrl(const VigiaConfig &c) { return trimSlash(c.collectorUrl) + "/health"; }
std::string configPanelUrl(const VigiaConfig &c)  { return trimSlash(c.collectorUrl) + "/"; }
