#ifndef PUMPKIN_LED_STRIP_H
#define PUMPKIN_LED_STRIP_H

#include "config.h"
#include "rgb_color.h"

#include <cstdint>

extern RgbColor led_strip[num_leds];

void led_strip_init();
void led_strip_show();

#endif // PUMPKIN_LED_STRIP_H