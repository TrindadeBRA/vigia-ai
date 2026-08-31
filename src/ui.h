#pragma once

#include "app_state.h"

// Paleta "premium" neutra: grafite quente + acento bronze, sem cores saturadas
// além dos tons de status (verde-sálvia / âmbar / terracota nas barras).
constexpr uint16_t COL_BG = 0x10A3;          // fundo geral (grafite)
constexpr uint16_t COL_CARD = 0x1904;        // fundo de cards / painéis
constexpr uint16_t COL_CARD_BORDER = 0x39E8; // borda sutil de cards e divisores
constexpr uint16_t COL_NAV_BG = 0x18E4;      // fundo da barra de abas
constexpr uint16_t COL_TRACK = 0x2966;       // trilho vazio das barras de progresso
constexpr uint16_t COL_TEXT = 0xF79D;        // texto principal (quase branco, quente)
constexpr uint16_t COL_TEXT_DIM = 0xAD76;    // texto secundário
constexpr uint16_t COL_TEXT_MUTED = 0x6B6E;  // texto apagado / aba inativa
constexpr uint16_t COL_ACCENT = 0xC50B;      // acento bronze (destaque, aba ativa)
constexpr uint16_t COL_GOOD = 0x8DF2;        // verde-sálvia (uso baixo)
constexpr uint16_t COL_WARN = 0xE52B;        // âmbar (uso alto)
constexpr uint16_t COL_BAD = 0xDB6D;         // terracota (uso crítico)

void uiInit();
void uiPaint();
void uiNext();
void uiPrev();
void uiSetView(View v);
void uiHandleTap(int16_t x, int16_t y);
void uiHandleSwipe(int16_t dx);
