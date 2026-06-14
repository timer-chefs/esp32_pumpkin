#include <Arduino.h>

#include "led_counter.h"
//#include "event_queue.h"

Led led0(pin_led0), led1(pin_led1), led2(pin_led2);
Led* leds[] = {&led0, &led1, &led2};
LedCounter led_counter(leds, 3);

void setup()
{
  led_counter.init(); 
}

void loop()
{
   led_counter.increment();
   delay(1000);
}
