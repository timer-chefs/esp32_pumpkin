#include "led_strip.h"
#include "config.h"
#include "candle_effect.h"
#include "audio_reactive_effect.h"

static CandleEffect candleEffect;
static AudioReactiveEffect audioReactiveEffect;

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
        audioReactiveEffect.setColor(color);
        audioReactiveEffect.update(led_strip, num_leds);
    }
    else
    {
        candleEffect.update(led_strip, num_leds);
    }
    FastLED.show();
}
