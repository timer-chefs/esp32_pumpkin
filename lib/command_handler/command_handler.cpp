#include "command_handler.h"
#include "audio.h"

#include "esp_log.h"

static const char* tag = "command";

CommandHandler::CommandHandler(ShowManager& show_manager)
    : show_manager(show_manager) //This line is the initialization of the reference EffectManger&
{}

void CommandHandler::handle(const cJSON* document)
{
    const cJSON* command_item = cJSON_GetObjectItemCaseSensitive(document, "command");
    const char* command = cJSON_IsString(command_item) ? command_item->valuestring : "";

    if(strcmp(command, "START_AUDIO_STREAM") == 0)
    {
        audio_started();
    }
    else if(strcmp(command, "STOP_AUDIO_STREAM") == 0)
    {
        audio_stoped();
        show_manager.set_current_show(0);
    }
    else if (strcmp(command, "PLAY_SHOW") == 0)
    {
        const cJSON* show_item = cJSON_GetObjectItemCaseSensitive(document, "show");
        const uint16_t show_id = cJSON_IsNumber(show_item)
            ? static_cast<uint16_t>(show_item->valueint)
            : 0;
        show_manager.set_current_show(show_id);
    }
    else
    {
        ESP_LOGW(tag, "Unknown command: %s", command);
    }
}
