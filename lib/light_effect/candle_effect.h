#ifndef CANDLE_EFFECT_H
#define CANDLE_EFFECT_H

#include <cstdint>
#include "light_effect.h"

class CandleEffect : public LightEffect
{
public:
    void update(RgbColor* led_strip, uint8_t num_leds) override;
};

#endif //CANDLE_EFFECT_H
