#include "command_handler.h"
#include "command_registry.h"
#include "config.h"
#include "session_commands.h"

using namespace Pumpkin::Protocol;

static CommandBinding bindings[max_registered_commands];
static size_t binding_count = 0;

static CompletionFn completions[max_registered_completions];
static size_t completion_count = 0;

void register_commands(const CommandBinding* new_bindings, size_t count)
{
    for(size_t i = 0; i < count; ++i)
    {
        if(binding_count == max_registered_commands)
        {
            Serial.println("Command registry is full; raise max_registered_commands");
            return;
        }

        bindings[binding_count++] = new_bindings[i];
    }
}

void register_completion(CompletionFn completion)
{
    if(completion_count == max_registered_completions)
    {
        Serial.println("Completion registry is full; raise max_registered_completions");
        return;
    }

    completions[completion_count++] = completion;
}

bool take_completed_command(
    CommandResult& result,
    flatbuffers::FlatBufferBuilder& builder)
{
    for(size_t i = 0; i < completion_count; ++i)
    {
        if(completions[i](result, builder))
        {
            return true;
        }
    }

    return false;
}

void command_handler_init()
{
    register_session_commands();
}

static const CommandBinding* find_binding(ClientPayload payload_type)
{
    for(size_t i = 0; i < binding_count; ++i)
    {
        if(bindings[i].payload_type == payload_type)
        {
            return &bindings[i];
        }
    }

    return nullptr;
}

void verify_registered_commands()
{
    for(const ClientPayload payload_type : EnumValuesClientPayload())
    {
        if(payload_type != ClientPayload_NONE && !find_binding(payload_type))
        {
            Serial.printf(
                "No handler registered for %s\n",
                EnumNameClientPayload(payload_type));
        }
    }
}

CommandResult handle_command(
    const CommandContext& context,
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    const CommandBinding* binding = find_binding(message.payload_type());
    if(!binding)
    {
        return error(
            builder,
            ErrorCode_UNSUPPORTED_MESSAGE,
            "Unsupported client message");
    }

    return binding->handle(context, message, builder);
}
