#ifndef COMMAND_HANDLER_H
#define COMMAND_HANDLER_H

#include <Arduino.h>
#include "sd_card.h"
#include "show_manager.h"
#include "pumpkin_generated.h"

struct CommandResult
{
    Pumpkin::Protocol::ServerPayload payload_type;
    Pumpkin::Protocol::ErrorCode error_code;
    float volume;
    const char* error_message;
    // Points at storage owned by the handler, valid until the next command.
    const FileInfo* audio_files;
    size_t audio_file_count;
};

class CommandHandler
{
public:
    CommandHandler(ShowManager& show_manager);
    CommandResult handle(const Pumpkin::Protocol::ClientMessage& message);
private:    
    ShowManager& show_manager;
};

#endif //COMMAND_HANDLER_H
