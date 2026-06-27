#include "command_handler.h"
#include "audio.h"

CommandHandler::CommandHandler(EffectManager& effect_manager)
    : effect_manager(effect_manager) //This line is the initialization of the reference EffectManger&
{}

void CommandHandler::handle(const JsonDocument& doc)
{
    const char* command = doc["command"] | "";

    if(strcmp(command, "START_AUDIO_STREAM") == 0)
    {
        audio_started();
    }
    else if(strcmp(command, "STOP_AUDIO_STREAM") == 0)
    {
        audio_stoped();
    }
}
