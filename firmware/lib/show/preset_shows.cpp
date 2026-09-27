#include "preset_shows.h"

const Show preset_shows[] =
{
    {
        0,
        "Candle",
        EffectId::Candle,
        CRGB::Orange
    },

    {
        1,
        "Ghost",
        EffectId::AudioReactive,
        CRGB::Purple
    }
};

const size_t preset_show_count = sizeof(preset_shows) / sizeof(preset_shows[0]);
