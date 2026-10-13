#include "eye.h"

#include <Preferences.h>

#include <algorithm>
#include <cmath>

#include "config.h"

// How far look() turns either way. -128 has no counterpart on the right, so
// it looks as far left as -127 does.
static constexpr int look_reach = 127;
static constexpr uint8_t lid_wide_open = 255;

static constexpr uint32_t blink_duration_ms = 400;
static constexpr uint32_t look_duration_ms = 400;

static constexpr ServoCalibration uncalibrated = {0, servo_max_angle};

// By EyeServo. The names double as the servos' keys in the calibration's
// NVS namespace.
static const char* const servo_names[] = {"ball", "lid"};
static const uint8_t servo_pins[] = {pin_servo_eye_ball, pin_servo_eye_lid};

static size_t index_of(EyeServo servo)
{
    return static_cast<size_t>(servo);
}

// Converts linear progress into smooth motion.
// Both input and output range from 0.0 (start) to 1.0 (end).
static float ease_in_out(float progress)
{
    const float u = std::max(0.0f, std::min(progress, 1.0f));

    return u * u * u * (u * (6.0f * u - 15.0f) + 10.0f);
}

void Eye::begin()
{
    // Opening the namespace fails until a calibration has first been stored
    // in it, which leaves every servo uncalibrated, as it should.
    Preferences preferences;
    const bool has_calibration =
        preferences.begin(eye_calibration_namespace, true);

    bool is_calibrated[servo_count];
    for(size_t i = 0; i < servo_count; ++i)
    {
        ServoCalibration stored;
        is_calibrated[i] =
            has_calibration &&
            preferences.getBytes(servo_names[i], &stored, sizeof(stored)) ==
                sizeof(stored);
        calibrations[i] = is_calibrated[i] ? stored : uncalibrated;

        // The servo stays limp until it is first written to, so it goes
        // straight to where it is told rather than via some default.
        servos[i].attach(servo_pins[i], servo_min_pulse_us, servo_max_pulse_us);
        if(!servos[i].attached())
        {
            Serial.printf(
                "Eye: could not attach the %s servo on pin %u\n",
                servo_names[i],
                servo_pins[i]);
        }
    }

    // Uncalibrated, the eye's resting place may lie past where the mechanism
    // can reach, so such a servo stays limp until a client moves it.
    if(is_calibrated[index_of(EyeServo::Ball)])
    {
        move_within_calibration(EyeServo::Ball, 0.5f, 0);
    }

    if(is_calibrated[index_of(EyeServo::Lid)])
    {
        move_within_calibration(EyeServo::Lid, 1.0f, 0);
    }
}

void Eye::update()
{
    const uint32_t now = millis();

    for(size_t i = 0; i < servo_count; ++i)
    {
        Motion& motion = motions[i];

        if(!motion.moving)
        {
            continue;
        }

        const uint32_t elapsed = now - motion.started_at_ms;

        if(elapsed >= motion.duration_ms)
        {
            motion.current_angle = motion.target_angle;
            motion.moving = false;
        }
        else
        {
            const float progress =
                elapsed / static_cast<float>(motion.duration_ms);

            motion.current_angle =
                motion.start_angle +
                (motion.target_angle - motion.start_angle) *
                    ease_in_out(progress);
        }

        servos[i].write(
            static_cast<uint8_t>(lroundf(motion.current_angle)));
    }
}

void Eye::look(int8_t at)
{
    const int clamped = std::max<int>(at, -look_reach);

    move_within_calibration(
        EyeServo::Ball,
        (clamped + look_reach) / (2.0f * look_reach), look_duration_ms);
}

void Eye::blink(uint8_t amount)
{
    move_within_calibration(
        EyeServo::Lid,
        amount / static_cast<float>(lid_wide_open), blink_duration_ms);
}

void Eye::move_servo(EyeServo servo, uint8_t angle)
{
    const size_t i = index_of(servo);

    servos[i].write(angle);

    Motion& motion = motions[i];
    motion.current_angle = static_cast<float>(angle);
    motion.position_known = true;
    motion.moving = false;
}

ServoCalibration Eye::calibration(EyeServo servo) const
{
    return calibrations[index_of(servo)];
}

bool Eye::calibrate(EyeServo servo, ServoCalibration calibration)
{
    const char* name = servo_names[index_of(servo)];

    Preferences preferences;
    if(!preferences.begin(eye_calibration_namespace) ||
       preferences.putBytes(name, &calibration, sizeof(calibration)) !=
           sizeof(calibration))
    {
        Serial.printf("Eye: could not store the %s servo's calibration\n", name);
        return false;
    }

    calibrations[index_of(servo)] = calibration;
    Serial.printf(
        "Eye: %s servo calibrated to %u-%u degrees\n",
        name,
        calibration.min_angle,
        calibration.max_angle);
    return true;
}

void Eye::start_motion(EyeServo servo, float target_angle, uint32_t duration_ms)
{
    Motion& motion = motions[index_of(servo)];

    // Without a known starting position, we cannot interpolate safely.
    // A zero-duration movement is also an immediate move.
    if(!motion.position_known || duration_ms == 0)
    {
        move_servo(
            servo,
            static_cast<uint8_t>(lroundf(target_angle)));
        return;
    }

    motion.start_angle = motion.current_angle;
    motion.target_angle = target_angle;
    motion.started_at_ms = millis();
    motion.duration_ms = duration_ms;
    motion.moving = true;
}

void Eye::move_within_calibration(
    EyeServo servo,
    float fraction,
    uint32_t duration_ms)
{
    // Works whichever way round the servo is mounted.
    const ServoCalibration range = calibrations[index_of(servo)];
    const float angle =
        range.min_angle + (range.max_angle - range.min_angle) * fraction;

    start_motion(servo, angle, duration_ms);
}
