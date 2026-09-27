#ifndef SHOW_H
#define SHOW_H

#include <FastLED.h>
#include "effect_manager.h"

struct Show
{
    uint16_t id;

    const char* name;

    EffectId effect;

    CRGB color;
};

#endif //SHOW_H
