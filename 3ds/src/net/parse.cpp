#include "parse.h"
#include "../core/state.h"
#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

// jsmn minimalista inline (single-file). Evita trazer ArduinoJson para CTR.
extern "C" {
typedef enum { JSMN_UNDEFINED=0,JSMN_OBJECT=1,JSMN_ARRAY=2,JSMN_STRING=3,JSMN_PRIMITIVE=4 } jsmntype_t;
typedef struct { jsmntype_t type; int start; int end; int size; } jsmntok_t;
typedef struct { unsigned pos; unsigned toknext; int toksuper; } jsmn_parser;
static void jsmn_init(jsmn_parser *p){p->pos=0;p->toknext=0;p->toksuper=-1;}
static jsmntok_t *jsmn_alloc(jsmn_parser *p, jsmntok_t *t, size_t n){ if(p->toknext>=n) return NULL; return &t[p->toknext++]; }
static void jsmn_fill(jsmntok_t *t, jsmntype_t type, int s,int e){t->type=type;t->start=s;t->end=e;t->size=0;}
static int jsmn_parse(jsmn_parser *p, const char *js, size_t len, jsmntok_t *t, unsigned n);
}
static int jsmn_parse(jsmn_parser *p, const char *js, size_t len, jsmntok_t *t, unsigned n){
  int i; for(;p->pos<len;p->pos++){ char c=js[p->pos];
    switch(c){ case '{': case '[':{ jsmntok_t *tok=jsmn_alloc(p,t,n); if(!tok) return -1; jsmn_fill(tok,c=='{'?JSMN_OBJECT:JSMN_ARRAY,p->pos,-1); tok->size=0; if(p->toksuper!=-1) t[p->toksuper].size++; p->toksuper=p->toknext-1; break; }
      case '}': case ']':{ if(p->toknext<1) return -1; for(i=p->toknext-1;i>=0;i--){ if(t[i].start!=-1 && t[i].end==-1){ if((c=='}'&&t[i].type==JSMN_OBJECT)||(c==']'&&t[i].type==JSMN_ARRAY)){ t[i].end=p->pos+1; p->toksuper=-1; for(int j=i-1;j>=0;j--) if(t[j].start!=-1&&t[j].end==-1){p->toksuper=j;break;} break; } else return -1; } } break; }
      case '"':{ jsmntok_t *tok=jsmn_alloc(p,t,n); if(!tok) return -1; jsmn_fill(tok,JSMN_STRING,p->pos,-1); int start=p->pos+1; p->pos++; for(;p->pos<len && js[p->pos]!='"';p->pos++){ if(js[p->pos]=='\\' && p->pos+1<len) p->pos++; } if(p->pos>=len) return -1; tok->start=start; tok->end=p->pos; tok->size=0; if(p->toksuper!=-1) t[p->toksuper].size++; break; }
      case ':': case ',': case ' ': case '\t': case '\n': case '\r': break;
      default:{ int s=p->pos; while(p->pos<len && js[p->pos]!=' '&&js[p->pos]!='\t'&&js[p->pos]!='\n'&&js[p->pos]!='\r'&&js[p->pos]!=','&&js[p->pos]!='}'&&js[p->pos]!=']'&&js[p->pos]!=':') p->pos++; jsmntok_t *tok=jsmn_alloc(p,t,n); if(!tok) return -1; jsmn_fill(tok,JSMN_PRIMITIVE,s,p->pos); if(p->toksuper!=-1) t[p->toksuper].size++; p->pos--; break; }
    } } for(i=p->toknext-1;i>=0;i--) if(t[i].start!=-1&&t[i].end==-1) return -1; return (int)p->toknext;
}

// helpers
static std::string tokStr(const char *js, const jsmntok_t &t){ return std::string(js+t.start, t.end-t.start); }
static bool tokEq(const char *js, const jsmntok_t &t, const char *s){ size_t n=strlen(s); return (size_t)(t.end-t.start)==n && strncmp(js+t.start,s,n)==0; }

