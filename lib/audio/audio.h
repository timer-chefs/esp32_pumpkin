#ifndef AUDIO_H
#define AUDIO_H

#include <Arduino.h>

bool audio_init();
void audio_service();
void audio_write(const uint8_t* payload, size_t length);
void audio_reset();  // Reset buffer between streams
void audio_log_stats();

#endif //AUDIO_H
