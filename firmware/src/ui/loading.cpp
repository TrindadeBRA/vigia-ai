#include "ui/internal.h"

#include "ui/i18n.h"
#include "net/usage_client.h"

#include <WiFi.h>

static void loadingDelay(uint32_t ms) {
  delay(ms);
  yield();
}

// Tela de loading pos-splash: bloco central minimalista (olho + marca +
// titulo com dots animados + barra indeterminada). Antes tinha um grid de
// cards placeholder com shimmer (inspirado no Skeleton da web) — poluido
// pra pouco ganho, já que o usuário só precisa saber "ainda carregando".
// Fica visivel enquanto o coletor ainda nao respondeu (ver g_hasFetchedOk).
// Chamada uma vez em main.cpp após uiShowSplash().
//
// Só sai quando g_hasFetchedOk vira true (primeira leitura bem-sucedida do
// /events do coletor) — sem isso a Início aparecia vazia/com placeholder de
// "aguardando" antes mesmo da Wi-Fi terminar de conectar. Bombeia
// usageClientEnsureWifi()/usageClientPoll() a cada frame porque, sem o
// loop() principal rodando ainda, ninguém mais chamaria essas funções
// enquanto essa tela está em pé.
//
// g_bootLoading (ver core/state.h) fica true durante todo esse loop: o
// primeiro fetch bem-sucedido (dentro do usageClientPoll() abaixo) dispara
// uiRefreshData() por baixo dos panos em net/client.cpp — sem essa guarda,
// isso pintava a Início por cima do frame atual desta tela (que não faz
// fillScreen a cada iteração), deixando a Início "vazar" atrás do loading.
void uiShowLoading() {
  const int W = tft.width();
  const int H = tft.height();

  tft.fillScreen(COL_BG);

  int eyeR = min(W, H) / 6;
  if (eyeR < 18) eyeR = 18;
  if (eyeR > 44) eyeR = 44;

  const uint8_t brandFont = 2;
  int bw = brandWidth(brandFont);
  int brandFh = tft.fontHeight(brandFont);
  int titleFh = tft.fontHeight(2);
  int subFh = tft.fontHeight(1);

  const int gapEyeBrand = 14;
  const int gapBrandTitle = 18;
  const int gapTitleSub = 6;
  const int gapSubBar = 20;
  const int barH = 4;

  int blockH = eyeR * 2 + gapEyeBrand + brandFh + gapBrandTitle + titleFh +
               gapTitleSub + subFh + gapSubBar + barH;
  int topY = (H - blockH) / 2;
  if (topY < 6) topY = 6;

  int eyeCx = W / 2;
  int eyeCy = topY + eyeR;
  drawEyeIcon(eyeCx, eyeCy, eyeR, 0, 0, 0.0f);

  int brandY = topY + eyeR * 2 + gapEyeBrand;
  drawBrand((W - bw) / 2, brandY, brandFont);

  int titleY = brandY + brandFh + gapBrandTitle;
  int subY = titleY + titleFh + gapTitleSub;

  int barW = W - 64;
  if (barW < 80) barW = W - 32;
  int barX = (W - barW) / 2;
  int barY = subY + subFh + gapSubBar;

  // Faixa que precisa ser limpa a cada frame (titulo com dots + subtitulo).
  int textBandY = titleY - 2;
  int textBandH = (subY + subFh + 2) - textBandY;

  const int frames = 44;
  for (int f = 0; !g_hasFetchedOk; f++) {
    // Titulo com dots animados (0..3) — igual ao "Carregando..." da web.
    int dots = f % 4;
    String title = String(uiTr().loadingTitle);
    for (int d = 0; d < dots; d++) title += ".";

    tft.fillRect(0, textBandY, W, textBandH, COL_BG);
    tft.setTextDatum(TC_DATUM);
    tft.setTextColor(COL_TEXT, COL_BG);
    tft.drawString(title, W / 2, titleY, 2);
    tft.setTextColor(COL_TEXT_DIM, COL_BG);
    tft.drawString(uiTr().loadingSub, W / 2, subY, 1);

    // Barra indeterminada: cresce 0..100% e reinicia a cada volta — não
    // sabemos quanto falta pra Wi-Fi/coletor responder, então não é um
    // progresso real, só um sinal de "ainda vivo".
    float prog = (float)((f % frames) + 1) / (float)frames;
    int pw = (int)(barW * prog);
    tft.fillRoundRect(barX, barY, barW, barH, 2, COL_TRACK);
    if (pw > 0) {
      if (pw < barH) pw = barH;
      if (pw > barW) pw = barW;
      tft.fillRoundRect(barX, barY, pw, barH, 2, COL_ACCENT);
    }

    loadingDelay(34);

    // Bombeia a conexão — sem o loop() principal rodando ainda, ninguém mais
    // chamaria isso enquanto essa tela está em pé (ver comentário no topo).
    usageClientEnsureWifi();
    if (WiFi.status() == WL_CONNECTED) {
      usageClientPoll();
    }
  }
  // Barra completa como beat final de "conectado", antes de sair pra Início.
  tft.fillRoundRect(barX, barY, barW, barH, 2, COL_ACCENT);
  loadingDelay(100);
}
