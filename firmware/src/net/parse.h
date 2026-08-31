#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include "core/state.h"

String jsonText(JsonVariantConst v);
bool parseUsageJson(const String& body);
