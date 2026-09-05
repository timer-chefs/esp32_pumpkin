#ifndef COMMAND_HANDLER_H
#define COMMAND_HANDLER_H

#include <Arduino.h>
#include <flatbuffers/flatbuffers.h>

#include "command_result.h"
#include "pumpkin_generated.h"

// Registers the commands that don't belong to a single feature library.
// Feature libraries register their own from their init.
void command_handler_init();

// Warns about any client message the protocol defines that nothing answers.
// Call once every feature has registered, at the end of setup: the registry
// can't be checked for exhaustiveness the way a switch could.
void verify_registered_commands();

// Answers one client message, building the response payload into `builder`.
CommandResult handle_command(
    const Pumpkin::Protocol::ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder);

#endif //COMMAND_HANDLER_H
