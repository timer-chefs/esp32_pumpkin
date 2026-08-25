#ifndef RGB_COLOR_H
#define RGB_COLOR_H

#include <algorithm>
#include <cstdint>

struct RgbColor
{
    uint8_t red = 0;
    uint8_t green = 0;
    uint8_t blue = 0;

    constexpr RgbColor() = default;
    constexpr RgbColor(uint8_t red, uint8_t green, uint8_t blue)
        : red(red), green(green), blue(blue)
    {}

    void scale(uint8_t brightness)
    {
        red = static_cast<uint8_t>((static_cast<uint16_t>(red) * brightness) / 255);
        green = static_cast<uint8_t>((static_cast<uint16_t>(green) * brightness) / 255);
        blue = static_cast<uint8_t>((static_cast<uint16_t>(blue) * brightness) / 255);
    }

    static RgbColor from_hsv(uint8_t hue, uint8_t saturation, uint8_t value)
    {
        const uint8_t region = hue / 43;
        const uint8_t remainder = (hue - region * 43) * 6;
        const uint8_t p = (value * (255 - saturation)) >> 8;
        const uint8_t q = (value * (255 - ((saturation * remainder) >> 8))) >> 8;
        const uint8_t t = (value * (255 - ((saturation * (255 - remainder)) >> 8))) >> 8;

        switch(region)
        {
            case 0: return {value, t, p};
            case 1: return {q, value, p};
            case 2: return {p, value, t};
            case 3: return {p, q, value};
            case 4: return {t, p, value};
            default: return {value, p, q};
        }
    }

    static constexpr RgbColor orange()
    {
        return {255, 165, 0};
    }

    static constexpr RgbColor purple()
    {
        return {128, 0, 128};
    }
};

#endif // RGB_COLOR_H