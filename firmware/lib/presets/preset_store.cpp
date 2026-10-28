#include "preset_store.h"

#include "config.h"
#include "device_log.h"

#include <cstring>

// How much of the stored file to compare at a time.
static constexpr size_t compare_chunk_size = 512;

void preset_store_init()
{
    if(sd_card_is_mounted() && file_exists(presets_temporary_path))
    {
        delete_file(presets_temporary_path);
    }
}

File* preset_store_open()
{
    // Checked first, so that a card without presets, which is nothing out
    // of the ordinary, isn't logged as a failure to open them.
    if(!sd_card_is_mounted() || !file_exists(presets_path))
    {
        return nullptr;
    }

    return open_file(presets_path, FILE_READ);
}

// Whether the file at `path` holds exactly `bytes`.
static bool file_holds(const char* path, const uint8_t* bytes, size_t length)
{
    if(!file_exists(path))
    {
        return false;
    }

    File* file = open_file(path, FILE_READ);
    bool match = file && file->size() == length;

    uint8_t chunk[compare_chunk_size];
    size_t compared = 0;
    while(match && compared < length)
    {
        const size_t chunk_length = read_file(file, chunk, sizeof(chunk));
        match = chunk_length > 0 &&
                chunk_length <= length - compared &&
                memcmp(chunk, bytes + compared, chunk_length) == 0;
        compared += chunk_length;
    }

    close_file(file);
    return match;
}

static const char* write_temporary_file(const uint8_t* bytes, size_t length)
{
    File* file = open_file(presets_temporary_path, FILE_WRITE);
    if(!file)
    {
        return "Could not create a file on the SD card";
    }

    const bool is_written = write_file(file, bytes, length) == length;
    // Closing is what flushes the last of it to the card.
    close_file(file);

    return is_written ? nullptr : "Could not write the presets to the SD card";
}

// Moves the written presets into place. Only presets that are being
// replaced become the backup, so a card that had none keeps whatever backup
// it had.
static const char* replace_stored_presets()
{
    const bool has_stored_presets = file_exists(presets_path);
    if(has_stored_presets)
    {
        if(file_exists(presets_backup_path))
        {
            delete_file(presets_backup_path);
        }

        if(!rename_file(presets_path, presets_backup_path))
        {
            return "Could not keep a backup of the presets on the SD card";
        }
    }

    if(!rename_file(presets_temporary_path, presets_path))
    {
        if(has_stored_presets)
        {
            rename_file(presets_backup_path, presets_path);
        }

        return "Could not store the presets on the SD card";
    }

    return nullptr;
}

bool preset_store_save(
    const uint8_t* bytes,
    size_t length,
    const char** error_message)
{
    if(!sd_card_is_mounted())
    {
        *error_message = "No SD card detected";
        return false;
    }

    if(file_holds(presets_path, bytes, length))
    {
        device_log.println("Presets unchanged, so the card was left as it was");
        return true;
    }

    // Written whole before anything is replaced, so a save that fails
    // partway leaves the stored presets as they were.
    const char* error = write_temporary_file(bytes, length);
    if(!error)
    {
        error = replace_stored_presets();
    }

    if(error)
    {
        if(file_exists(presets_temporary_path))
        {
            delete_file(presets_temporary_path);
        }

        device_log.printf("Presets not saved: %s\n", error);
        *error_message = error;
        return false;
    }

    device_log.println("Presets saved");
    return true;
}
