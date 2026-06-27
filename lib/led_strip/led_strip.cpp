#include "led_strip.h"

#include "effect_manager.h"

CRGB led_strip[num_leds];

void led_strip_init()
{
    FastLED.addLeds<WS2812B, pin_led_strip, RGB>(led_strip, num_leds);
    FastLED.setBrightness(max_brightness);
}

