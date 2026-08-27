#include "sd_card.h"
#include "config.h"

void sd_card_init()
{
    pinMode(pin_sd_clk, INPUT_PULLUP);
    pinMode(pin_sd_cmd, INPUT_PULLUP);
    pinMode(pin_sd_d0, INPUT_PULLUP);
    pinMode(pin_sd_d1, INPUT_PULLUP);
    pinMode(pin_sd_d2, INPUT_PULLUP);
    pinMode(pin_sd_d3, INPUT_PULLUP);

    // Configure which pins to use for SDIO
    SD_MMC.setPins(
        pin_sd_clk,
        pin_sd_cmd,
        pin_sd_d0,
        pin_sd_d1,
        pin_sd_d2,
        pin_sd_d3);

    // Try 4-bit SDIO mode first
    if(!SD_MMC.begin("/sdcard", true))
    {
        Serial.println("4-bit SDIO mode failed. Trying 1-bit mode...");
        return;
    }

    Serial.println("SD Card mounted successfully.");
}

// mode: FILE_READ, FILE_WRITE, FILE_APPEND
File* open_file(const char* path, const char* mode)
{
    File* file = new File();
    *file = SD_MMC.open(path, mode);
    if (!(*file)) {
        Serial.printf("Failed to open file: %s (mode: %s)\n", path, mode);
        delete file;
        return nullptr;
    }
    
    return file;
}

size_t read_file(File* file, uint8_t* buffer, size_t size) // Read bytes from file into buffer
{
    if (!file || !(*file)) {
        return 0;               // Returns 0 if EOF or error
    }
    
    size_t bytes_read = file->read(buffer, size);
    return bytes_read;
}

// Write bytes to file from buffer
// Returns number of bytes written
size_t write_file(File* file, const uint8_t* buffer, size_t size)
{
    if (!file || !(*file)) {
        return 0;
    }
    
    size_t bytes_written = file->write(buffer, size);
    return bytes_written;
}

// Close file and free resources
void close_file(File* file)
{
    if (!file) {
        return;
    }
    
    if ((*file)) {
        file->close();
    }
    
    delete file;
}


// Check if file exists
bool file_exists(const char* path)
{
    File file = SD_MMC.open(path);
    bool exists = file ? true : false;
    if (file) {
        file.close();
    }
    return exists;
}

bool delete_file(const char* path)
{
    if (SD_MMC.remove(path)) {
        Serial.printf("File deleted: %s\n", path);
        return true;
    } else {
        Serial.printf("Failed to delete file: %s\n", path);
        return false;
    }
}

uint32_t get_file_size(const char* path)
{
    File file = SD_MMC.open(path);
    if (!file) {
        Serial.printf("Failed to open file for size check: %s\n", path);
        return 0;
    }
    
    uint32_t size = file.size();
    file.close();
    return size;
}

bool rename_file(const char* old_path, const char* new_path)
{
    if (SD_MMC.rename(old_path, new_path)) {
        Serial.printf("File renamed: %s -> %s\n", old_path, new_path);
        return true;
    } else {
        Serial.printf("Failed to rename file: %s -> %s\n", old_path, new_path);
        return false;
    }
}
