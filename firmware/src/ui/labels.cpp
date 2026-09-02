#include "ui/internal.h"

#include <math.h>

#include "ui/i18n.h"

String withResta(float pct, const String &whenRaw)
{
  String s = String(uiTr().remainingPrefix) + fmtRemain(pct);
  if (whenRaw.length())
  {
    s += "  |  " + fmtWhen(whenRaw);
  }
  return s;
}

String gptPlanTitle(const GptAccount &g)
{
  if (!g.ok || !g.plan.length())
  {
    return "GPT";
  }
  return String("GPT ") + g.plan;
}

String cursorPlanTitle(const CursorAccount &c)
{
  if (!c.ok || !c.plan.length())
  {
    return "Cursor";
  }
  return String("Cursor ") + c.plan;
}

// Sufixo mostrado ao lado do nome do provedor: o apelido da conta e, com
// mais de uma conta do mesmo provedor, "+N" pras outras (a que é mostrada
// já não entra nessa conta). Sempre desenhado menor e apagado por
// drawTitleWithLabel — nunca some acento (fonte 2 da TFT_eSPI nao cobre
// Latin-1, ver i18n.h), mas o peso visual fica menor que o nome de propósito.
String accountSuffixText(const String &label, int count)
{
  String s = label;
  if (count > 1)
  {
    if (s.length())
    {
      s += " ";
    }
    s += "+";
    s += String(count - 1);
  }
  return s;
}

// Nome do provedor em destaque (fonte 2, cor normal) seguido do apelido/
// sufixo em fonte menor e cor apagada, na mesma linha — trunca o sufixo
// letra a letra se não houver espaço (nunca ultrapassa maxW, nunca disputa
// peso visual com o nome). Usado no card da Início/Agora e no detalhe.
void drawTitleWithLabel(int x, int y, int maxW, const String &name, const String &suffix)
{
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT, COL_CARD);
  tft.drawString(name, x, y, 2);
  if (!suffix.length())
  {
    return;
  }
  const int nameW = tft.textWidth(name, 2);
  const int sepW = tft.textWidth(" ", 1);
  const int avail = maxW - nameW - sepW;
  if (avail < 12)
  {
    return;
  }
  String s = suffix;
  while (s.length() && tft.textWidth(s, 1) > avail)
  {
    s.remove(s.length() - 1);
  }
  if (!s.length())
  {
    return;
  }
  const int ly = y + (tft.fontHeight(2) - tft.fontHeight(1)) / 2;
  tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
  tft.drawString(s, x + nameW + sepW, ly, 1);
}

// Altura ocupada por drawStackedTitle() com (ou sem) apelido — usado pra
// centralizar o bloco de texto antes de desenhar (ver paintNow).
int stackedTitleHeight(bool hasLabel)
{
  return hasLabel ? (tft.fontHeight(2) + 1 + tft.fontHeight(1)) : tft.fontHeight(2);
}

// Nome numa linha e, se houver apelido, o apelido/sufixo numa segunda linha
// logo abaixo (fonte menor, cor apagada) — cada linha usa maxW inteiro pra
// si (não dividem espaço como em drawTitleWithLabel), pra caber em colunas
// bem estreitas (ex.: título na tela Agora, só ~80px de largura).
void drawStackedTitle(int x, int y, int maxW, const String &name, const String &suffix)
{
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT, COL_CARD);
  String n = name;
  while (n.length() && tft.textWidth(n, 2) > maxW)
  {
    n.remove(n.length() - 1);
  }
  tft.drawString(n, x, y, 2);
  if (!suffix.length())
  {
    return;
  }
  String s = suffix;
  while (s.length() && tft.textWidth(s, 1) > maxW)
  {
    s.remove(s.length() - 1);
  }
  if (!s.length())
  {
    return;
  }
  tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
  tft.drawString(s, x, y + tft.fontHeight(2) + 1, 1);
}

String cursorOndemand(const CursorAccount &c)
{
  String s;
  if (c.usedCents >= 0 && c.limitCents >= 0)
  {
    s = fmtUsdSite(c.usedCents) + " / " + fmtUsdSite(c.limitCents);
  }
  if (c.bonusCents > 0)
  {
    if (s.length())
    {
      s += "  ";
    }
    s += String(uiTr().bonusPrefix) + fmtUsdSite(c.bonusCents);
  }
  return s;
}

