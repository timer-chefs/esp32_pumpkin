#include "command_handler.h"
#include "audio.h"

CommandHandler::CommandHandler(ShowManager& show_manager)
    : show_manager(show_manager) //This line is the initialization of the reference EffectManger&
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
    else if (strcmp(command, "PLAY_SHOW") == 0)
    {
        uint16_t show_id = doc["show"];
        show_manager.play(show_id);
    }
    else
    {
        Serial.printf("Unknown command: %s\n", command);
    }
}
