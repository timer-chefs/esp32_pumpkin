#ifndef AUDIO_H
#define AUDIO_H

#include <Arduino.h>

bool audio_init();
void audio_service();
void audio_write(const uint8_t* payload, size_t length);

#endif //AUDIO_H
