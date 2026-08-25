#include "candle_effect.h"

#include "esp_timer.h"

static uint8_t hash8(uint16_t value)
{
    value ^= value >> 7;
    value *= 0x9e37;
    value ^= value >> 9;
    return static_cast<uint8_t>(value);
}

static uint8_t smooth_noise(uint16_t position, uint16_t time)
{
    const uint16_t segment = time >> 8;
    const uint8_t fraction = static_cast<uint8_t>(time);
    const uint8_t start = hash8(position + segment);
    const uint8_t end = hash8(position + segment + 1);
    const uint16_t blend = (static_cast<uint16_t>(fraction) * fraction * (765 - 2 * fraction)) >> 16;
    return static_cast<uint8_t>(start + ((static_cast<int16_t>(end) - start) * blend >> 8));
}

void CandleEffect::update(RgbColor* led_strip, uint8_t num_leds)
{
    uint16_t time = (esp_timer_get_time() / 1000) * 5;

    for (uint8_t i = 0; i < num_leds; i++)
    {
        uint8_t noise = smooth_noise(i * 40, time);
        uint8_t hue = 25 + (static_cast<uint16_t>(noise) * 15 / 255);
        uint8_t brightness = 120 + (static_cast<uint16_t>(noise) * 135 / 255);

        led_strip[i] = RgbColor::from_hsv(hue, 255, brightness);
    }
}
