#include "preset_shows.h"

const Show preset_shows[] =
{
    {
        0,
        "Candle",
        EffectId::Candle,
        RgbColor::orange()
    },

    {
        1,
        "Ghost",
        EffectId::AudioReactive,
        RgbColor::purple()
    }
};

const size_t preset_show_count = sizeof(preset_shows) / sizeof(preset_shows[0]);
