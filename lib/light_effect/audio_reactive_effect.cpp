#include "audio_reactive_effect.h"
#include "config.h"
#include "fft.h"

#include <algorithm>

void AudioReactiveEffect::update(RgbColor* led_strip, uint8_t num_leds)
{
    float envelope = calculate_embelope();
    uint8_t brightness = static_cast<uint8_t>(std::clamp(
        envelope * brightness_scaling_factor,
        0.0f,
        static_cast<float>(max_brightness)));
    
    // Create a copy of the color and scale it
    RgbColor scaled_color = color;
    scaled_color.scale(brightness);
    
    std::fill_n(led_strip, num_leds, scaled_color);
}

void AudioReactiveEffect::set_color(const RgbColor& color)
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
