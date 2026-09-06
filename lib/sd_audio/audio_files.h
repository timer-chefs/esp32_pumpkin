#ifndef AUDIO_FILES_H
#define AUDIO_FILES_H

#include <Arduino.h>

#include "sd_card.h"

// The directory of audio files on the card: what may live there, what it is
// called, and where it sits. Shared by playback and by uploads.

void audio_files_init();

// Builds "<sd_audio_directory>/<file_name>".
void build_audio_path(char* path, size_t size, const char* file_name);

// Says why a name can't be used, or nullptr when it can. The client sends
// names it has already cleaned up, so this is the boundary check rather
// than the only one -- it decides what may reach the card.
const char* audio_file_name_problem(const char* file_name);

// Lists the playable files, writing at most max_entries of them and how many
// were written. Returns false when the card itself can't be read, which an
// empty listing doesn't say anything about.
bool list_audio_files(FileInfo* entries, size_t max_entries, size_t* count);

#endif //AUDIO_FILES_H
