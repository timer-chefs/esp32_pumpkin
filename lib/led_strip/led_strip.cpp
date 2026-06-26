#include "led_strip.h"
#include "config.h"
#include "effect_manager.h"

static EffectManager effect_manager;

CRGB led_strip[num_leds];

void led_strip_init()
{
    FastLED.addLeds<WS2812B, pin_led_strip, RGB>(led_strip, num_leds);
    FastLED.setBrightness(max_brightness);
}

void led_strip_service(bool is_playback_running, CRGB color)
{
    if(is_playback_running)
    {
        effect_manager.set_color(CRGB::Purple);
        effect_manager.set_effect(EffectId::AudioReactive); 
    }
    else
    {
        effect_manager.set_effect(EffectId::Candle);
    }
    effect_manager.update(led_strip, num_leds);
    FastLED.show();
}
