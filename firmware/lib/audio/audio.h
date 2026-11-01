#ifndef AUDIO_H
#define AUDIO_H

#include <Arduino.h>

bool audio_init();
void audio_write(const uint8_t* payload, size_t length);
void audio_service();
size_t audio_buffered_bytes();
void audio_started();
void audio_stoped();
bool is_audio_running();

// Goes up each time audio starts, so whatever started it can tell later
// whether what is playing is still its own.
uint32_t audio_start_count();

// When audio last started or was written to, by millis().
uint32_t audio_last_active_ms();

void set_volume(float volume_level);
float get_volume();

#endif  //AUDIO_H
