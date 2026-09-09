#pragma once
// Port de firmware/src/net/parse.h + parse.cpp:352-721 para 3DS.
// STD-only, jsmn-like minimal (sem ArduinoJson) para caber no CTR.

#include <string>

// Retorna true se JSON valido (mesmo que provedores vazios). Em erro marca contas como falha.
bool parseUsageJson(const std::string &body);
void markAllAccountsFailed(const char *msg);

// Fold UTF-8 -> ASCII (firmware/src/net/parse.cpp:208-350) para fontes citro2d bitmap.
std::string asciiFold(const std::string &in);
