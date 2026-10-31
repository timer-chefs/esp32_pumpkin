#ifndef PRESET_STORE_H
#define PRESET_STORE_H

#include <Arduino.h>

#include "sd_card.h"

// The presets, kept on the card in one file that the client reads and
// writes whole. The client owns the format. The device only looks inside it
// for auto mode, which reads what playing a preset takes (see
// preset_reader.h), so the presets can otherwise change shape without
// touching the firmware.

// Clears away what a save cut short by a reset left behind.
void preset_store_init();

// Opens the stored presets for reading, or returns nullptr when the card
// has none. Close it with close_file().
File* preset_store_open();

// Replaces the stored presets with `bytes`, keeping the ones it replaces in
// presets_backup_path. Presets identical to the stored ones aren't written
// at all, so the backup is always of the last presets that were different.
// Returns false, leaving the stored presets as they were, with
// error_message pointing at a static explanation, if the save failed.
bool preset_store_save(
    const uint8_t* bytes,
    size_t length,
    const char** error_message);

#endif //PRESET_STORE_H
