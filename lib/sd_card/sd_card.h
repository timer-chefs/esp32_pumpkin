#ifndef SD_CARD_H
#define SD_CARD_H

#include <cstdint>
#include <SD_MMC.h>
#include <Arduino.h>

void sd_card_init();

File* open_file(const char* path, const char* mode);
size_t read_file(File* file, uint8_t* buffer, size_t size);
size_t write_file(File* file, const uint8_t* buffer, size_t size);
void close_file(File* file);

bool file_exists(const char* path);
bool delete_file(const char* path);
uint32_t get_file_size(const char* path);
bool rename_file(const char* old_path, const char* new_path);

#endif //SD_CARD_H
