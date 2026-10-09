#include "eye.h"

#include <Preferences.h>

#include <algorithm>
#include <cmath>

#include "config.h"

// How far look() turns either way. -128 has no counterpart on the right, so
// it looks as far left as -127 does.
static constexpr int look_reach = 127;
static constexpr uint8_t lid_wide_open = 255;

static constexpr ServoCalibration uncalibrated = {0, servo_max_angle};

// By EyeServo. The names double as the servos' keys in the calibration's
// NVS namespace.
static const char* const servo_names[] = {"ball", "lid"};
static const uint8_t servo_pins[] = {pin_servo_eye_ball, pin_servo_eye_lid};

static size_t index_of(EyeServo servo)
{
    return static_cast<size_t>(servo);
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
        look(0);
    }
    if(is_calibrated[index_of(EyeServo::Lid)])
    {
        blink(lid_wide_open);
    }
}

void Eye::look(int8_t at)
{
    const int clamped = std::max<int>(at, -look_reach);
    move_within_calibration(
        EyeServo::Ball,
        (clamped + look_reach) / (2.0f * look_reach));
}

void Eye::blink(uint8_t amount)
{
    move_within_calibration(
        EyeServo::Lid,
        amount / static_cast<float>(lid_wide_open));
}

void Eye::move_servo(EyeServo servo, uint8_t angle)
{
    servos[index_of(servo)].write(angle);
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

void Eye::move_within_calibration(EyeServo servo, float fraction)
{
    // Works out the same whichever way round the servo is mounted, since
    // min_angle may be the larger of the two.
    const ServoCalibration range = calibrations[index_of(servo)];
    const float angle =
        range.min_angle + (range.max_angle - range.min_angle) * fraction;
    move_servo(servo, static_cast<uint8_t>(lroundf(angle)));
}
