#ifndef LIGHT_EFFECT_H
#define LIGHT_EFFECT_H

#include <cstdint>

#include "rgb_color.h"

class LightEffect
{
public:
    virtual ~LightEffect() = default;
//TODO:
//    virtual void start() {}
//    virtual void stop() {}

    virtual void update(RgbColor* led_strip, uint8_t num_leds) = 0;
    virtual void set_color(const RgbColor& color) {}    //the {} defines the default implementation so it is not required for all subclasses.
};

#endif  //LIGHT_EFFECT_H