String openrouterRemain(const OpenRouterAccount &o)
{
  if (o.limitCents >= 0)
  {
    return String(uiTr().remainMoney) + fmtUsdSite(o.remainingCents);
  }
  return String(uiTr().noCredits);
}

// So o valor, sem o prefixo "restam" — mesmo papel de deepseekBalance() pro
// card da Início: OpenRouter e DeepSeek sao saldo pago-conforme-uso (nao
// reseta), nao assinatura com janela, entao o card mostra o saldo restante
// em vez de uma barra de "% gasto historico" (ver docs/DECISOES.md).
String openrouterBalance(const OpenRouterAccount &o)
{
  return o.remainingCents >= 0 ? fmtUsdSite(o.remainingCents) : String(uiTr().noCredits);
}

// A DeepSeek so devolve saldo atual (sem teto/limite historico — ver
// docs/APIS_DEEPSEEK.md), entao limitCents fica sempre -1 por design; o que
// importa aqui e remainingCents mesmo.
String deepseekRemain(const DeepSeekAccount &d)
{
  if (d.remainingCents >= 0)
  {
    return String(uiTr().remainMoney) + fmtUsdSite(d.remainingCents);
  }
  return String(uiTr().noCredits);
}

// So o valor, sem o prefixo "restam" — usado no card da Início, onde o
// espaço ao lado do rótulo "Créditos" é estreito demais pra frase inteira.
String deepseekBalance(const DeepSeekAccount &d)
{
  return d.remainingCents >= 0 ? fmtUsdSite(d.remainingCents) : String(uiTr().noCredits);
}

// OpenCode unifica assinatura (janelas rolling/semanal/mensal) e saldo
// pago-conforme-uso. O destaque do card é a janela rolling (~5h), como o
// Claude/GPT; o saldo do Zen aparece como valor extra quando disponível.
String opencodeRemain(const OpenCodeAccount &o)
{
  if (o.rollingPercent >= 0)
  {
    return withResta(o.rollingPercent, o.rollingResets);
  }
  if (o.remainingCents >= 0)
  {
    return String(uiTr().remainMoney) + fmtUsdSite(o.remainingCents);
  }
  return String(uiTr().noCredits);
}

// So o valor, sem o prefixo "restam" — usado no card da Início.
String opencodeBalance(const OpenCodeAccount &o)
{
  if (o.remainingCents >= 0)
  {
    return fmtUsdSite(o.remainingCents);
  }
  return String(uiTr().noCredits);
}

// fal.ai e saldo de creditos (nao assinatura) — o destaque e o saldo restante.
String falRemain(const FalAccount &f)
{
  if (f.remainingCents >= 0)
  {
    return String(uiTr().remainMoney) + fmtUsdSite(f.remainingCents);
  }
  return String(uiTr().noCredits);
}

// So o valor, sem o prefixo "restam" — usado no card da Início.
String falBalance(const FalAccount &f)
{
  return f.remainingCents >= 0 ? fmtUsdSite(f.remainingCents) : String(uiTr().noCredits);
}

// Bitcoin nao e assinatura nem saldo pago-conforme-uso — e um endereco
// publico de carteira. O card mostra 2 valores (saldo em BTC e o
// equivalente em USD/BRL), nunca uma barra de percentual.
String bitcoinBalance(const BitcoinAccount &b)
{
  return b.balanceBtc >= 0 ? fmtBtc(b.balanceBtc) : String(uiTr().noData);
}

String bitcoinValueText(const BitcoinAccount &b)
{
  if (b.valueUsdCents < 0 && b.valueBrlCents < 0)
  {
    return String(uiTr().noData);
  }
  String s = fmtUsdSite(b.valueUsdCents);
  if (b.valueBrlCents >= 0)
  {
    s += " / " + fmtBrlSite(b.valueBrlCents);
  }
  return s;
}

String adsenseTodayText(const AdsenseAccount &a)
{
  return a.todayCents >= 0 ? fmtMoney(a.todayCents, a.currency) : String(uiTr().noData);
}

String adsenseWalletText(const AdsenseAccount &a)
{
  return a.unpaidCents >= 0 ? fmtMoney(a.unpaidCents, a.currency) : String(uiTr().noData);
}

