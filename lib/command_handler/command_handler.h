#ifndef COMMAND_HANDLER_H
#define COMMAND_HANDLER_H

#include "cJSON.h"
#include "show_manager.h"

class CommandHandler
{
public:
    CommandHandler(ShowManager& show_manager);
    void handle(const cJSON* document);
private:    
    ShowManager& show_manager;
};

#endif //COMMAND_HANDLER_H
