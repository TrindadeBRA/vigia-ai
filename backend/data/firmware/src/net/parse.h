#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include "core/state.h"

String jsonText(JsonVariantConst v);
// Aproxima texto UTF-8 dinâmico (nome de música/artista, etc.) pro ASCII mais
// parecido — a fonte da TFT_eSPI não decodifica multi-byte (ver parse.cpp).
String asciiFold(const String& s);
bool parseUsageJson(const String& body);
