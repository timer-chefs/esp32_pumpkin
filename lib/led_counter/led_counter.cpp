#include "led_counter.h"

#include "driver/gpio.h"

Led::Led(uint8_t pin)
{
    this -> pin = pin;
    this -> state = false;
}

void Led::init()
{
    gpio_set_direction(static_cast<gpio_num_t>(pin), GPIO_MODE_OUTPUT);
    gpio_set_level(static_cast<gpio_num_t>(pin), 0);
    state = false;
}

void Led::on()
{
    gpio_set_level(static_cast<gpio_num_t>(pin), 1);
    state = true;
}

void Led::off()
{
    gpio_set_level(static_cast<gpio_num_t>(pin), 0);
    state = false;
}

void Led::toggle()
{
    state ? off() : on();
}

// LedCounter Implementation
LedCounter::LedCounter(Led* leds[], uint8_t count)
{
    this->leds = leds;
    this->ledCount = count;
    this->counter = 0;
}

void LedCounter::init()
{
    for (uint8_t i = 0; i < ledCount; i++)
    {
        leds[i]->init();
    }
    update_leds();
}

void LedCounter::increment()
{
    counter++;
    update_leds();
}

void LedCounter::decrement()
{
    if (counter > 0)
    {
        counter--;
    }
    update_leds();
}

void LedCounter::update_leds()
{
    for (uint8_t i = 0; i < ledCount; i++)
    {
        ((counter >> i) & 1) ? leds[i]->on() : leds[i]->off();  //Evaluates the i bit of the counter  
    }
}

void LedCounter::reset()
{
    counter = 0;
    update_leds();
}

void LedCounter::set(uint16_t value)
{
    counter = value;
    update_leds();
}

uint16_t LedCounter::getValue() const
{
    return counter;
}
