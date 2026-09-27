#ifndef COMMAND_RESULT_H
#define COMMAND_RESULT_H

#include <flatbuffers/flatbuffers.h>
#include "pumpkin_generated.h"

// What a command answers with. The handler builds its own payload into the
// response builder, so a new kind of response is confined to the handler
// that produces it -- nothing else has to learn how to serialize it.
struct CommandResult
{
    Pumpkin::Protocol::ServerPayload payload_type;
    flatbuffers::Offset<void> payload;
};

// A command that can't answer straight away. The transport remembers who
// asked and sends the answer when the command reports one, rather than
// blocking loop() until it is ready.
inline CommandResult deferred()
{
    return {Pumpkin::Protocol::ServerPayload_NONE, 0};
}

inline CommandResult success(flatbuffers::FlatBufferBuilder& builder)
{
    return {
        Pumpkin::Protocol::ServerPayload_Success,
        Pumpkin::Protocol::CreateSuccess(builder).Union()};
}

inline CommandResult error(
    flatbuffers::FlatBufferBuilder& builder,
    Pumpkin::Protocol::ErrorCode code,
    const char* message)
{
    return {
        Pumpkin::Protocol::ServerPayload_Error,
        Pumpkin::Protocol::CreateErrorDirect(builder, code, message).Union()};
}

#endif //COMMAND_RESULT_H
