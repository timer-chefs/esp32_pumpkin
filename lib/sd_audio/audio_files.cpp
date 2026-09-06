#include "audio_files.h"

#include "config.h"

#include <cstring>

// FAT can't store these, and a name carrying one would either be rejected by
// the card or quietly turned into something else.
static const char* forbidden_characters = "\"*/:<>?\\|";

void build_audio_path(char* path, size_t size, const char* file_name)
{
    snprintf(path, size, "%s/%s", sd_audio_directory, file_name);
}

void audio_files_init()
{
    create_directory(sd_audio_directory);

    // An upload cut short by a reset leaves its temporary file behind, and
    // nothing will ever claim it.
    char path[audio_path_length];
    build_audio_path(path, sizeof(path), sd_upload_temporary_file);
    if(file_exists(path))
    {
        delete_file(path);
    }
}

static bool has_wav_extension(const char* file_name)
{
    const size_t length = strlen(file_name);
    return length > 4 && strcasecmp(file_name + length - 4, ".wav") == 0;
}

const char* audio_file_name_problem(const char* file_name)
{
    const size_t length = strlen(file_name);

    if(length == 0)
    {
        return "The file name is empty";
    }

    if(length >= max_file_name_length)
    {
        return "The file name is too long for the device";
    }

    // A leading dot hides the file from the listing, so it could never be
    // played back.
    if(file_name[0] == '.')
    {
        return "The file name can't start with a dot";
    }

    for(size_t i = 0; i < length; ++i)
    {
        const unsigned char character = (unsigned char)file_name[i];

        if(character < 0x20 || character == 0x7F)
        {
            return "The file name contains a control character";
        }

        if(strchr(forbidden_characters, character) != nullptr)
        {
            return "The file name contains a character the card can't store";
        }
    }

    // FAT drops these, so the stored name wouldn't be the one asked for.
    if(file_name[length - 1] == ' ' || file_name[length - 1] == '.')
    {
        return "The file name can't end with a space or a dot";
    }

    if(!has_wav_extension(file_name))
    {
        return "Only .wav files can be stored on the card";
    }

    return nullptr;
}

bool list_audio_files(FileInfo* entries, size_t max_entries, size_t* count)
{
    if(!sd_card_is_mounted())
    {
        *count = 0;
        return false;
    }

    *count = list_files(sd_audio_directory, ".wav", entries, max_entries);
    return true;
}
