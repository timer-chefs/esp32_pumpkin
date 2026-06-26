#include "effect_manager.h"

EffectManager::EffectManager()
{
    current_effect = &candle_effect;
}

void EffectManager::set_effect(EffectId effect_id)
{
    switch(effect_id)
    {
        case EffectId::Candle:
        {
            current_effect = &candle_effect;
            break;
        }

        case EffectId::AudioReactive:
        {
            current_effect = &audio_reactive_effect;
            audio_reactive_effect.set_color(CRGB::Purple);  //This line should be temporary.
        }
    }
}

void EffectManager::update(CRGB* led_strip, uint8_t num_leds)
{
    current_effect->update(led_strip, num_leds);
}
