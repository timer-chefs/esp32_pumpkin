#ifndef SD_CARD_H
#define SD_CARD_H

#include <cstdint>
#include <SD_MMC.h>
#include <Arduino.h>

#include "config.h"

struct FileInfo
{
    char name[max_file_name_length];
    uint32_t size;
};

void sd_card_init();
bool sd_card_is_mounted();

File* open_file(const char* path, const char* mode);
size_t read_file(File* file, uint8_t* buffer, size_t size);
size_t write_file(File* file, const uint8_t* buffer, size_t size);
void close_file(File* file);

// Lists the regular files directly inside a directory, skipping
// sub-directories and hidden files. Pass an extension (e.g. ".wav") to list
// only files with that suffix, or nullptr for all of them. Returns how many
// entries were written, at most max_entries.
size_t list_files(
    const char* directory_path,
    const char* extension,
    FileInfo* entries,
    size_t max_entries);
bool create_directory(const char* path);

bool file_exists(const char* path);
bool delete_file(const char* path);
uint32_t get_file_size(const char* path);
bool rename_file(const char* old_path, const char* new_path);

#endif //SD_CARD_H
