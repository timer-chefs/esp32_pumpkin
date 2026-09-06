#ifndef COMMAND_REGISTRY_H
#define COMMAND_REGISTRY_H

#include <flatbuffers/flatbuffers.h>

#include "command_result.h"
#include "pumpkin_generated.h"

// What the transport knows about the message being handled, beyond the
// message itself. Passed to every command so that the ones which need it
// can have it, and so that giving commands more to work with later doesn't
// mean changing every signature again.
struct CommandContext
{
    // The connection the message arrived on, for telling one client's work
    // from another's.
    uint8_t client_id;
};

using CommandFn = CommandResult (*)(
    const CommandContext& context,
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

// Reports the answer to a command that returned deferred(). Returns false
// while there is nothing to report.
using CompletionFn = bool (*)(
    CommandResult& result,
    flatbuffers::FlatBufferBuilder& builder);

// Registered by whichever feature answers a command late.
void register_completion(CompletionFn completion);

// Polled by the transport: fills in the answer to a deferred command, if one
// has finished.
bool take_completed_command(
    CommandResult& result,
    flatbuffers::FlatBufferBuilder& builder);

// Takes the whole table, so the count can't drift from what's in it.
template <size_t Count>
inline void register_commands(const CommandBinding (&bindings)[Count])
{
    register_commands(bindings, Count);
}

#endif //COMMAND_REGISTRY_H
