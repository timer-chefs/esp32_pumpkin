#ifndef LED_COUNTER_H
#define LED_COUNTER_H

#include <Arduino.h>

class Led
{
public:
    Led(uint8_t pin);
    void init();
    void on();
    void off();
    void toggle();
private:
    uint8_t pin;
    bool state;
};

class LedCounter
{
public:
    LedCounter(Led* leds[], uint8_t count);
    void init();
    void increment();
    void decrement();
    void reset();
    void set(uint16_t value);
    uint16_t getValue() const;
private:
    Led** leds;
    uint8_t ledCount;
    uint16_t counter;
    void update_leds();
};

#endif //LED_COUNTER_H
