#ifndef SD_UPLOAD_H
#define SD_UPLOAD_H

#include <Arduino.h>

// Receiving audio files onto the card. An upload lands in a temporary file
// and only takes its real name once every byte has arrived and the card has
// read it back correctly, so a card that accepts a write it can't return
// never replaces a good file. Each call reports failure by pointing
// error_message at a static explanation.

// `client_id` identifies whoever is sending, so that another client
// disconnecting doesn't abandon this upload.
bool sd_upload_begin(
    uint8_t client_id,
    const char* file_name,
    uint32_t size,
    const char** error_message);
bool sd_upload_write(
    const uint8_t* bytes,
    size_t length,
    const char** error_message);

// Starts reading the file back to check it against `checksum`. Returns true
// when that is under way, and the answer arrives later through the command
// registry's deferred completion.
bool sd_upload_finish(uint32_t checksum, const char** error_message);

// Abandons an upload in progress, discarding what arrived so far. Safe to
// call when there is no upload.
void sd_upload_cancel();

// Drops an upload that its own client has abandoned by disconnecting.
void sd_upload_client_disconnected(uint8_t client_id);

// True while the card is busy receiving or verifying an upload.
bool sd_upload_is_busy();

// Carries verification forward a slice at a time. Call from loop().
void sd_upload_service();

// Registers the deferred answer to a finished upload.
void sd_upload_init();

#endif //SD_UPLOAD_H
