#include "sd_upload.h"

#include "audio_files.h"
#include "command_registry.h"
#include "config.h"
#include "pumpkin_generated.h"
#include "sd_card.h"

#include <cstring>

using namespace Pumpkin::Protocol;

struct Upload
{
    File* file;
    uint8_t client_id;
    char name[max_file_name_length];
    uint32_t expected_bytes;
    uint32_t received_bytes;
};

// Reading the file back takes as long as the card needs, which for a whole
// song is far too long to spend inside one command: it would stall playback,
// the LEDs and the socket alike. So it runs a slice at a time from loop(),
// and the client's request is answered when it finishes.
struct Verification
{
    File* file;
    uint32_t remaining_bytes;
    uint32_t crc;
    uint32_t expected_checksum;
    bool running;
    bool has_result;
    // nullptr once finished means it passed.
    const char* error_message;
};

static Upload upload = {};
static Verification verification = {};

// CRC-32, as described in the protocol: polynomial 0xEDB88320, initial and
// final value 0xFFFFFFFF. Written out rather than taken from ROM so that it
// is plainly the same computation the client makes.
static uint32_t crc32_update(uint32_t crc, const uint8_t* bytes, size_t length)
{
    for(size_t i = 0; i < length; ++i)
    {
        crc ^= bytes[i];
        for(uint8_t bit = 0; bit < 8; ++bit)
        {
            crc = (crc >> 1) ^ (0xEDB88320u & (uint32_t)(-(int32_t)(crc & 1)));
        }
    }

    return crc;
}

static void close_upload_file()
{
    if(upload.file)
    {
        close_file(upload.file);
        upload.file = nullptr;
    }
}

static void close_verification_file()
{
    if(verification.file)
    {
        close_file(verification.file);
        verification.file = nullptr;
    }
}

static void temporary_path(char* path, size_t size)
{
    build_audio_path(path, size, sd_upload_temporary_file);
}

bool sd_upload_is_busy()
{
    return upload.file != nullptr || verification.running;
}

bool sd_upload_begin(
    uint8_t client_id,
    const char* file_name,
    uint32_t size,
    const char** error_message)
{
    if(!sd_card_is_mounted())
    {
        *error_message = "No SD card detected";
        return false;
    }

    *error_message = audio_file_name_problem(file_name);
    if(*error_message)
    {
        return false;
    }

    if(size == 0)
    {
        *error_message = "Cannot upload an empty file";
        return false;
    }

    if(size > free_space())
    {
        *error_message = "Not enough free space on the SD card";
        return false;
    }

    // Whatever came before never finished, so it has no claim on the card.
    sd_upload_cancel();

    char path[audio_path_length];
    temporary_path(path, sizeof(path));

    upload.file = open_file(path, FILE_WRITE);
    if(!upload.file)
    {
        *error_message = "Could not write to the SD card";
        return false;
    }

    upload.client_id = client_id;
    strlcpy(upload.name, file_name, sizeof(upload.name));
    upload.expected_bytes = size;
    upload.received_bytes = 0;

    Serial.printf("Receiving %s (%u bytes)\n", upload.name, (unsigned)size);
    return true;
}

bool sd_upload_write(
    const uint8_t* bytes,
    size_t length,
    const char** error_message)
{
    if(!upload.file)
    {
        *error_message = "No upload in progress";
        return false;
    }

    if(upload.received_bytes + length > upload.expected_bytes)
    {
        sd_upload_cancel();
        *error_message = "Upload sent more data than it announced";
        return false;
    }

    if(write_file(upload.file, bytes, length) != length)
    {
        // Let go of the handle and get the card back first: a delete issued
        // at a wedged card just fails, leaving the temporary file behind.
        close_upload_file();
        sd_card_remount();
        sd_upload_cancel();

        *error_message = "Could not write to the SD card";
        return false;
    }

    upload.received_bytes += length;
    return true;
}

