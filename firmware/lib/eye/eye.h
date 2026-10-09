#ifndef EYE_H
#define EYE_H

#include <Arduino.h>
#include <ESP32Servo.h>

// The eye's two servos.
enum class EyeServo : uint8_t
{
    // Turns the eye from side to side.
    Ball,
    // Opens and closes the lid over it.
    Lid,
};

// The servo angles, 0-180, that the ends of an eye control map to: look()'s
// far left and far right for the ball, blink()'s shut and wide open for the
// lid. min_angle may be the larger of the two, for a servo that is mounted
// the other way round.
struct ServoCalibration
{
    uint8_t min_angle;
    uint8_t max_angle;
};

// The pumpkin's eye: a ball that turns from side to side, and a lid that
// opens and closes over it.
class Eye
{
public:
    // Loads the calibration and attaches the servos, leaving the eye open
    // and looking straight ahead. A servo that has never been calibrated
    // stays where it is until it is moved.
    void begin();

    // Turns the eye: negative is left, 0 straight ahead, positive right.
    void look(int8_t at);

    // Opens or closes the lid: 0 is shut, 255 wide open.
    void blink(uint8_t amount);

    // Holds a servo at `angle`, 0-180, ignoring its calibration. For finding
    // the calibration in the first place.
    void move_servo(EyeServo servo, uint8_t angle);

    // The angles look() and blink() map their range onto. A servo that has
    // never been calibrated moves through all of 0-180.
    ServoCalibration calibration(EyeServo servo) const;

    // Stores a servo's calibration, where it survives a restart, and moves
    // the eye by it from now on. Returns false, changing nothing, if it
    // couldn't be stored.
    bool calibrate(EyeServo servo, ServoCalibration calibration);

private:
    static constexpr size_t servo_count = 2;

    // Moves a servo `fraction` of the way from its calibrated minimum to its
    // maximum.
    void move_within_calibration(EyeServo servo, float fraction);

    Servo servos[servo_count];
    ServoCalibration calibrations[servo_count];
};

#endif //EYE_H
