#ifndef SHOW_H
#define SHOW_H

#include "effect_manager.h"
#include "rgb_color.h"

struct Show
{
    uint16_t id;

    const char* name;

    EffectId effect;

    RgbColor color;
};

#endif //SHOW_H
