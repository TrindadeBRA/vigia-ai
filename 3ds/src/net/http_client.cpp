#include "http_client.h"
#include "parse.h"
#include "../core/state.h"
#include "../core/config.h"
#include <cstdio>
#include <cstring>
#include <vector>
#include <chrono>

std::string g_httpLastError;
int g_httpLastCode = 0;

static bool s_socInited = false;
static bool s_httpcInited = false;
static uint64_t s_lastPollMs = 0;
static bool s_forceRefresh = false;

#ifdef _3DS
#include <3ds.h>
#include <malloc.h>
static u32 *SOC_buffer = nullptr;

void httpClientInit(bool *outHttpPatched) {
  if (s_httpcInited) return;
  SOC_buffer = (u32*)memalign(0x1000, 0x100000);
  if (SOC_buffer) {
    Result r = socInit(SOC_buffer, 0x100000);
    if (R_SUCCEEDED(r)) s_socInited = true;
    else {
      // sem soc:U no RSF ou sem WiFi, nao pode travar o app — fica offline mas UI abre
      free(SOC_buffer); SOC_buffer=nullptr;
    }
  }
  Result r = httpcInit(0);
  if (R_SUCCEEDED(r)) s_httpcInited = true;
  else {
    if(s_socInited){ socExit(); s_socInited=false; }
    if(SOC_buffer){ free(SOC_buffer); SOC_buffer=nullptr; }
  }
  if (outHttpPatched) *outHttpPatched = s_httpcInited;
  s_lastPollMs = 0;
}

void httpClientFini() {
  if (s_httpcInited) { httpcExit(); s_httpcInited = false; }
  if (s_socInited) { socExit(); s_socInited = false; }
  if (SOC_buffer) { free(SOC_buffer); SOC_buffer = nullptr; }
}

static std::string httpGet(const std::string &url, int *outCode, std::string *outErr) {
  *outCode = 0;
  if (!s_httpcInited) { if(outErr) *outErr="httpc nao iniciado"; return ""; }
  httpcContext ctx;
  Result r = httpcOpenContext(&ctx, HTTPC_METHOD_GET, url.c_str(), 0);
  if (R_FAILED(r)) { if(outErr) *outErr="httpcOpen falhou"; return ""; }
  httpcSetSSLOpt(&ctx, SSLCOPT_DisableVerify);
  httpcSetKeepAlive(&ctx, HTTPC_KEEPALIVE_ENABLED);
  httpcAddRequestHeaderField(&ctx, "User-Agent", "VigiaAI-3DS/1.0");
  httpcAddRequestHeaderField(&ctx, "Accept", "application/json");
  httpcAddRequestHeaderField(&ctx, "Connection", "close");
  r = httpcBeginRequest(&ctx);
  if (R_FAILED(r)) { httpcCloseContext(&ctx); if(outErr) *outErr="httpcBegin falhou"; return ""; }
  u32 status=0;
  r = httpcGetResponseStatusCode(&ctx, &status);
  *outCode = (int)status;
  if (R_FAILED(r)) { httpcCloseContext(&ctx); if(outErr) *outErr="status falhou"; return ""; }
  // mesmo em 4xx le body para debug
  u32 len=0;
  httpcGetDownloadSizeState(&ctx, NULL, &len);
  std::vector<char> buf;
  buf.reserve(len ? len : 8192);
  u32 read=0;
  // stream até EOF
  while (true) {
    char tmp[2048];
    u32 got=0;
    r = httpcDownloadData(&ctx, (u8*)tmp, sizeof(tmp), &got);
    if (R_FAILED(r) && r != HTTPC_RESULTCODE_DOWNLOADPENDING) break;
    if (got>0) buf.insert(buf.end(), tmp, tmp+got);
    if (r != (Result)HTTPC_RESULTCODE_DOWNLOADPENDING && got==0) break;
    if (got==0) break;
  }
  httpcCloseContext(&ctx);
  return std::string(buf.data(), buf.size());
}

#else
// Host build (sem 3DS) - stub para compilar no Mac sem devkitARM
void httpClientInit(bool *o){ if(o) *o=false; }
void httpClientFini(){}
static std::string httpGet(const std::string &url, int *outCode, std::string *outErr){
  (void)url; *outCode=0; if(outErr) *outErr="stub sem 3DS - rode no hardware"; return "";
}
#endif

bool httpFetchUsage(const std::string &url, std::string *outBody){
  int code=0; std::string err;
  std::string body = httpGet(url, &code, &err);
  g_httpLastCode = code;
  if(outBody) *outBody = body;
  if(code==0){
    g_httpLastError = err.empty() ? "sem rede" : err;
    g_netLine = g_httpLastError;
    markAllAccountsFailed(g_httpLastError.c_str());
    return false;
  }
  if(code!=200){
    g_httpLastError = "HTTP " + std::to_string(code);
    g_netLine = g_httpLastError;
    markAllAccountsFailed(g_httpLastError.c_str());
    return false;
  }
  if(body.empty()){
    g_httpLastError = "body vazio";
    g_netLine = g_httpLastError;
    markAllAccountsFailed("vazio");
    return false;
  }
  bool ok = parseUsageJson(body);
  if(ok){
    g_hasFetchedOk = true;
#ifdef _3DS
    g_lastFetchOkMs = osGetTime();
#else
    g_lastFetchOkMs = (uint64_t)std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();
#endif
    g_httpLastError.clear();
    g_netLine = g_snap.statusLine;
  } else {
    g_httpLastError = "JSON invalido";
    g_netLine = g_httpLastError;
  }
  return ok;
}

bool httpFetchHealth(const std::string &healthUrl){
  int code=0; std::string err;
  std::string body = httpGet(healthUrl, &code, &err);
  if(code!=200 || body.empty()) return false;
  // parser minimo: procura "interval_s": <int>
  auto p = body.find("interval_s");
  if(p!=std::string::npos){
    p = body.find(':', p);
    if(p!=std::string::npos){
      int v=0;
      if(sscanf(body.c_str()+p+1," %d",&v)==1 && v>=15) g_pollMs = (uint64_t)v*1000;
    }
  }
  // panel url para QR (opcional)
  auto q = body.find("\"panel\"");
  if(q!=std::string::npos){
    size_t a=body.find('"', body.find(':',q)+1);
    if(a!=std::string::npos){ size_t b=body.find('"',a+1); if(b!=std::string::npos) g_panelUrl=body.substr(a+1,b-a-1); }
  }
  return true;
}

static uint64_t nowMs(){
#ifdef _3DS
  return osGetTime();
#else
  return (uint64_t)std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();
#endif
}

void httpClientPoll(const std::string &usageUrl){
  uint64_t now = nowMs();
  bool due = (s_lastPollMs==0) || (now - s_lastPollMs >= g_pollMs) || s_forceRefresh;
  if(!due) return;
  s_forceRefresh=false;
  s_lastPollMs = now;
  g_lastFetchMs = now;
  httpFetchUsage(usageUrl);
}

void httpClientRequestRefresh(){ s_forceRefresh=true; }
