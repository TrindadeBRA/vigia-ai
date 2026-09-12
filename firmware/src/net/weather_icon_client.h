#pragma once

#include <Arduino.h>

// Ícone da condição do tempo pro widget `weather` do tema — mesma estratégia
// da capa do Spotify (net/spotify_client.h): GET /api/weather/icon?code=N
// devolve RAW RGB565 já convertido pelo coletor (emoji do Twemoji), a placa
// só guarda em BSS e faz pushImage. Pixels transparentes vêm com a cor-chave
// kBakedCard (ui/customtheme.cpp). Só baixa de novo quando o weather_code do
// /usage muda.
void weatherIconTick();
bool weatherIconReady();
int weatherIconSize();
const uint16_t *weatherIconPixels();