bool sd_upload_finish(uint32_t checksum, const char** error_message)
{
    if(!upload.file)
    {
        *error_message = "No upload in progress";
        return false;
    }

    if(upload.received_bytes != upload.expected_bytes)
    {
        sd_upload_cancel();
        *error_message = "Upload ended before every byte arrived";
        return false;
    }

    close_upload_file();

    char path[audio_path_length];
    temporary_path(path, sizeof(path));

    verification.file = open_file(path, FILE_READ);
    if(!verification.file)
    {
        sd_upload_cancel();
        *error_message = "Could not read the stored file back";
        return false;
    }

    if(verification.file->size() != upload.received_bytes)
    {
        close_verification_file();
        sd_upload_cancel();
        *error_message = "The stored file is the wrong size";
        return false;
    }

    verification.remaining_bytes = upload.received_bytes;
    verification.crc = 0xFFFFFFFFu;
    verification.expected_checksum = checksum;
    verification.running = true;
    verification.has_result = false;
    verification.error_message = nullptr;

    return true;
}

// Puts the verified file in place of whatever it replaces.
static const char* store_verified_file()
{
    char from[audio_path_length];
    char to[audio_path_length];
    temporary_path(from, sizeof(from));
    build_audio_path(to, sizeof(to), upload.name);

    // rename() won't replace an existing file, and re-uploading a file to
    // correct it is the obvious thing to do.
    if(file_exists(to))
    {
        delete_file(to);
    }

    if(!rename_file(from, to))
    {
        delete_file(from);
        return "Could not store the uploaded file";
    }

    Serial.printf(
        "Stored %s (%u bytes, verified)\n",
        to,
        (unsigned)upload.received_bytes);
    return nullptr;
}

static void finish_verification(const char* error_message)
{
    close_verification_file();

    if(error_message)
    {
        char path[audio_path_length];
        temporary_path(path, sizeof(path));
        Serial.printf("Discarding upload of %s: %s\n", upload.name, error_message);
        delete_file(path);
    }

    verification.running = false;
    verification.has_result = true;
    verification.error_message = error_message;

    upload.expected_bytes = 0;
    upload.received_bytes = 0;
}

void sd_upload_service()
{
    if(!verification.running)
    {
        return;
    }

    // Read only a slice per turn round the loop, so playback and the socket
    // keep getting their share of the time.
    alignas(sd_dma_alignment) static uint8_t block[sd_audio_read_block_size];
    uint32_t budget = sd_verify_bytes_per_service;

    while(budget > 0 && verification.remaining_bytes > 0)
    {
        const size_t to_read = min(
            min((uint32_t)sizeof(block), budget),
            verification.remaining_bytes);

        const size_t bytes_read = read_file(verification.file, block, to_read);
        if(bytes_read == 0)
        {
            finish_verification("The card could not read the file back");
            return;
        }

        verification.crc = crc32_update(verification.crc, block, bytes_read);
        verification.remaining_bytes -= bytes_read;
        budget -= bytes_read;
    }

    if(verification.remaining_bytes > 0)
    {
        return;
    }

    if((verification.crc ^ 0xFFFFFFFFu) != verification.expected_checksum)
    {
        finish_verification("The file did not survive being written to the card");
        return;
    }

    // Close before renaming, then put it in place.
    close_verification_file();
    finish_verification(store_verified_file());
}

void sd_upload_cancel()
{
    // The handle may already be closed, by the write failure that is asking
    // for the upload to be dropped.
    const bool had_upload =
        upload.file != nullptr || upload.expected_bytes != 0 || verification.running;

    // Somebody is waiting on a verification that is being dropped, and an
    // answer they never get is worse than a failure they do.
    if(verification.running)
    {
        verification.has_result = true;
        verification.error_message = "The upload was cancelled";
    }

    close_upload_file();
    close_verification_file();
    verification.running = false;
    upload.expected_bytes = 0;
    upload.received_bytes = 0;

    if(!had_upload)
    {
        return;
    }

    char path[audio_path_length];
    temporary_path(path, sizeof(path));
    delete_file(path);
}

void sd_upload_client_disconnected(uint8_t client_id)
{
    if(sd_upload_is_busy() && upload.client_id == client_id)
    {
        Serial.println("Upload abandoned by its client");
        sd_upload_cancel();
    }
}

// Hands the verification's answer back to whoever is still waiting on it.
static bool take_verification_result(
    CommandResult& result,
    flatbuffers::FlatBufferBuilder& builder)
{
    if(!verification.has_result)
    {
        return false;
    }

    verification.has_result = false;
    result = verification.error_message
        ? error(builder, ErrorCode_UNKNOWN, verification.error_message)
        : success(builder);

    return true;
}

void sd_upload_init()
{
    register_completion(take_verification_result);
}
