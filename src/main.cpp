#include <Arduino.h>
#include <TFT_eSPI.h>

TFT_eSPI tft = TFT_eSPI();

// LED onboard do ESP32 Dev Module (mesmo GPIO do TFT_DC).
// Depois do desenho inicial o loop só alterna o pino; o framebuffer
// do ILI9341 permanece enquanto CS estiver inativo.
static constexpr int LED_PIN = 2;

void setup() {
  pinMode(LED_PIN, OUTPUT);

  tft.init();
  tft.setRotation(1);  // paisagem 320x240

  tft.fillScreen(TFT_NAVY);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(TFT_YELLOW, TFT_NAVY);
  tft.drawString("Hello World", tft.width() / 2, tft.height() / 2, 4);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}
