// Duplo SHA256 (Bitcoin) otimizado para ESP32 — portado quase literalmente de
// NerdMiner_v2 (src/ShaTests/nerdSHA256plus.h/.cpp), MIT license, autoria
// original Bitmaker (baseado no shaLib do Blockstream Jade). Ver
// .agents/PLANO_MINERACAO.md. Sem dependência de display/hardware SHA —
// só matemática, roda em qualquer ESP32 Arduino.
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

// Midstate do primeiro bloco (64 bytes) do block header — calculado uma vez
// por job, reaproveitado a cada tentativa de nonce.
void nerdMids(uint32_t *digest, const uint8_t *dataIn);

// Duplo SHA256 completo com early-exit nos primeiros 16 bits do resultado
// (a maioria das tentativas falha ali e retorna false sem terminar o hash).
bool nerdSha256dBaked(const uint32_t *digest, const uint8_t *dataIn, const uint32_t *bake, uint8_t *doubleHash);

// Pré-computa os primeiros passos do segundo bloco do header (16 bytes fixos
// + nonce variável) — ver nerd_sha256_bake no NerdMiner original.
void nerdSha256Bake(const uint32_t *digest, const uint8_t *dataIn, uint32_t *bake);
