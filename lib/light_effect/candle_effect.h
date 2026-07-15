#ifndef CANDLE_EFFECT_H
#define CANDLE_EFFECT_H

#include <Arduino.h>
#include "light_effect.h"

class CandleEffect : public LightEffect
{
public:
    void update(CRGB* led_strip, uint8_t num_leds) override;
};

#endif //CANDLE_EFFECT_H
