#ifndef EYE_H
#define EYE_H

#include <Arduino.h>
#include <ESP32PWM.h>

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

    // Advances active servo movements, and lets go of servos that have
    // stood still for a while. Call regularly from loop().
    void update();

    // Turns the eye: negative is left, 0 straight ahead, positive right.
    void look(int8_t at);

    // Turns the eye as look() does, only quicker and leaving the lid alone,
    // for keeping up with a beat that look()'s blinking would turn into a
    // flutter.
    void glance(int8_t at);

    // Opens or closes the lid: 0 is shut, 255 wide open.
    void blink(uint8_t amount);

    // Moves a servo to `angle`, 0-180, ignoring its calibration. For finding
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

    // Maps look()'s range onto the ball's calibration.
    static float look_fraction(int8_t at);

    struct Motion
    {
        float current_angle = 0.0f;
        float start_angle = 0.0f;
        float target_angle = 0.0f;

        uint32_t started_at_ms = 0;
        uint32_t duration_ms = 0;

        uint32_t written_at_ms = 0;     //When the servo was last sent an angle.

        bool holding = false;           //If the servo is being sent pulses.
        bool moving = false;            //If there is an ongoing motion.
        bool position_known = false;    //If the current_angle has been recorded at least a first time.
    };

    enum class LidPhase : uint8_t
    {
        Idle,
        Closing,
        Opening,
    };

    // Openness to restore after a look, initially fully open.
    uint8_t resting_lid_amount = 255;

    LidPhase lid_phase = LidPhase::Idle;

    // Starts a timed movement from the latest commanded position.
    // target_angle must be within the servo's valid angle range.
    void start_motion(EyeServo servo, float target_angle, uint32_t duration_ms);

    // Moves within the calibrated range.
    // A zero duration moves immediately; otherwise the movement is animated.
    void move_within_calibration(EyeServo servo, float fraction, uint32_t duration_ms = 0);

    // Sends servo `i` the pulse for `angle`, taking hold of it again if
    // update() has let go of it.
    void write_servo(size_t i, uint8_t angle);

    // Plain PWM rather than ESP32Servo's Servo, which has no way to stop
    // pulsing a servo: on the S3, its detach() leaves the pulses running.
    ESP32PWM servos[servo_count];
    ServoCalibration calibrations[servo_count];
    
    bool is_calibrated[servo_count]{};

    Motion motions[servo_count]{};
};

#endif //EYE_H
