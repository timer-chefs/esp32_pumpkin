#pragma once

#include <Arduino.h>

bool audio_init();
void audioLoop();
void audio_write(const uint8_t* payload, size_t length);
