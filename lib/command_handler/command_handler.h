#ifndef COMMAND_HANDLER_H
#define COMMAND_HANDLER_H

#include <Arduino.h>
#include "show_manager.h"
#include <ArduinoJson.h>

class CommandHandler
{
public:
    CommandHandler(ShowManager& show_manager);
    void handle(const JsonDocument& doc);
private:    
    ShowManager& show_manager;
};

#endif //COMMAND_HANDLER_H
