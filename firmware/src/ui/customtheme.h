#pragma once

#include "ui/ui.h"

// Tema custom (protótipo): tela "Início" alternativa (fundo, relógio, ícones
// dos provedores) montada no painel web e mandada por HTTP (net/theme_server.h)
// pro device salvar em LittleFS. Ver docs/CONTRATO_TEMA.md pro schema completo.
// Único ponto de entrada compartilhado entre ui/ (render) e net/ (servidor).

// 1x no boot (chamado por uiInit()): monta o LittleFS e carrega /theme.json
// se existir.
void customThemeInit();

// true se o LittleFS montou (debug — GET /theme ecoa isso em fs_ok).
bool customThemeFsOk();

bool customThemeActive();
bool customThemeClockEnabled();

// Tamanho exato (em pixels) esperado pro POST /theme/background — a área de
// conteúdo atual (tela menos o header), não a tela inteira.
int customThemeCanvasWidth();
int customThemeCanvasHeight();
int customThemeCanvasAnimWidth();
int customThemeCanvasAnimHeight();
bool customThemeBackgroundIsGif();
size_t customThemeAnimExpectedBytes();
size_t customThemeAnimFrameBytes();
// Ajusta frame_count quando o RAW baixado tem outro N (theme.json vs arquivo).
void customThemeSetGifFrameCount(int frames);

// Valida e persiste em /theme.json; false se o JSON for inválido (mantém o
// tema anterior intacto). Repinta na hora se a placa estiver na Início.
bool customThemeApplyMeta(const String& json);
// Motivo do último customThemeApplyMeta() que retornou false (debug).
String customThemeLastError();

// Apaga /theme.json e /theme_bg.raw, desliga o tema. Repinta se necessário.
void customThemeClearAll();

// "" se não há tema salvo; senão o JSON cru (pro GET /theme ecoar de volta).
String customThemeCurrentJson();

// Escrita em blocos de /theme_bg.raw (usada pelo upload multipart em
// net/theme_server.cpp — nunca bufferiza a imagem inteira em RAM).
bool customThemeBeginBackgroundWrite();
bool customThemeWriteBackgroundChunk(const uint8_t* data, size_t n);
// ok=false descarta o arquivo parcial.
void customThemeEndBackgroundWrite(bool ok);

bool customThemeBeginAnimWrite();
bool customThemeWriteAnimChunk(const uint8_t *data, size_t n);
void customThemeEndAnimWrite(bool ok);

// Despachado por paintHome() (views/home.cpp) quando customThemeActive().
void paintCustomHome();
// Força o próximo paintCustomHome() a repintar o fundo inteiro em vez de só
// atualizar os widgets — chamar sempre que algo além do tema já tiver escrito
// na tela (ex.: um tft.fillScreen() em uiPaint()).
void customThemeInvalidateBackground();
// Chamado por uiTickClock() — repinta a tela inteira só quando o minuto muda
// (o relógio do tema só mostra HH:MM, sem segundos).
void customThemeTickClock();
// Chamado por uiTickClock() — redesenha só o selo de contagem regressiva
// (ver drawCountdownBadgeAt) quando o segundo exibido muda.
void customThemeTickCountdown();
// Avança o frame do fundo GIF (rate-limited por frame_delay_ms). Chamado
// no loop via uiTickClock() quando VIEW_THEME está ativa.
void customThemeTickAnimation();
// Toque nos controles do Spotify (prev/pause/next). true = consumiu o
// toque (não volta pra Início). Qualquer outro toque na VIEW_THEME
// continua saindo da tela, igual ao Relógio.
bool customThemeHandleTap(int16_t x, int16_t y);
