#ifndef COMMAND_HANDLER_H
#define COMMAND_HANDLER_H

#include <Arduino.h>
#include "show_manager.h"
#include "pumpkin_generated.h"

struct CommandResult
{
    Pumpkin::Protocol::ServerPayload payload_type;
    Pumpkin::Protocol::ErrorCode error_code;
    float volume;
    const char* error_message;
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
