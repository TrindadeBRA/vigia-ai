#include "mining_log.h"

#include <stdarg.h>

namespace
{
constexpr int kCapacity = MINING_LOG_MAX_LINES;
String g_lines[kCapacity];
int g_count = 0;  // quantas posições já foram usadas (satura em kCapacity)
int g_next = 0;   // próxima posição a escrever (roda em círculo)
portMUX_TYPE g_mux = portMUX_INITIALIZER_UNLOCKED;
} // namespace

void miningLog(const char *fmt, ...)
{
  char buf[160];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);

  Serial.println(buf);

  portENTER_CRITICAL(&g_mux);
  g_lines[g_next] = String(buf);
  g_next = (g_next + 1) % kCapacity;
  if (g_count < kCapacity)
  {
    g_count++;
  }
  portEXIT_CRITICAL(&g_mux);
}

int miningLogSnapshot(String out[MINING_LOG_MAX_LINES])
{
  portENTER_CRITICAL(&g_mux);
  int count = g_count;
  // g_next aponta pra próxima escrita = posição mais antiga quando o
  // buffer já deu a volta; se ainda não deu, a mais antiga é o índice 0.
  int start = (g_count < kCapacity) ? 0 : g_next;
  for (int i = 0; i < count; i++)
  {
    out[i] = g_lines[(start + i) % kCapacity];
  }
  portEXIT_CRITICAL(&g_mux);
  return count;
}

void miningLogClear()
{
  portENTER_CRITICAL(&g_mux);
  g_count = 0;
  g_next = 0;
  for (int i = 0; i < kCapacity; i++)
  {
    g_lines[i] = "";
  }
  portEXIT_CRITICAL(&g_mux);
}
