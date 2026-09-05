#ifndef COMMAND_REGISTRY_H
#define COMMAND_REGISTRY_H

#include <flatbuffers/flatbuffers.h>

#include "command_result.h"
#include "pumpkin_generated.h"

using CommandFn = CommandResult (*)(
    const Pumpkin::Protocol::ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder);

struct CommandBinding
{
    Pumpkin::Protocol::ClientPayload payload_type;
    CommandFn handle;
};

// Feature libraries hand over the commands they answer from their own init,
// so adding a command to a feature stays inside that feature.
void register_commands(const CommandBinding* bindings, size_t count);

// Takes the whole table, so the count can't drift from what's in it.
template <size_t Count>
inline void register_commands(const CommandBinding (&bindings)[Count])
{
    register_commands(bindings, Count);
}

#endif //COMMAND_REGISTRY_H
