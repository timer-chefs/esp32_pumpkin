#include "led_strip.h"
#include <FastLED.h>
#include "config.h"
#include "audio.h"
#include "fft.h"

CRGB led_strip[num_leds];

void led_strip_init()
{
    FastLED.addLeds<WS2812B, pin_led_strip, RGB>(led_strip, num_leds);
    FastLED.setBrightness(max_brightness);
}

static float calculate_envelope(float level)
{
    static float envelope = 0;
    if(level > envelope)
    {
        envelope = level;
    }
    else
    {
        envelope *= 0.90f;
    }
    return envelope;
}

void led_strip_service()
{
    float level = get_fft_energy();
    float envelope = calculate_envelope(level);
    
    uint8_t brightness = constrain(envelope * brightness_scaling_factor, 0, max_brightness); //brightness_scaling_factor is calibrated
    fill_solid(led_strip, num_leds, CHSV(0,255,brightness));
    FastLED.show();
}
