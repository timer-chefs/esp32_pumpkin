#include <Arduino.h>
#include <ESP32Servo.h>

#include "config.h"

static Servo servo1;
static Servo servo2;

static bool servo_init()
{
    servo1.attach(38);
    servo2.attach(41);

    if (!servo1.attached() || !servo2.attached())
    {
        Serial.printf("Servo attach failed on pins %u and %u\n", 38, 40);
        return false;
    }

    Serial.printf("Servo attached on pins %u and %u (%u-%u us at %u Hz)\n",
                  38, 40, servo_min_pulse_us, servo_max_pulse_us,
                  servo_frequency_hz);
    return true;
}

// Steps from one angle to the other rather than jumping, so the servo moves
// at a speed the load can follow and the current draw stays modest.
static void sweep_to(uint8_t from_angle, uint8_t to_angle)
{
    const int8_t step = (to_angle > from_angle) ? (int8_t)servo_sweep_step_degrees
                                                : -(int8_t)servo_sweep_step_degrees;

    for (int angle = from_angle; (step > 0) ? (angle <= to_angle) : (angle >= to_angle);
         angle += step)
    {
        servo2.write(angle);
        delay(servo_sweep_step_delay_ms);
    }

    servo2.write(to_angle);
}

static bool is_servo_ready = false;

void setup()
{
    Serial.begin(baud_rate);
    delay(1000);

    Serial.println("\n\n=== Servo Test ===\n");

    is_servo_ready = servo_init();
    if (!is_servo_ready)
    {
        return;
    }

    // Park at the middle before the sweep starts, so the first movement in
    // loop() is a known one instead of wherever the horn happened to sit.
    servo2.write((servo_min_angle + servo_max_angle) / 2);
    delay(servo_sweep_hold_ms);
}

void loop()
{
    if (!is_servo_ready)
    {
        delay(1000);
        return;
    }

    servo1.write(0);
    servo2.write(0);
    delay(1000);

    servo1.write(180);
    servo2.write(180);
    delay(1000);
}