static float tokFloatOrNeg(const char *js, const jsmntok_t &t){
  if(t.type==JSMN_PRIMITIVE){ std::string s=tokStr(js,t); if(s=="null") return -1; char *e=nullptr; double v=strtod(s.c_str(),&e); return (e!=s.c_str())?(float)v:-1; }
  if(t.type==JSMN_STRING){ std::string s=tokStr(js,t); if(s.empty()||s=="null") return -1; char *e=nullptr; double v=strtod(s.c_str(),&e); return (e!=s.c_str())?(float)v:-1; }
  return -1;
}
static int tokIntOrNeg(const char *js, const jsmntok_t &t){
  if(t.type==JSMN_PRIMITIVE){ std::string s=tokStr(js,t); if(s=="null") return -1; char *e=nullptr; long v=strtol(s.c_str(),&e,10); return (e!=s.c_str())?(int)v:-1; }
  return -1;
}
static std::string tokText(const char *js, const jsmntok_t &t){
  if(t.type==JSMN_STRING) return tokStr(js,t);
  if(t.type==JSMN_PRIMITIVE){ std::string s=tokStr(js,t); if(s=="null") return ""; return s; }
  return "";
}

void markAllAccountsFailed(const char *msg){
  std::string m = msg?msg:"erro";
  for(int i=0;i<g_snap.claudeCount;i++){ g_snap.claude[i].ok=false; g_snap.claude[i].error=m; }
  for(int i=0;i<g_snap.gptCount;i++){ g_snap.gpt[i].ok=false; g_snap.gpt[i].error=m; }
  for(int i=0;i<g_snap.cursorCount;i++){ g_snap.cursor[i].ok=false; g_snap.cursor[i].error=m; }
  for(int i=0;i<g_snap.openrouterCount;i++){ g_snap.openrouter[i].ok=false; g_snap.openrouter[i].error=m; }
  for(int i=0;i<g_snap.deepseekCount;i++){ g_snap.deepseek[i].ok=false; g_snap.deepseek[i].error=m; }
  for(int i=0;i<g_snap.opencodeCount;i++){ g_snap.opencode[i].ok=false; g_snap.opencode[i].error=m; }
  for(int i=0;i<g_snap.falCount;i++){ g_snap.fal[i].ok=false; g_snap.fal[i].error=m; }
  for(int i=0;i<g_snap.bitcoinCount;i++){ g_snap.bitcoin[i].ok=false; g_snap.bitcoin[i].error=m; }
  for(int i=0;i<g_snap.adsenseCount;i++){ g_snap.adsense[i].ok=false; g_snap.adsense[i].error=m; }
  if(g_snap.weather.hasData){ g_snap.weather.ok=false; g_snap.weather.error=m; }
  if(g_snap.currencies.hasData){
    g_snap.currencies.ok=false; g_snap.currencies.error=m;
    for(int i=0;i<g_snap.currencies.itemCount;i++){ g_snap.currencies.items[i].ok=false; g_snap.currencies.items[i].error=m; }
  }
}

