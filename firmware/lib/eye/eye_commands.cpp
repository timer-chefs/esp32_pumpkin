#include "eye_commands.h"

#include "command_registry.h"
#include "config.h"
#include "pumpkin_generated.h"

using namespace Pumpkin::Protocol;

static Eye* commanded_eye = nullptr;

static bool find_servo(EyeServoId id, EyeServo& servo)
{
    switch(id)
    {
        case EyeServoId_BALL:
            servo = EyeServo::Ball;
            return true;

        case EyeServoId_LID:
            servo = EyeServo::Lid;
            return true;
    }

    return false;
}

static ServoRange to_range(ServoCalibration calibration)
{
    return ServoRange(calibration.min_angle, calibration.max_angle);
}

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

static CommandResult handle_preview_servo_angle(
    const CommandContext&,
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    const auto* preview = message.payload_as_PreviewServoAngle();

    EyeServo servo;
    if(!find_servo(preview->servo(), servo))
    {
        return error(builder, ErrorCode_INVALID_ARGUMENT, "Unknown servo");
    }

    if(preview->angle() > servo_max_angle)
    {
        return error(
            builder,
            ErrorCode_INVALID_ARGUMENT,
            "Servo angles go from 0 to 180");
    }

    commanded_eye->move_servo(servo, preview->angle());
    return success(builder);
}

static CommandResult handle_get_eye_calibration(
    const CommandContext&,
    const ClientMessage&,
    flatbuffers::FlatBufferBuilder& builder)
{
    const ServoRange ball = to_range(commanded_eye->calibration(EyeServo::Ball));
    const ServoRange lid = to_range(commanded_eye->calibration(EyeServo::Lid));
    return {
        ServerPayload_EyeCalibration,
        CreateEyeCalibration(builder, &ball, &lid).Union()};
}

static CommandResult handle_save_servo_calibration(
    const CommandContext&,
    const ClientMessage& message,
    flatbuffers::FlatBufferBuilder& builder)
{
    const auto* save = message.payload_as_SaveServoCalibration();
    const ServoRange* range = save->range();

    EyeServo servo;
    if(!find_servo(save->servo(), servo))
    {
        return error(builder, ErrorCode_INVALID_ARGUMENT, "Unknown servo");
    }

    if(range->min_angle() > servo_max_angle ||
       range->max_angle() > servo_max_angle)
    {
        return error(
            builder,
            ErrorCode_INVALID_ARGUMENT,
            "Servo angles go from 0 to 180");
    }

    if(!commanded_eye->calibrate(
           servo,
           {range->min_angle(), range->max_angle()}))
    {
        return error(
            builder,
            ErrorCode_UNKNOWN,
            "Could not store the calibration on the device");
    }

    return success(builder);
}

static const CommandBinding bindings[] = {
    {ClientPayload_MoveEye, handle_move_eye},
    {ClientPayload_MoveEyeLid, handle_move_eye_lid},
    {ClientPayload_PreviewServoAngle, handle_preview_servo_angle},
    {ClientPayload_GetEyeCalibration, handle_get_eye_calibration},
    {ClientPayload_SaveServoCalibration, handle_save_servo_calibration},
};

void register_eye_commands(Eye& eye)
{
    commanded_eye = &eye;
    register_commands(bindings);
}
