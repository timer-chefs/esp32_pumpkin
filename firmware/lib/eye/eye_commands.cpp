#include "eye_commands.h"

#include "command_registry.h"
#include "pumpkin_generated.h"

using namespace Pumpkin::Protocol;

static Eye* commanded_eye = nullptr;

static CommandResult handle_move_eye(
    const CommandContext&,
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    commanded_eye->look(message.payload_as_MoveEye()->at());
    return success(builder);
}

static CommandResult handle_move_eye_lid(
    const CommandContext&,
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    commanded_eye->blink(message.payload_as_MoveEyeLid()->openness());
    return success(builder);
}

static const CommandBinding bindings[] = {
    {ClientPayload_MoveEye, handle_move_eye},
    {ClientPayload_MoveEyeLid, handle_move_eye_lid},
};

void register_eye_commands(Eye& eye)
{
    commanded_eye = &eye;
    register_commands(bindings);
}
