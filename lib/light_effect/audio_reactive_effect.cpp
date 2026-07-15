#include "audio_reactive_effect.h"
#include "config.h"
#include "fft.h"

void AudioReactiveEffect::update(CRGB* led_strip, uint8_t num_leds)
{
    float envelope = calculate_embelope();
    uint8_t brightness = constrain(envelope * brightness_scaling_factor, 0, max_brightness);
    
    // Create a copy of the color and scale it
    CRGB scaled_color = color;
    scaled_color.nscale8_video(brightness);
    
    fill_solid(led_strip, num_leds, scaled_color);
}

void AudioReactiveEffect::set_color(const CRGB& color)
{
    this->color = color;
}

float AudioReactiveEffect::calculate_embelope()
{
    float level = get_fft_energy();

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
