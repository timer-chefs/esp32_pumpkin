#ifndef AUDIO_REACTIVE_EFFECT_H
#define AUDIO_REACTIVE_EFFECT_H

#include <cstdint>
#include "light_effect.h"

class AudioReactiveEffect : public LightEffect
{
public:
    void update(RgbColor* led_strip, uint8_t num_leds) override;
    void set_color(const RgbColor& color);
private:
    RgbColor color;
    float calculate_embelope();
};

#endif //AUDIO_REACTIVE_EFFECT_H
