#ifndef AUDIO_H
#define AUDIO_H

#include <Arduino.h>

bool audio_init();
void audio_write(const uint8_t* payload, size_t length);
void audio_service();
void audio_reset();

void set_volume(float volume_level);
float get_volume();

#endif  //AUDIO_H
