#ifndef AUDIO_REACTIVE_EFFECT_H
#define AUDIO_REACTIVE_EFFECT_H

#include <Arduino.h>
#include "light_effect.h"

class AudioReactiveEffect : public LightEffect
{
public:
    void update(CRGB* led_strip, uint8_t num_leds) override;
    void set_color(const CRGB& color);
private:
    CRGB color;
    float calculate_embelope();
};

#endif //AUDIO_REACTIVE_EFFECT_H
