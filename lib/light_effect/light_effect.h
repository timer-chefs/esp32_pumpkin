#ifndef LIGHT_EFFECT_H
#define LIGHT_EFFECT_H

#include <Arduino.h>
#include <FastLED.h>

class LightEffect
{
public:
    virtual ~LightEffect() = default;
//TODO:
//    virtual void start() {}
//    virtual void stop() {}

    virtual void update(CRGB* led_strip, uint8_t num_leds) = 0;
};

#endif  //LIGHT_EFFECT_H