// asciiFold port firmware/src/net/parse.cpp:208-350
static char foldLatin1(uint32_t cp){
  switch(cp){
    case 0x00C0: case 0x00C1: case 0x00C2: case 0x00C3: case 0x00C4: case 0x00C5: return 'A';
    case 0x00C7: return 'C';
    case 0x00C8: case 0x00C9: case 0x00CA: case 0x00CB: return 'E';
    case 0x00CC: case 0x00CD: case 0x00CE: case 0x00CF: return 'I';
    case 0x00D1: return 'N';
    case 0x00D2: case 0x00D3: case 0x00D4: case 0x00D5: case 0x00D6: case 0x00D8: return 'O';
    case 0x00D9: case 0x00DA: case 0x00DB: case 0x00DC: return 'U';
    case 0x00DD: return 'Y';
    case 0x00E0: case 0x00E1: case 0x00E2: case 0x00E3: case 0x00E4: case 0x00E5: return 'a';
    case 0x00E7: return 'c';
    case 0x00E8: case 0x00E9: case 0x00EA: case 0x00EB: return 'e';
    case 0x00EC: case 0x00ED: case 0x00EE: case 0x00EF: return 'i';
    case 0x00F1: return 'n';
    case 0x00F2: case 0x00F3: case 0x00F4: case 0x00F5: case 0x00F6: case 0x00F8: return 'o';
    case 0x00F9: case 0x00FA: case 0x00FB: case 0x00FC: return 'u';
    case 0x00FD: case 0x00FF: return 'y';
    default: return 0;
  }
}
std::string asciiFold(const std::string &in){
  std::string out; out.reserve(in.size());
  size_t i=0,n=in.size();
  while(i<n){
    uint8_t c=(uint8_t)in[i];
    if(c<0x80){ out+=(char)c; i++; continue; }
    uint32_t cp=0; int len=0;
    if((c&0xE0)==0xC0){ cp=c&0x1F; len=2; }
    else if((c&0xF0)==0xE0){ cp=c&0x0F; len=3; }
    else if((c&0xF8)==0xF0){ cp=c&0x07; len=4; }
    else { i++; continue; }
    if(i+len>n) break;
    bool valid=true;
    for(int k=1;k<len;k++){ uint8_t cc=(uint8_t)in[i+k]; if((cc&0xC0)!=0x80){valid=false;break;} cp=(cp<<6)|(cc&0x3F); }
    if(!valid){ i++; continue; }
    char f=(len==2)?foldLatin1(cp):0;
    if(f) out+=f;
    else if(cp==0x2018||cp==0x2019) out+='\'';
    else if(cp==0x201C||cp==0x201D) out+='"';
    else if(cp==0x2013||cp==0x2014) out+='-';
    else if(cp==0x2026) out+="...";
    else out+='?';
    i+=len;
  }
  return out;
}

// JSON navigation helpers for jsmn flat token array
struct JCtx { const char *js; jsmntok_t *t; int n; };
static int objFind(JCtx &c, int objIdx, const char *key){
  if(objIdx<0||objIdx>=c.n) return -1;
  if(c.t[objIdx].type!=JSMN_OBJECT) return -1;
  int i=objIdx+1;
  for(int k=0;k<c.t[objIdx].size;k++){
    if(i>=c.n) return -1;
    // key at i, value at i+1
    if(tokEq(c.js,c.t[i],key)) return i+1;
    // skip value subtree
    int skip=1;
    // count tokens in value subtree: if object/array, need to jump over children
    // jsmn size is number of direct children, need recursive count.
    // Simple: walk tokens counting until we consumed size.
    // For our usage (flat), we can use a stack count:
    int depth = 0;
    // naive: look ahead for next sibling: we can compute total tokens by scanning
    // We'll compute by iterating until we consumed value's tokens via size recursion.
    // Simpler: brute force skip by counting tokens that belong to value.
    // For primitive/string: 1 token. For array/object: 1 + sum(children).
    // We'll compute recursively with helper.
    auto countTokens = [&](auto &&self, int idx)->int{
      if(idx>=c.n) return 0;
      int cnt=1;
      int sz=c.t[idx].size;
      // for object, size is number of keys (each key is 1 token + value subtree)
      // for array, size is number of elements (each is subtree)
      int child = idx+1;
      if(c.t[idx].type==JSMN_OBJECT){
        for(int j=0;j<sz;j++){
          // key
          cnt+=1; child+=1;
          // value
          int sub=self(self, child-1); // child-1 is value idx? Actually we already counted key, value starts at child-1+1?
          // Fix: after key, value is at child-1? Let's re-derive simpler.
          cnt+=0; // placeholder
        }
      }
      return cnt;
    };
    // Instead of complex recursion, use end position to find next sibling:
    // Find the token whose start is after value's end at same depth.
    // jsmn provides end offset in string; next key must start after value end.
    // Find next index j where t[j].start >= t[i+1].end (if value has end) or fallback.
    int valIdx=i+1;
    if(valIdx>=c.n) return -1;
    int valEnd=c.t[valIdx].end;
    // object/array may have children whose end > valEnd, use max end in subtree:
    // Expand valEnd to max end of all tokens whose start < current valEnd and are inside.
    // For our JSON (max 5 accounts, flat), a simple linear scan after valIdx works:
    // count how many tokens are inside valEnd by scanning.
    int next = valIdx+1;
    while(next<c.n && c.t[next].start < valEnd) next++;
    // But for array/object, valEnd is at closing bracket, children are inside.
    // So the above while will skip whole subtree correctly.
    // For primitive/string, valEnd is already after token, next is immediate sibling.
    // Edge: nested arrays with same end? still works.
    // Fallback for primitive where end may be -1 (shouldn't)
    if(c.t[valIdx].end==-1){
      next = valIdx+1;
    }
    // verify: if value was array/object, next computed as after subtree
    // else next = valIdx+1
    if(c.t[valIdx].type==JSMN_PRIMITIVE || c.t[valIdx].type==JSMN_STRING){
      next = valIdx+1;
    }
    // proceed
    (void)skip; (void)countTokens;
    i = next;
  }
  return -1;
}

