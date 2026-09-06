#include "sd_audio_commands.h"

#include "command_registry.h"
#include "config.h"
#include "pumpkin_generated.h"
#include "sd_audio.h"

#include <vector>

using namespace Pumpkin::Protocol;

// The listing is answered straight out of this buffer, so it only has to
// outlive the response built from it.
static FileInfo listed_audio_files[max_listed_audio_files];

static CommandResult handle_list_audio_files(
    const ClientMessage&,
    flatbuffers::FlatBufferBuilder& builder)
{
    size_t count = 0;
    if(!sd_audio_list_files(listed_audio_files, max_listed_audio_files, &count))
    {
        return error(builder, ErrorCode_UNKNOWN, "No SD card detected");
    }

    std::vector<flatbuffers::Offset<AudioFile>> files;
    files.reserve(count);
    for(size_t i = 0; i < count; ++i)
    {
        files.push_back(CreateAudioFileDirect(
            builder,
            listed_audio_files[i].name,
            listed_audio_files[i].size));
    }

    return {
        ServerPayload_AudioFileList,
        CreateAudioFileListDirect(builder, &files).Union()};
}

static CommandResult handle_play_audio_file(
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    const auto* name = message.payload_as_PlayAudioFile()->name();
    const char* error_message = nullptr;
    if(!sd_audio_start(name->c_str(), &error_message))
    {
        return error(builder, ErrorCode_INVALID_ARGUMENT, error_message);
    }

    return success(builder);
}

static CommandResult handle_begin_audio_upload(
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    const auto* upload = message.payload_as_BeginAudioUpload();
    const char* error_message = nullptr;
    if(!sd_audio_upload_begin(
           upload->name()->c_str(),
           upload->size(),
           &error_message))
    {
        return error(builder, ErrorCode_INVALID_ARGUMENT, error_message);
    }

    return success(builder);
}

static CommandResult handle_audio_upload_chunk(
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    const auto* bytes = message.payload_as_AudioUploadChunk()->bytes();
    if(bytes->size() > max_upload_chunk_size)
    {
        sd_audio_upload_cancel();
        return error(
            builder,
            ErrorCode_INVALID_ARGUMENT,
            "Upload chunk is larger than the device accepts");
    }

    const char* error_message = nullptr;
    if(!sd_audio_upload_write(bytes->data(), bytes->size(), &error_message))
    {
        return error(builder, ErrorCode_INVALID_ARGUMENT, error_message);
    }

    return success(builder);
}

static CommandResult handle_finish_audio_upload(
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    const char* error_message = nullptr;
    const uint32_t checksum =
        message.payload_as_FinishAudioUpload()->checksum();

    if(!sd_audio_upload_finish(checksum, &error_message))
    {
        return error(builder, ErrorCode_INVALID_ARGUMENT, error_message);
    }

    return success(builder);
}

static CommandResult handle_cancel_audio_upload(
    const ClientMessage&,
    flatbuffers::FlatBufferBuilder& builder)
{
    sd_audio_upload_cancel();
    return success(builder);
}

static const CommandBinding bindings[] = {
    {ClientPayload_ListAudioFiles, handle_list_audio_files},
    {ClientPayload_PlayAudioFile, handle_play_audio_file},
    {ClientPayload_BeginAudioUpload, handle_begin_audio_upload},
    {ClientPayload_AudioUploadChunk, handle_audio_upload_chunk},
    {ClientPayload_FinishAudioUpload, handle_finish_audio_upload},
    {ClientPayload_CancelAudioUpload, handle_cancel_audio_upload},
};

void register_sd_audio_commands()
{
    register_commands(bindings);
}
