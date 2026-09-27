#ifndef WAV_READER_H
#define WAV_READER_H

#include <Arduino.h>

#include "sd_card.h"

struct WavInfo
{
    uint16_t channels;
    uint32_t sample_rate;
    uint16_t bits_per_sample;
    // Where the audio itself sits in the file.
    uint32_t data_start;
    uint32_t data_size;
};

// Reads the header of an open file and checks the device can play what it
// describes. Returns false and points error_message at a static explanation
// otherwise. Leaves the read position unspecified.
bool read_wav_info(File* file, WavInfo& info, const char** error_message);

#endif //WAV_READER_H
