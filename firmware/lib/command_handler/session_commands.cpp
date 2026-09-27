#include "session_commands.h"

#include "audio.h"
#include "command_registry.h"
#include "sd_audio.h"
#include "show_manager.h"

#include <algorithm>
#include <cmath>

using namespace Pumpkin::Protocol;

extern ShowManager show_manager;

static CommandResult volume_result(
    flatbuffers::FlatBufferBuilder& builder,
    float value)
{
    return {ServerPayload_Volume, CreateVolume(builder, value).Union()};
}

static CommandResult handle_start_audio_stream(
    const CommandContext&,
    const ClientMessage&,
    flatbuffers::FlatBufferBuilder& builder)
{
    // The stream takes over from whatever the SD card was playing.
    sd_audio_stop();
    audio_started();
    return success(builder);
}

static CommandResult handle_stop_audio_stream(
    const CommandContext&,
    const ClientMessage&,
    flatbuffers::FlatBufferBuilder& builder)
{
    sd_audio_stop();
    audio_stoped();
    show_manager.set_current_show(0);
    return success(builder);
}

static CommandResult handle_reset_audio(
    const CommandContext&,
    const ClientMessage&,
    flatbuffers::FlatBufferBuilder& builder)
{
    sd_audio_stop();
    audio_stoped();
    return success(builder);
}

static CommandResult handle_play_show(
    const CommandContext&,
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    show_manager.set_current_show(message.payload_as_PlayShow()->show_id());
    return success(builder);
}

static CommandResult handle_audio_chunk(
    const CommandContext&,
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    const auto* pcm = message.payload_as_AudioChunk()->pcm_s16le();
    if(pcm->size() > max_audio_chunk_size || pcm->size() % sizeof(int16_t) != 0)
    {
        return error(
            builder,
            ErrorCode_INVALID_ARGUMENT,
            "Audio chunk is larger than the device accepts, or misaligned");
    }

    audio_write(pcm->data(), pcm->size());
    return success(builder);
}

static CommandResult handle_get_volume(
    const CommandContext&,
    const ClientMessage&,
    flatbuffers::FlatBufferBuilder& builder)
{
    return volume_result(builder, get_volume());
}

static CommandResult handle_adjust_volume(
    const CommandContext&,
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    const float delta = message.payload_as_AdjustVolume()->delta();
    if(!std::isfinite(delta))
    {
        return error(
            builder,
            ErrorCode_INVALID_ARGUMENT,
            "Volume delta must be finite");
    }

    const float adjusted = std::max(
        0.0f,
        std::min(1.0f, get_volume() + delta));
    set_volume(adjusted);
    return volume_result(builder, adjusted);
}

static const CommandBinding bindings[] = {
    {ClientPayload_StartAudioStream, handle_start_audio_stream},
    {ClientPayload_StopAudioStream, handle_stop_audio_stream},
    {ClientPayload_ResetAudio, handle_reset_audio},
    {ClientPayload_PlayShow, handle_play_show},
    {ClientPayload_AudioChunk, handle_audio_chunk},
    {ClientPayload_GetVolume, handle_get_volume},
    {ClientPayload_AdjustVolume, handle_adjust_volume},
};

void register_session_commands()
{
    register_commands(bindings);
}
