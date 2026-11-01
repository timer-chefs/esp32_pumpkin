#ifndef PRESET_READER_H
#define PRESET_READER_H

#include <Arduino.h>
#include <FastLED.h>

#include "config.h"
#include "pumpkin_generated.h"

// Reads the stored presets for auto mode, the one thing on the device that
// plays them without a client asking. It reads the file the way the client
// does (see presets_csv.ts), but only what it takes to play a preset.

// One of the stored presets. See PlayPreset in the protocol.
struct PresetInfo
{
    char name[max_preset_name_length];

    bool has_light;
    Pumpkin::Protocol::LightEffectId light_effect;
    CRGB color;

    // A file in sd_audio_directory, or empty to play nothing.
    char sound[max_file_name_length];
};

// Reads presets_path, in place of the presets read before. On failure there
// are none, and error_message points at an explanation that lasts until the
// next call.
bool presets_load(const char** error_message);

size_t presets_count();

// `index` must be below presets_count().
const PresetInfo& presets_get(size_t index);

#endif //PRESET_READER_H
