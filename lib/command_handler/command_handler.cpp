#include "command_handler.h"
#include "audio.h"

#include <algorithm>
#include <cmath>

using namespace Pumpkin::Protocol;

static CommandResult success()
{
    return {ServerPayload_Success, ErrorCode_UNKNOWN, 0.0f, nullptr};
}

static CommandResult volume(float value)
{
    return {ServerPayload_Volume, ErrorCode_UNKNOWN, value, nullptr};
}

static CommandResult error(ErrorCode code, const char* message)
{
    return {ServerPayload_Error, code, 0.0f, message};
}

CommandHandler::CommandHandler(ShowManager& show_manager)
    : show_manager(show_manager) //This line is the initialization of the reference EffectManger&
{}

CommandResult CommandHandler::handle(const ClientMessage& message)
{
    switch(message.payload_type())
    {
        case ClientPayload_StartAudioStream:
            audio_started();
            return success();

        case ClientPayload_StopAudioStream:
            audio_stoped();
            show_manager.set_current_show(0);
            return success();

        case ClientPayload_PlayShow:
            show_manager.set_current_show(
                message.payload_as_PlayShow()->show_id());
            return success();

        case ClientPayload_AudioChunk:
        {
            const auto* pcm = message.payload_as_AudioChunk()->pcm_s16le();
            if(pcm->size() > 512 || pcm->size() % sizeof(int16_t) != 0)
            {
                return error(
                    ErrorCode_INVALID_ARGUMENT,
                    "Audio chunks must contain at most 512 aligned bytes");
            }

            audio_write(pcm->data(), pcm->size());
            return success();
        }

        case ClientPayload_ResetAudio:
            audio_stoped();
            return success();

        case ClientPayload_GetVolume:
            return volume(get_volume());

        case ClientPayload_AdjustVolume:
        {
            const float delta = message.payload_as_AdjustVolume()->delta();
            if(!std::isfinite(delta))
            {
                return error(ErrorCode_INVALID_ARGUMENT, "Volume delta must be finite");
            }

            const float adjusted = std::max(
                0.0f,
                std::min(1.0f, get_volume() + delta));
            set_volume(adjusted);
            return volume(adjusted);
        }

        default:
            return error(
                ErrorCode_UNSUPPORTED_MESSAGE,
                "Unsupported client message");
    }
}
