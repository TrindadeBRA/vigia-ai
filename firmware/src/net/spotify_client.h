#pragma once

#include <Arduino.h>

// Cliente Spotify para o tema: busca GET /api/spotify e preenche g_snap.spotify.
// Poll próprio a cada 5s quando VIEW_THEME tem widget Spotify, similar ao
// SpotifyCard do /display (que não usa o hub de /usage).
// Capa: GET /api/spotify/cover → RAW RGB565 (o coletor converte; a placa
// não baixa JPEG da CDN). Comandos: POST /api/spotify/{previous,pause,play,next}.
void spotifyClientPoll();
void spotifyClientTick();
bool spotifyVisible();
void spotifyClientCommand(const char *action);

bool spotifyCoverReady();
int spotifyCoverSize();
const uint16_t *spotifyCoverPixels();
