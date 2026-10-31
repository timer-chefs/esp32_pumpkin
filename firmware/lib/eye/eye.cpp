#include "eye.h"

#include <Preferences.h>

#include <algorithm>
#include <cmath>

#include "config.h"
#include "device_log.h"

// How far look() turns either way. -128 has no counterpart on the right, so
// it looks as far left as -127 does.
static constexpr int look_reach = 127;
static constexpr uint8_t lid_wide_open = 255;

static constexpr uint32_t blink_duration_ms = 400;
static constexpr uint32_t look_duration_ms = 400;
static constexpr uint32_t look_lid_duration_ms = look_duration_ms / 2;
static constexpr uint32_t glance_duration_ms = 120;

// How long a servo holds its position after it was last moved. Held still,
// it keeps buzzing as it corrects for tiny errors, so it is then let go of
// by no longer sending it pulses.
static constexpr uint32_t servo_hold_ms = 250;

// Splits the pulse period into 1024 steps, about 20 us each, as
// ESP32Servo does.
static constexpr uint8_t servo_pwm_bits = 10;

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
        servos[i].attachPin(
            servo_pins[i], 1000000.0 / servo_pulse_period_us, servo_pwm_bits);
        if(!servos[i].attached())
        {
            device_log.printf(
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
            if(motion.holding && now - motion.written_at_ms >= servo_hold_ms)
            {
                // A line held low, unlike any pulse, lets the servo go limp.
                servos[i].write(0);
                motion.holding = false;
            }
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

        write_servo(i, static_cast<uint8_t>(lroundf(motion.current_angle)));
    }

    const Motion& lid = motions[index_of(EyeServo::Lid)];

    //Transition between LidPhase::Closing and LidPhase::Opening
    if(!lid.moving)
    {
        if(lid_phase == LidPhase::Closing)
        {
            move_within_calibration(
                EyeServo::Lid,
                resting_lid_amount / static_cast<float>(lid_wide_open),
                look_lid_duration_ms);

            lid_phase = LidPhase::Opening;
        }
        else if(lid_phase == LidPhase::Opening)
        {
            lid_phase = LidPhase::Idle;
        }
    }
}

void Eye::look(int8_t at)
{
    move_within_calibration(EyeServo::Ball, look_fraction(at), look_duration_ms);

    const size_t lid = index_of(EyeServo::Lid);

    //Do not move the lid automaticaly if the lid´s servo is not calibrated.
    if(!is_calibrated[lid] || !motions[lid].position_known)
    {
        return;
    }

    move_within_calibration(EyeServo::Lid, 0.0f, look_lid_duration_ms);     //0.0f selects the calibrated "closed" endpoint, even when the servo is mounted in reverse.

    lid_phase = LidPhase::Closing;
}

void Eye::glance(int8_t at)
{
    move_within_calibration(EyeServo::Ball, look_fraction(at), glance_duration_ms);
}

void Eye::blink(uint8_t amount)
{
    resting_lid_amount = amount;    

    // Override the automatic blinking in the look sequence.
    lid_phase = LidPhase::Idle;

    move_within_calibration(
        EyeServo::Lid,
        amount / static_cast<float>(lid_wide_open), blink_duration_ms);
}

void Eye::move_servo(EyeServo servo, uint8_t angle)
{
    const size_t i = index_of(servo);

    write_servo(i, angle);

    Motion& motion = motions[i];
    motion.current_angle = static_cast<float>(angle);
    motion.position_known = true;
    motion.moving = false;

    if(servo == EyeServo::Lid)          //to prevent the automatic lid movement to interfering with the calibration preview.
    {
        lid_phase = LidPhase::Idle;
    }
}

float Eye::look_fraction(int8_t at)
{
    const int clamped = std::max<int>(at, -look_reach);

    return (clamped + look_reach) / (2.0f * look_reach);
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
        device_log.printf("Eye: could not store the %s servo's calibration\n", name);
        return false;
    }

    calibrations[index_of(servo)] = calibration;
    is_calibrated[index_of(servo)] = true;
    device_log.printf(
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

void Eye::write_servo(size_t i, uint8_t angle)
{
    const uint32_t pulse_us =
        map(angle, 0, servo_max_angle, servo_min_pulse_us, servo_max_pulse_us);

    servos[i].write((pulse_us << servo_pwm_bits) / servo_pulse_period_us);
    motions[i].written_at_ms = millis();
    motions[i].holding = true;
}