bool currenciesVisible()
{
  if (!g_snap.currencies.hasData)
  {
    return false;
  }
  if (g_snap.currencies.itemCount > 0)
  {
    return true;
  }
  return !g_snap.currencies.ok && g_snap.currencies.error.length() > 0;
}

String currencyQuoteLabel(const CurrencyQuote &q)
{
  if (q.label.length())
  {
    return q.label;
  }
  String c = q.code;
  if (q.kind == "crypto" && c.length() <= 6)
  {
    c.toUpperCase();
  }
  return c.length() ? c : String("--");
}

String currencyQuoteValue(const CurrencyQuote &q, const String &base)
{
  if (!q.ok)
  {
    return q.error.length() ? q.error : String(uiTr().noData);
  }
  return fmtCurrencyAmount(q.price, base);
}

bool weatherVisible()
{
  if (!g_snap.weather.hasData)
  {
    return false;
  }
  if (g_snap.weather.locationName.length())
  {
    return true;
  }
  if (g_snap.weather.temperature > -900)
  {
    return true;
  }
  return !g_snap.weather.ok && g_snap.weather.error.length() > 0;
}

const char *weatherWmoText(int code)
{
  switch (code)
  {
  case 0:
    return "sol";
  case 1:
    return "sol/nuv";
  case 2:
    return "nuv/sol";
  case 3:
    return "nublado";
  case 45:
  case 48:
    return "nevoa";
  case 51:
  case 53:
  case 55:
  case 56:
  case 57:
    return "garoa";
  case 61:
  case 63:
  case 65:
  case 66:
  case 67:
    return "chuva";
  case 71:
  case 73:
  case 75:
  case 77:
    return "neve";
  case 80:
  case 81:
  case 82:
    return "pancada";
  case 85:
  case 86:
    return "neve";
  case 95:
  case 96:
  case 99:
    return "trovoada";
  default:
    return "clima";
  }
}

static String weatherFmtTemp(float v, const String &unit)
{
  if (v <= -900)
  {
    return String(uiTr().noData);
  }
  char buf[16];
  const char *u = "C";
  if (unit.indexOf('F') >= 0 || unit.indexOf('f') >= 0)
  {
    u = "F";
  }
  snprintf(buf, sizeof(buf), "%d %s", (int)roundf(v), u);
  return String(buf);
}

String weatherTempText(const WeatherData &w)
{
  return weatherFmtTemp(w.temperature, w.tempUnit);
}

String weatherConditionText(const WeatherData &w)
{
  if (w.weatherCode < 0)
  {
    return String(uiTr().noData);
  }
  return String(weatherWmoText(w.weatherCode));
}

String weatherFeelsText(const WeatherData &w)
{
  if (w.feelsLike <= -900)
  {
    return "";
  }
  return weatherFmtTemp(w.feelsLike, w.tempUnit);
}

String weatherHumidityText(const WeatherData &w)
{
  if (w.humidity < 0)
  {
    return "";
  }
  return String((int)roundf(w.humidity)) + "%";
}

String weatherWindText(const WeatherData &w)
{
  if (w.windSpeed < 0)
  {
    return "";
  }
  return String((int)roundf(w.windSpeed)) + " " + w.windUnit;
}

String weatherPrecipText(const WeatherData &w)
{
  if (w.precipitation < 0)
  {
    return "";
  }
  char buf[16];
  snprintf(buf, sizeof(buf), "%.1f", w.precipitation);
  return String(buf) + " " + w.precipUnit;
}

String weatherHighText(const WeatherData &w)
{
  if (w.tempMax <= -900)
  {
    return "";
  }
  return weatherFmtTemp(w.tempMax, w.tempUnit);
}

String weatherLowText(const WeatherData &w)
{
  if (w.tempMin <= -900)
  {
    return "";
  }
  return weatherFmtTemp(w.tempMin, w.tempUnit);
}

const char *emptyProvidersMsg()
{
  if (!g_hasFetchedOk)
  {
    if (g_snap.statusLine == "Wi-Fi")
    {
      return uiTr().waitingWifi;
    }
    return uiTr().waitingCollector;
  }
  return uiTr().noProviders;
}