static int arrSize(JCtx &c, int arrIdx){
  if(arrIdx<0||arrIdx>=c.n) return 0;
  if(c.t[arrIdx].type!=JSMN_ARRAY) return 0;
  return c.t[arrIdx].size;
}
static int arrElem(JCtx &c, int arrIdx, int elem){
  if(arrIdx<0||arrIdx>=c.n) return -1;
  if(c.t[arrIdx].type!=JSMN_ARRAY) return -1;
  int cur = arrIdx+1;
  for(int k=0;k<elem;k++){
    if(cur>=c.n) return -1;
    // skip subtree at cur
    int end=c.t[cur].end;
    int nxt=cur+1;
    while(nxt<c.n && c.t[nxt].start < end) nxt++;
    if(c.t[cur].type==JSMN_PRIMITIVE||c.t[cur].type==JSMN_STRING) nxt=cur+1;
    cur=nxt;
  }
  return cur;
}

// Fill functions matching parse.cpp helpers
static void fillClaude(JCtx &c, int idx, ClaudeAccount &o){
  int v;
  v=objFind(c,idx,"id"); o.id = (v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"label"); o.label = (v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"ok"); o.ok = (v>=0)? (tokEq(c.js,c.t[v],"true")):false;
  v=objFind(c,idx,"error"); o.error = (v>=0 && !(c.t[v].type==JSMN_PRIMITIVE && tokEq(c.js,c.t[v],"null")))?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"session_percent"); o.sessionPercent = (v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"session_resets_at"); o.sessionResets = (v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"weekly_percent"); o.weeklyPercent = (v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"weekly_resets_at"); o.weeklyResets = (v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"sonnet_percent"); o.sonnetPercent = (v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"sonnet_resets_at"); o.sonnetResets = (v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"opus_percent"); o.opusPercent = (v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"opus_resets_at"); o.opusResets = (v>=0)?tokText(c.js,c.t[v]):"";
}
static void fillGpt(JCtx &c,int idx,GptAccount &o){
  int v; v=objFind(c,idx,"id"); o.id=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"label"); o.label=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"ok"); o.ok=(v>=0)?tokEq(c.js,c.t[v],"true"):false;
  v=objFind(c,idx,"error"); o.error=(v>=0 && !(c.t[v].type==JSMN_PRIMITIVE&&tokEq(c.js,c.t[v],"null")))?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"session_percent"); o.sessionPercent=(v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"session_resets_at"); o.sessionResets=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"weekly_percent"); o.weeklyPercent=(v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"weekly_resets_at"); o.weeklyResets=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"plan"); o.plan=(v>=0)?tokText(c.js,c.t[v]):"";
}
static void fillCursor(JCtx &c,int idx,CursorAccount &o){
  int v; v=objFind(c,idx,"id"); o.id=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"label"); o.label=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"ok"); o.ok=(v>=0)?tokEq(c.js,c.t[v],"true"):false;
  v=objFind(c,idx,"error"); o.error=(v>=0 && !(c.t[v].type==JSMN_PRIMITIVE&&tokEq(c.js,c.t[v],"null")))?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"percent"); o.percent=(v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"other_percent"); o.otherPercent=(v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"used_cents"); o.usedCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"limit_cents"); o.limitCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"remaining_cents"); o.remainingCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"bonus_cents"); o.bonusCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"requests_used"); o.requestsUsed=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"requests_limit"); o.requestsLimit=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"cycle_end"); o.cycleEnd=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"plan"); o.plan=(v>=0)?tokText(c.js,c.t[v]):"";
}
static void fillCredits(JCtx &c,int idx, OpenRouterAccount &o){
  int v; v=objFind(c,idx,"id"); o.id=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"label"); o.label=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"ok"); o.ok=(v>=0)?tokEq(c.js,c.t[v],"true"):false;
  v=objFind(c,idx,"error"); o.error=(v>=0 && !(c.t[v].type==JSMN_PRIMITIVE&&tokEq(c.js,c.t[v],"null")))?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"percent"); o.percent=(v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"limit_cents"); o.limitCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"used_cents"); o.usedCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"remaining_cents"); o.remainingCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
}
static void fillOpenCode(JCtx &c,int idx, OpenCodeAccount &o){
  int v; v=objFind(c,idx,"id"); o.id=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"label"); o.label=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"ok"); o.ok=(v>=0)?tokEq(c.js,c.t[v],"true"):false;
  v=objFind(c,idx,"error"); o.error=(v>=0 && !(c.t[v].type==JSMN_PRIMITIVE&&tokEq(c.js,c.t[v],"null")))?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"rolling_percent"); o.rollingPercent=(v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"rolling_resets_at"); o.rollingResets=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"weekly_percent"); o.weeklyPercent=(v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"weekly_resets_at"); o.weeklyResets=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"monthly_percent"); o.monthlyPercent=(v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"monthly_resets_at"); o.monthlyResets=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"percent"); o.percent=(v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"limit_cents"); o.limitCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"used_cents"); o.usedCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"remaining_cents"); o.remainingCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
}
static void fillFal(JCtx &c,int idx,FalAccount &o){
  OpenRouterAccount tmp; fillCredits(c,idx,tmp);
  o.id=tmp.id; o.label=tmp.label; o.ok=tmp.ok; o.error=tmp.error; o.percent=tmp.percent;
  o.limitCents=tmp.limitCents; o.usedCents=tmp.usedCents; o.remainingCents=tmp.remainingCents;
}
static void fillDeepSeek(JCtx &c,int idx,DeepSeekAccount &o){
  OpenRouterAccount tmp; fillCredits(c,idx,tmp);
  o.id=tmp.id; o.label=tmp.label; o.ok=tmp.ok; o.error=tmp.error; o.percent=tmp.percent;
  o.limitCents=tmp.limitCents; o.usedCents=tmp.usedCents; o.remainingCents=tmp.remainingCents;
}
static void fillBitcoin(JCtx &c,int idx,BitcoinAccount &o){
  int v; v=objFind(c,idx,"id"); o.id=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"label"); o.label=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"ok"); o.ok=(v>=0)?tokEq(c.js,c.t[v],"true"):false;
  v=objFind(c,idx,"error"); o.error=(v>=0 && !(c.t[v].type==JSMN_PRIMITIVE&&tokEq(c.js,c.t[v],"null")))?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"address"); o.address=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"balance_btc"); o.balanceBtc=(v>=0)?tokFloatOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"price_usd_cents"); o.priceUsdCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"price_brl_cents"); o.priceBrlCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"value_usd_cents"); o.valueUsdCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"value_brl_cents"); o.valueBrlCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
}
static void fillAdsense(JCtx &c,int idx,AdsenseAccount &o){
  int v; v=objFind(c,idx,"id"); o.id=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"label"); o.label=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"ok"); o.ok=(v>=0)?tokEq(c.js,c.t[v],"true"):false;
  v=objFind(c,idx,"error"); o.error=(v>=0 && !(c.t[v].type==JSMN_PRIMITIVE&&tokEq(c.js,c.t[v],"null")))?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"currency"); o.currency=(v>=0)?tokText(c.js,c.t[v]):"";
  v=objFind(c,idx,"today_cents"); o.todayCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"unpaid_cents"); o.unpaidCents=(v>=0)?tokIntOrNeg(c.js,c.t[v]):-1;
  v=objFind(c,idx,"account_name"); o.accountName=(v>=0)?tokText(c.js,c.t[v]):"";
}

