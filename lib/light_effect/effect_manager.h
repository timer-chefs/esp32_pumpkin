#ifndef EFFECT_MANAGER_H
#define EFFECT_MANAGER_H

#include "candle_effect.h"
#include "audio_reactive_effect.h"

enum class EffectId
{
    Candle,
    AudioReactive
};

class EffectManager
{
public:
    EffectManager();
    void set_effect(EffectId);
    void update(CRGB* led_strip, uint8_t num_leds);

private:
    LightEffect* current_effect;
    CandleEffect candle_effect;
    AudioReactiveEffect audio_reactive_effect;
};

#endif //EFFECT_MANAGER_H
