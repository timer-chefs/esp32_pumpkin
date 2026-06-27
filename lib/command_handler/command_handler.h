#ifndef COMMAND_HANDLER_H
#define COMMAND_HANDLER_H

#include <Arduino.h>
#include "effect_manager.h"
#include <ArduinoJson.h>

class CommandHandler
{
public:
    CommandHandler(EffectManager& effect_manager);
    void handle(const JsonDocument& doc);
private:    
    EffectManager& effect_manager;
};

#endif //COMMAND_HANDLER_H
