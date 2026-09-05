#ifndef SD_AUDIO_H
#define SD_AUDIO_H

#include <Arduino.h>

#include "sd_card.h"

// Playback of WAV files stored in sd_audio_directory on the SD card. The
// decoded samples go through the same buffer as network-streamed audio, so
// the light effects react to them the same way.

void sd_audio_init();

// Lists the playable files in sd_audio_directory, writing at most
// max_entries of them and how many were written. Returns false when the card
// itself can't be read, which an empty listing doesn't say anything about.
bool sd_audio_list_files(FileInfo* entries, size_t max_entries, size_t* count);

// Starts playing a file from sd_audio_directory. `file_name` is a bare file
// name; anything that looks like a path is rejected. On failure returns
// false and points error_message at a static explanation.
bool sd_audio_start(const char* file_name, const char** error_message);

void sd_audio_stop();

// Keeps the audio buffer topped up from the card. Call from loop().
void sd_audio_service();

// True exactly once per file, after its last sample has been played out.
bool sd_audio_take_playback_finished();

#endif //SD_AUDIO_H
