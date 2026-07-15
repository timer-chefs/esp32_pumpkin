#ifndef LED_STRIP_H
#define LED_STRIP_H

#include "config.h"

#include <Arduino.h>
#include <FastLED.h>

extern CRGB led_strip[num_leds];

void led_strip_init();

#endif //LED_STRIP_H
