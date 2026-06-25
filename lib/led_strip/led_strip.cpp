#include "led_strip.h"
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


static void candle_light_effect()
{
    uint16_t time = millis() * 5;
    for (int i = 0; i < num_leds; i++)
    {
        uint8_t noise = inoise8(i * 40, time);
        uint8_t brightness = map(noise, 0, 255, 25, 40); 
        uint8_t hue = map(noise, 0, 255, 120, 255);
        led_strip[i] = CHSV(hue, 255, brightness);
    }
}

void led_strip_service(bool is_playback_running, CRGB color)
{
    if(is_playback_running)
    {
        float level = get_fft_energy();
        float envelope = calculate_envelope(level);

        uint8_t brightness = constrain(envelope * brightness_scaling_factor, 0, max_brightness); //brightness_scaling_factor is calibrated
        color.nscale8_video(brightness);
        fill_solid(led_strip, num_leds, color);
        
    }
    else
    {
        candle_light_effect();
    }
    FastLED.show();
}
