#include "auto_mode_commands.h"

#include "command_registry.h"
#include "preset_reader.h"
#include "pumpkin_generated.h"

using namespace Pumpkin::Protocol;

static AutoMode* commanded_auto_mode = nullptr;

static CommandResult status_result(flatbuffers::FlatBufferBuilder& builder)
{
    return {
        ServerPayload_AutoModeStatus,
        CreateAutoModeStatus(
            builder,
            commanded_auto_mode->is_running(),
            commanded_auto_mode->min_pause_ms() / 1000,
            commanded_auto_mode->max_pause_ms() / 1000)
            .Union()};
}

// Says why auto mode would have nothing to play, or nullptr if it has.
static const char* problem_with_presets()
{
    const char* error_message = nullptr;
    if(!presets_load(&error_message))
    {
        return error_message;
    }

    for(size_t i = 0; i < presets_count(); ++i)
    {
        if(presets_get(i).sound[0] != '\0')
        {
            return nullptr;
        }
    }

    return "No preset in presets.csv has a sound";
}

static CommandResult handle_start_auto_mode(
    const CommandContext&,
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    const auto* start = message.payload_as_StartAutoMode();
    if(start->min_pause_s() > start->max_pause_s())
    {
        return error(
            builder,
            ErrorCode_INVALID_ARGUMENT,
            "The shortest pause can't be longer than the longest");
    }

    const char* problem = problem_with_presets();
    if(problem)
    {
        return error(builder, ErrorCode_UNKNOWN, problem);
    }

    commanded_auto_mode->start(
        start->min_pause_s() * 1000u,
        start->max_pause_s() * 1000u);
    return success(builder);
}

static CommandResult handle_stop_auto_mode(
    const CommandContext&,
    const ClientMessage&,
    flatbuffers::FlatBufferBuilder& builder)
{
    commanded_auto_mode->stop();
    return success(builder);
}

static CommandResult handle_get_auto_mode(
    const CommandContext&,
    const ClientMessage&,
    flatbuffers::FlatBufferBuilder& builder)
{
    return status_result(builder);
}

// Playing anything else is a client taking over. Stopping it isn't: what
// a client stops, it started, which has handed over already -- unless it
// was playing before auto mode started, which waits for it to end.
static void hand_over_when_played(ClientPayload payload_type)
{
    switch(payload_type)
    {
        case ClientPayload_StartAudioStream:
        case ClientPayload_PlayShow:
        case ClientPayload_PlayAudioFile:
        case ClientPayload_PlayPreset:
            commanded_auto_mode->hand_over();
            break;

        default:
            break;
    }
}

// Tells every client when auto mode starts or stops, which it can do by
// itself.
static bool take_status_notice(
    CommandResult& result,
    flatbuffers::FlatBufferBuilder& builder)
{
    if(!commanded_auto_mode->take_status_change())
    {
        return false;
    }

    result = status_result(builder);
    return true;
}

static const CommandBinding bindings[] = {
    {ClientPayload_StartAutoMode, handle_start_auto_mode},
    {ClientPayload_StopAutoMode, handle_stop_auto_mode},
    {ClientPayload_GetAutoMode, handle_get_auto_mode},
};

void register_auto_mode_commands(AutoMode& auto_mode)
{
    commanded_auto_mode = &auto_mode;
    register_commands(bindings);
    register_command_observer(hand_over_when_played);
    register_notice(take_status_notice);
}
