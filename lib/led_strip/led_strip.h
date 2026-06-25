#ifndef LED_STRIP_H
#define LED_STRIP_H

#include <Arduino.h>
#include <FastLED.h>

void led_strip_init();
void led_strip_service(bool is_audio_ready, CRGB color);

#endif //LED_STRIP_H
