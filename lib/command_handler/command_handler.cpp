#include "command_handler.h"
#include "audio.h"
#include "config.h"
#include "sd_audio.h"

#include <algorithm>
#include <cmath>

using namespace Pumpkin::Protocol;

// The listing is answered straight out of this buffer, so it only has to
// outlive the response the web interface builds from it.
static FileInfo listed_audio_files[max_listed_audio_files];

static CommandResult success()
{
    return {ServerPayload_Success, ErrorCode_UNKNOWN, 0.0f, nullptr, nullptr, 0};
}

static CommandResult volume(float value)
{
    return {ServerPayload_Volume, ErrorCode_UNKNOWN, value, nullptr, nullptr, 0};
}

static CommandResult error(ErrorCode code, const char* message)
{
    return {ServerPayload_Error, code, 0.0f, message, nullptr, 0};
}

static CommandResult audio_files(const FileInfo* files, size_t count)
{
    return {ServerPayload_AudioFileList, ErrorCode_UNKNOWN, 0.0f, nullptr, files, count};
}

CommandHandler::CommandHandler(ShowManager& show_manager)
    : show_manager(show_manager) //This line is the initialization of the reference EffectManger&
{}

CommandResult CommandHandler::handle(const ClientMessage& message)
{
    switch(message.payload_type())
    {
        case ClientPayload_StartAudioStream:
            // The stream takes over from whatever the SD card was playing.
            sd_audio_stop();
            audio_started();
            return success();

        case ClientPayload_StopAudioStream:
            sd_audio_stop();
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
            sd_audio_stop();
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

        case ClientPayload_ListAudioFiles:
        {
            size_t count = 0;
            if(!sd_audio_list_files(listed_audio_files, max_listed_audio_files, &count))
            {
                return error(ErrorCode_UNKNOWN, "No SD card detected");
            }

            return audio_files(listed_audio_files, count);
        }

        case ClientPayload_PlayAudioFile:
        {
            const auto* name = message.payload_as_PlayAudioFile()->name();
            const char* error_message = nullptr;
            if(!sd_audio_start(name->c_str(), &error_message))
            {
                return error(ErrorCode_INVALID_ARGUMENT, error_message);
            }

            return success();
        }

        case ClientPayload_BeginAudioUpload:
        {
            const auto* upload = message.payload_as_BeginAudioUpload();
            const char* error_message = nullptr;
            if(!sd_audio_upload_begin(
                   upload->name()->c_str(),
                   upload->size(),
                   &error_message))
            {
                return error(ErrorCode_INVALID_ARGUMENT, error_message);
            }

            return success();
        }

        case ClientPayload_AudioUploadChunk:
        {
            const auto* bytes = message.payload_as_AudioUploadChunk()->bytes();
            if(bytes->size() > max_upload_chunk_size)
            {
                sd_audio_upload_cancel();
                return error(
                    ErrorCode_INVALID_ARGUMENT,
                    "Upload chunk is larger than the device accepts");
            }

            const char* error_message = nullptr;
            if(!sd_audio_upload_write(bytes->data(), bytes->size(), &error_message))
            {
                return error(ErrorCode_INVALID_ARGUMENT, error_message);
            }

            return success();
        }

        case ClientPayload_FinishAudioUpload:
        {
            const char* error_message = nullptr;
            if(!sd_audio_upload_finish(&error_message))
            {
                return error(ErrorCode_INVALID_ARGUMENT, error_message);
            }

            return success();
        }

        case ClientPayload_CancelAudioUpload:
            sd_audio_upload_cancel();
            return success();

        default:
            return error(
                ErrorCode_UNSUPPORTED_MESSAGE,
                "Unsupported client message");
    }
}
