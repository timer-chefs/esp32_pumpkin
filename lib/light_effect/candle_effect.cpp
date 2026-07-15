#include "candle_effect.h"
#include <FastLED.h>


void CandleEffect::update(CRGB* led_strip, uint8_t num_leds)
{
    uint16_t time = millis() * 5;

    for (uint8_t i = 0; i < num_leds; i++)
    {
        uint8_t noise = inoise8(i * 40, time);
        uint8_t hue = map(noise, 0, 255, 25, 40);
        uint8_t brightness = map(noise, 0, 255, 120, 255);

        led_strip[i] = CHSV(hue, 255, brightness);
    }
}