bool parseUsageJson(const std::string &body){
  const char *js=body.c_str();
  size_t len=body.size();
  // alloc tokens: body up to ~80KB, estimate 2048 tokens (each account ~15 tokens * 45 accounts + overhead)
  const int MAX_TOK = 4096;
  jsmntok_t *t = new jsmntok_t[MAX_TOK];
  jsmn_parser p; jsmn_init(&p);
  int rc = jsmn_parse(&p, js, len, t, MAX_TOK);
  if(rc<0){
    markAllAccountsFailed("JSON");
    delete[] t;
    return false;
  }
  JCtx c{js,t,rc};
  if(rc==0 || t[0].type!=JSMN_OBJECT){
    markAllAccountsFailed("JSON");
    delete[] t;
    return false;
  }

  auto getArr = [&](const char *key)->int{
    int v=objFind(c,0,key);
    if(v<0) return -1;
    if(c.t[v].type!=JSMN_ARRAY) return -1;
    return v;
  };

  int v;
  v=objFind(c,0,"updated_at");
  g_snap.updatedAt = (v>=0)?tokText(js,t[v]):"";

  // claude
  g_snap.claudeCount=0;
  { int arr=getArr("claude"); if(arr>=0){ int n=arrSize(c,arr); for(int i=0;i<n && g_snap.claudeCount<MAX_ACCOUNTS;i++){ int ei=arrElem(c,arr,i); if(ei<0) break; fillClaude(c,ei,g_snap.claude[g_snap.claudeCount++]); } } }
  g_snap.gptCount=0;
  { int arr=getArr("gpt"); if(arr>=0){ int n=arrSize(c,arr); for(int i=0;i<n && g_snap.gptCount<MAX_ACCOUNTS;i++){ int ei=arrElem(c,arr,i); if(ei<0) break; fillGpt(c,ei,g_snap.gpt[g_snap.gptCount++]); } } }
  g_snap.cursorCount=0;
  { int arr=getArr("cursor"); if(arr>=0){ int n=arrSize(c,arr); for(int i=0;i<n && g_snap.cursorCount<MAX_ACCOUNTS;i++){ int ei=arrElem(c,arr,i); if(ei<0) break; fillCursor(c,ei,g_snap.cursor[g_snap.cursorCount++]); } } }
  g_snap.openrouterCount=0;
  { int arr=getArr("openrouter"); if(arr>=0){ int n=arrSize(c,arr); for(int i=0;i<n && g_snap.openrouterCount<MAX_ACCOUNTS;i++){ int ei=arrElem(c,arr,i); if(ei<0) break; { OpenRouterAccount tmp; fillCredits(c,ei,tmp); g_snap.openrouter[g_snap.openrouterCount++]=tmp; } } } }
  g_snap.deepseekCount=0;
  { int arr=getArr("deepseek"); if(arr>=0){ int n=arrSize(c,arr); for(int i=0;i<n && g_snap.deepseekCount<MAX_ACCOUNTS;i++){ int ei=arrElem(c,arr,i); if(ei<0) break; { OpenRouterAccount tmp; fillCredits(c,ei,tmp); DeepSeekAccount d; d.id=tmp.id; d.label=tmp.label; d.ok=tmp.ok; d.error=tmp.error; d.percent=tmp.percent; d.limitCents=tmp.limitCents; d.usedCents=tmp.usedCents; d.remainingCents=tmp.remainingCents; g_snap.deepseek[g_snap.deepseekCount++]=d; } } } }
  g_snap.opencodeCount=0;
  { int arr=getArr("opencode"); if(arr>=0){ int n=arrSize(c,arr); for(int i=0;i<n && g_snap.opencodeCount<MAX_ACCOUNTS;i++){ int ei=arrElem(c,arr,i); if(ei<0) break; fillOpenCode(c,ei,g_snap.opencode[g_snap.opencodeCount++]); } } }
  g_snap.falCount=0;
  { int arr=getArr("fal"); if(arr>=0){ int n=arrSize(c,arr); for(int i=0;i<n && g_snap.falCount<MAX_ACCOUNTS;i++){ int ei=arrElem(c,arr,i); if(ei<0) break; FalAccount f; fillFal(c,ei,f); g_snap.fal[g_snap.falCount++]=f; } } }
  g_snap.bitcoinCount=0;
  { int arr=getArr("bitcoin"); if(arr>=0){ int n=arrSize(c,arr); for(int i=0;i<n && g_snap.bitcoinCount<MAX_ACCOUNTS;i++){ int ei=arrElem(c,arr,i); if(ei<0) break; fillBitcoin(c,ei,g_snap.bitcoin[g_snap.bitcoinCount++]); } } }
  g_snap.adsenseCount=0;
  { int arr=getArr("adsense"); if(arr>=0){ int n=arrSize(c,arr); for(int i=0;i<n && g_snap.adsenseCount<MAX_ACCOUNTS;i++){ int ei=arrElem(c,arr,i); if(ei<0) break; fillAdsense(c,ei,g_snap.adsense[g_snap.adsenseCount++]); } } }

  // weather
  {
    int w = objFind(c,0,"weather");
    if(w>=0 && c.t[w].type==JSMN_OBJECT){
      g_snap.weather.hasData=true;
      int ov=objFind(c,w,"ok"); g_snap.weather.ok = (ov>=0)?tokEq(js,t[ov],"true"):false;
      int ev=objFind(c,w,"error"); g_snap.weather.error=(ev>=0 && !(t[ev].type==JSMN_PRIMITIVE&&tokEq(js,t[ev],"null")))?tokText(js,t[ev]):"";
      // current object flat
      int cur=objFind(c,w,"current");
      if(cur>=0 && t[cur].type==JSMN_OBJECT){
        int tv;
        tv=objFind(c,cur,"temperature_2m"); if(tv>=0) g_snap.weather.temperature=tokFloatOrNeg(js,t[tv]);
        tv=objFind(c,cur,"apparent_temperature"); if(tv>=0) g_snap.weather.feelsLike=tokFloatOrNeg(js,t[tv]);
        tv=objFind(c,cur,"relative_humidity_2m"); if(tv>=0) g_snap.weather.humidity=tokFloatOrNeg(js,t[tv]);
        tv=objFind(c,cur,"wind_speed_10m"); if(tv>=0) g_snap.weather.windSpeed=tokFloatOrNeg(js,t[tv]);
        tv=objFind(c,cur,"precipitation"); if(tv>=0) g_snap.weather.precipitation=tokFloatOrNeg(js,t[tv]);
        tv=objFind(c,cur,"weather_code"); if(tv>=0) g_snap.weather.weatherCode=tokIntOrNeg(js,t[tv]);
      }
      int cu=objFind(c,w,"current_units");
      if(cu>=0 && t[cu].type==JSMN_OBJECT){
        int tu=objFind(c,cu,"temperature_2m"); if(tu>=0){ std::string u=tokText(js,t[tu]); if(!u.empty()) g_snap.weather.tempUnit=u; }
        int wu=objFind(c,cu,"wind_speed_10m"); if(wu>=0){ std::string u=tokText(js,t[wu]); if(!u.empty()) g_snap.weather.windUnit=u; }
        int pu=objFind(c,cu,"precipitation"); if(pu>=0){ std::string u=tokText(js,t[pu]); if(!u.empty()) g_snap.weather.precipUnit=u; }
      }
      int loc=objFind(c,w,"location");
      if(loc>=0 && t[loc].type==JSMN_OBJECT){
        int nm=objFind(c,loc,"name"); if(nm>=0) g_snap.weather.locationName=tokText(js,t[nm]);
      }
      int daily=objFind(c,w,"daily");
      if(daily>=0 && t[daily].type==JSMN_OBJECT){
        int tmax=objFind(c,daily,"temperature_2m_max");
        if(tmax>=0 && t[tmax].type==JSMN_ARRAY && arrSize(c,tmax)>0){
          int e0=arrElem(c,tmax,0); if(e0>=0) g_snap.weather.tempMax=tokFloatOrNeg(js,t[e0]);
        }
        int tmin=objFind(c,daily,"temperature_2m_min");
        if(tmin>=0 && t[tmin].type==JSMN_ARRAY && arrSize(c,tmin)>0){
          int e0=arrElem(c,tmin,0); if(e0>=0) g_snap.weather.tempMin=tokFloatOrNeg(js,t[e0]);
        }
      }
      // normaliza unidade (celsius->C) igual parse.cpp
      if(g_snap.weather.tempUnit=="celsius"||g_snap.weather.tempUnit=="°C") g_snap.weather.tempUnit="C";
      if(g_snap.weather.tempUnit=="fahrenheit"||g_snap.weather.tempUnit=="°F") g_snap.weather.tempUnit="F";
    } else {
      g_snap.weather.hasData=false; g_snap.weather.ok=false; g_snap.weather.error.clear();
    }
  }
  // currencies
  {
    int cu=objFind(c,0,"currencies");
    if(cu>=0 && t[cu].type==JSMN_OBJECT){
      g_snap.currencies.hasData=true;
      int ov=objFind(c,cu,"ok"); g_snap.currencies.ok=(ov>=0)?tokEq(js,t[ov],"true"):false;
      int ev=objFind(c,cu,"error"); g_snap.currencies.error=(ev>=0&&!(t[ev].type==JSMN_PRIMITIVE&&tokEq(js,t[ev],"null")))?tokText(js,t[ev]):"";
      int bv=objFind(c,cu,"base"); g_snap.currencies.base=(bv>=0)?tokText(js,t[bv]):"BRL";
      if(g_snap.currencies.base.empty()) g_snap.currencies.base="BRL";
      g_snap.currencies.itemCount=0;
      int arr=objFind(c,cu,"items");
      if(arr>=0 && t[arr].type==JSMN_ARRAY){
        int n=arrSize(c,arr);
        for(int i=0;i<n && g_snap.currencies.itemCount<MAX_CURRENCY_ITEMS;i++){
          int ei=arrElem(c,arr,i); if(ei<0) break;
          CurrencyQuote &q=g_snap.currencies.items[g_snap.currencies.itemCount++];
          int vv;
          vv=objFind(c,ei,"id"); q.id=(vv>=0)?tokText(js,t[vv]):"";
          vv=objFind(c,ei,"kind"); q.kind=(vv>=0)?tokText(js,t[vv]):"";
          vv=objFind(c,ei,"code"); q.code=(vv>=0)?tokText(js,t[vv]):"";
          vv=objFind(c,ei,"label"); q.label=(vv>=0)?tokText(js,t[vv]):"";
          vv=objFind(c,ei,"ok"); q.ok=(vv>=0)?tokEq(js,t[vv],"true"):false;
          vv=objFind(c,ei,"error"); q.error=(vv>=0&&!(t[vv].type==JSMN_PRIMITIVE&&tokEq(js,t[vv],"null")))?tokText(js,t[vv]):"";
          vv=objFind(c,ei,"price"); q.price=(vv>=0)?tokFloatOrNeg(js,t[vv]):-1;
        }
      }
    } else {
      g_snap.currencies.hasData=false; g_snap.currencies.ok=false; g_snap.currencies.error.clear(); g_snap.currencies.itemCount=0;
    }
  }

  if(g_snap.updatedAt.size()>=16) g_snap.statusLine=g_snap.updatedAt.substr(11,5);
  else g_snap.statusLine="ok";
  g_snap.httpOk=true;

  delete[] t;
  return true;
}
